import { gzipSync, gunzipSync } from 'node:zlib';
import type { Store } from '../db/store';
import { ConservativeCollector, type CollectJob } from '../../../../packages/tse/src/collector';
import { rawDigest } from '../../../../packages/tse/src/index';
import type { HttpResult } from '../../../../packages/tse/src/http';

/** Explicitly driven service, no background timer and no activation from the fixture application. */
export class PersistentCollector {
  readonly queue: ConservativeCollector;
  constructor(
    readonly store: Store,
    readonly now = () => Date.now(),
  ) {
    this.queue = new ConservativeCollector(500, 60_000, now);
    const db = store.db;
    const state = db
      .prepare(
        "SELECT next_request AS nextRequest,turn,requests,bytes,unchanged,errors FROM collector_state WHERE id='global'",
      )
      .get() as
      | {
          nextRequest: number;
          turn: number;
          requests: number;
          bytes: number;
          unchanged: number;
          errors: number;
        }
      | undefined;
    if (state) {
      const rows = db.prepare('SELECT key,payload,missing FROM collector_job').all() as {
        key: string;
        payload: string;
        missing: number;
      }[];
      this.queue.restore({
        jobs: rows.map((r) => JSON.parse(r.payload)),
        missing: rows.filter((r) => r.missing).map((r) => r.key),
        nextRequest: state.nextRequest,
        turn: state.turn,
        stats: {
          requests: state.requests,
          bytes: state.bytes,
          unchanged: state.unchanged,
          errors: state.errors,
        },
      });
    }
  }
  save() {
    const state = this.queue.snapshot(),
      db = this.store.db;
    db.transaction(() => {
      db.prepare(
        `INSERT INTO collector_state VALUES('global',?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET next_request=excluded.next_request,turn=excluded.turn,requests=excluded.requests,bytes=excluded.bytes,unchanged=excluded.unchanged,errors=excluded.errors`,
      ).run(
        state.nextRequest,
        state.turn,
        state.stats.requests,
        state.stats.bytes,
        state.stats.unchanged,
        state.stats.errors,
      );
      const upsert = db.prepare(
        'INSERT INTO collector_job VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,missing=excluded.missing',
      );
      for (const job of state.jobs)
        upsert.run(job.key, JSON.stringify(job), Number(state.missing.includes(job.key)));
    })();
  }
  cached(key: string) {
    const r = this.store.db
      .prepare(
        'SELECT b.compressed FROM collector_cache c JOIN collector_body b ON b.digest=c.body_digest WHERE c.job_key=?',
      )
      .get(key) as { compressed: Buffer } | undefined;
    return r ? gunzipSync(r.compressed).toString('utf8') : null;
  }
  async tick(
    transport: (job: Readonly<CollectJob>, headers: Record<string, string>) => Promise<HttpResult>,
  ) {
    const started = this.now();
    const result = await this.queue.tick(started, async (job, headers) => {
      // Persist consumed budget before issuing HTTP; a crash must not reset request allowance.
      this.save();
      let response: HttpResult;
      try {
        response = await transport(job, headers);
        if (response.status === 200 && response.raw === undefined)
          throw Error('Resposta 200 sem corpo validado');
        if (response.status === 304 && this.cached(job.key) === null)
          throw Error('304 sem cache validado');
      } catch (error) {
        this.store.db
          .prepare(
            'INSERT INTO collector_observation(job_key,started_at,completed_at,status,bytes,error) VALUES(?,?,?,0,0,?)',
          )
          .run(
            job.key,
            new Date(started).toISOString(),
            new Date(this.now()).toISOString(),
            error instanceof Error ? error.message : 'Falha de transporte',
          );
        throw error;
      }
      const completed = new Date(this.now()).toISOString(),
        digest = response.raw === undefined ? null : rawDigest(response.raw);
      this.store.db.transaction(() => {
        if (digest && response.raw !== undefined) {
          this.store.db
            .prepare('INSERT OR IGNORE INTO collector_body VALUES(?,?)')
            .run(digest, gzipSync(response.raw));
          this.store.db
            .prepare(
              `INSERT INTO collector_cache VALUES(?,?,?,?) ON CONFLICT(job_key) DO UPDATE SET body_digest=excluded.body_digest,captured_at=CASE WHEN body_digest=excluded.body_digest THEN captured_at ELSE excluded.captured_at END,validated_at=excluded.validated_at`,
            )
            .run(job.key, digest, completed, completed);
        } else if (response.status === 304)
          this.store.db
            .prepare('UPDATE collector_cache SET validated_at=? WHERE job_key=?')
            .run(completed, job.key);
        this.store.db
          .prepare(
            'INSERT INTO collector_observation(job_key,started_at,completed_at,status,bytes,digest) VALUES(?,?,?,?,?,?)',
          )
          .run(
            job.key,
            new Date(started).toISOString(),
            completed,
            response.status,
            response.bytes,
            digest,
          );
      })();
      return response;
    });
    this.save();
    return result;
  }
}
