export type CollectJob = {
  key: string;
  url: string;
  kind: 'aggregate' | 'zone';
  municipality?: string;
  priority: number;
  due: number;
  failures: number;
  suspended: boolean;
  etag?: string;
  lastModified?: string;
  lastAttempt?: number;
  lastSuccess?: number;
  requests: number;
  bytes: number;
};
export type CollectResponse = {
  status: number;
  bytes: number;
  etag?: string;
  lastModified?: string;
  retryAfterMs?: number;
};
export type CollectorState = {
  jobs: CollectJob[];
  missing: string[];
  nextRequest: number;
  turn: number;
  stats: { requests: number; bytes: number; unchanged: number; errors: number };
};
/** One budget across all feeds, including conditional requests. Caller supplies clock and audited transport. */
export class ConservativeCollector {
  private readonly missing = new Set<string>();
  readonly jobs = new Map<string, CollectJob>();
  readonly stats = { requests: 0, bytes: 0, unchanged: 0, errors: 0 };
  private nextRequest = 0;
  private busy = false;
  private turn = 0;
  constructor(
    readonly intervalMs = 500,
    readonly pollMs = 60_000,
    readonly clock?: () => number,
  ) {
    if (intervalMs < 200 || pollMs < 1000) throw Error('Orçamento excede limite conservador');
  }
  snapshot(): CollectorState {
    return {
      jobs: [...this.jobs.values()].map((j) => ({ ...j })),
      missing: [...this.missing],
      nextRequest: this.nextRequest,
      turn: this.turn,
      stats: { ...this.stats },
    };
  }
  restore(state: CollectorState) {
    if (this.busy) throw Error('Coleta em andamento');
    this.jobs.clear();
    this.missing.clear();
    for (const job of state.jobs) this.jobs.set(job.key, { ...job });
    for (const key of state.missing) this.missing.add(key);
    this.nextRequest = state.nextRequest;
    this.turn = state.turn;
    Object.assign(this.stats, state.stats);
  }
  add(job: Pick<CollectJob, 'key' | 'url' | 'kind' | 'municipality' | 'priority'>) {
    if (this.jobs.has(job.key)) return;
    this.jobs.set(job.key, {
      ...job,
      due: 0,
      failures: 0,
      suspended: false,
      requests: 0,
      bytes: 0,
    });
  }
  setFavorites(ids: Set<string>) {
    for (const job of this.jobs.values()) {
      if (job.kind === 'aggregate' && job.municipality)
        job.suspended = this.missing.has(job.key) || !ids.has(job.municipality);
      if (job.kind === 'zone')
        job.priority = job.municipality && ids.has(job.municipality) ? 20 : 0;
    }
  }
  async tick(
    now: number,
    transport: (
      job: Readonly<CollectJob>,
      headers: Record<string, string>,
    ) => Promise<CollectResponse>,
  ) {
    if (this.busy || now < this.nextRequest) return null;
    const due = [...this.jobs.values()].filter((j) => !j.suspended && j.due <= now);
    // Every fourth slot serves oldest-due territory regardless of favorites: no starvation.
    const fairness = this.turn % 4 === 3;
    due.sort(
      (a, b) =>
        (fairness ? 0 : b.priority - a.priority) ||
        a.due - b.due ||
        (a.lastAttempt ?? -1) - (b.lastAttempt ?? -1) ||
        a.key.localeCompare(b.key),
    );
    const job = due[0];
    if (!job) return null;
    this.busy = true;
    this.turn++;
    this.nextRequest = now + this.intervalMs;
    job.lastAttempt = now;
    job.requests++;
    this.stats.requests++;
    const headers: Record<string, string> = {};
    if (job.etag) headers['If-None-Match'] = job.etag;
    else if (job.lastModified) headers['If-Modified-Since'] = job.lastModified;
    try {
      const response = await transport({ ...job }, headers);
      const completed = Math.max(now, this.clock?.() ?? now);
      job.bytes += response.bytes;
      this.stats.bytes += response.bytes;
      if (response.status === 200 || response.status === 304) {
        if (response.status === 304) this.stats.unchanged++;
        job.etag = response.etag ?? job.etag;
        job.lastModified = response.lastModified ?? job.lastModified;
        job.lastSuccess = completed;
        job.failures = 0;
        job.due = completed + this.pollMs;
      } else {
        this.stats.errors++;
        job.failures++;
        if (response.status === 404) {
          job.suspended = true;
          this.missing.add(job.key);
        }
        const backoff = Math.min(600_000, 1000 * 2 ** Math.min(job.failures, 10));
        job.due = completed + Math.max(backoff, response.retryAfterMs ?? 0);
        if (response.status === 429 || response.status === 403)
          this.nextRequest = completed + Math.max(600_000, response.retryAfterMs ?? 0);
      }
      return { key: job.key, status: response.status };
    } catch {
      this.stats.errors++;
      job.failures++;
      job.due =
        Math.max(now, this.clock?.() ?? now) +
        Math.min(600_000, 1000 * 2 ** Math.min(job.failures, 10));
      return { key: job.key, status: 0 };
    } finally {
      this.busy = false;
    }
  }
}
