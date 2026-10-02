import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Office, Territory } from '../../../../packages/domain/src/index';
import { normalizeEA20, parseCatalog } from '../../../../packages/tse/src/index';
import type { Store } from '../db/store';

export const ufCodes: Record<string, string> = {
  ro: '11',
  ac: '12',
  am: '13',
  rr: '14',
  pa: '15',
  ap: '16',
  to: '17',
  ma: '21',
  pi: '22',
  ce: '23',
  rn: '24',
  pb: '25',
  pe: '26',
  al: '27',
  se: '28',
  ba: '29',
  mg: '31',
  es: '32',
  rj: '33',
  sp: '35',
  pr: '41',
  sc: '42',
  rs: '43',
  ms: '50',
  mt: '51',
  go: '52',
  df: '53',
};
type Scenario = {
  id: string;
  description: string;
  date: string;
  steps: { capture: string; time: string; progress: number }[];
};
export class FixtureService {
  readonly territories: Territory[];
  readonly scenario: Scenario;
  constructor(
    readonly store: Store,
    readonly root = process.cwd(),
  ) {
    this.territories = parseCatalog(
      JSON.parse(readFileSync(resolve(root, 'packages/fixtures/simulado/ea12.json'), 'utf8')),
      'fixture',
    );
    this.territories.forEach((t) => {
      if (t.kind === 'uf') t.ibgeCode = ufCodes[t.id];
    });
    this.scenario = JSON.parse(
      readFileSync(resolve(root, 'packages/fixtures/synthetic/scenario.json'), 'utf8'),
    );
    if (!store.getState('fixture:step'))
      for (let step = 0; step <= 2; step++) this.ingestStep(step);
  }
  get step() {
    return Number(this.store.getState('fixture:step') ?? '0');
  }
  raw(territory: Territory, office: Office, step: number) {
    const event = this.scenario.steps[step];
    const seed = [...territory.id].reduce((n, c) => n + c.charCodeAt(0), 0);
    const total =
      territory.kind === 'br'
        ? 480000
        : territory.kind === 'uf'
          ? 5000 + seed * 21
          : 80 + (seed % 160);
    const progress = Math.max(
      0,
      Math.min(1, event.progress + (step === 0 ? 0 : ((seed % 9) - 4) / 100)),
    );
    const totalized = Math.floor(total * progress),
      turnout = totalized * 220;
    const blank = totalized * 5,
      nullVotes = totalized * 8,
      annulled = totalized * 2;
    const valid = turnout - blank - nullVotes - annulled;
    const a = Math.floor(valid * (0.4 + (seed % 12) / 100 + step / 300));
    const b = Math.floor(valid * (0.37 - (seed % 7) / 100));
    const counts = [a, b, valid - a - b, annulled];
    const officeCode = office === 'president' ? '1' : '3';
    return {
      ele: office === 'president' ? '21270' : '21272',
      t: '1',
      f: 's',
      tpabr: territory.kind === 'municipality' ? 'mu' : territory.kind,
      cdabr: territory.tseCode ?? territory.uf ?? 'br',
      dg: this.scenario.date,
      hg: event.time,
      dt: step === 0 ? '' : this.scenario.date,
      ht: step === 0 ? '' : event.time,
      idg: String(900 - step),
      dv: 's',
      tf: 'n',
      and: step === 0 ? 'n' : 'p',
      s: { ts: String(total), st: String(totalized), snt: String(total - totalized) },
      e: {
        te: String(total * 300),
        est: String(totalized * 300),
        esi: String(totalized * 300),
        c: String(turnout),
        a: String(totalized * 80),
      },
      v: {
        tv: String(turnout),
        vvc: String(valid + annulled),
        vv: String(valid),
        vb: String(blank),
        tvn: String(nullVotes),
        van: String(annulled),
        vansj: '0',
        vscv: '0',
      },
      carg: [
        {
          cd: officeCode,
          agr: [
            {
              par: counts.map((votes, i) => ({
                sg: `DEMO ${i + 1}`,
                cand: [
                  {
                    n: String(91 + i),
                    sqcand: `${officeCode}${office === 'governor' ? ufCodes[territory.uf!] : '00'}${i + 1}`,
                    nm: `Candidatura ${'ABCD'[i]}`,
                    nmu: `Candidatura ${'ABCD'[i]}`,
                    dvt: i === 3 ? 'Anulado' : 'Válido',
                    vap: String(votes),
                  },
                ],
              })),
            },
          ],
        },
      ],
    };
  }
  ingestTerritory(territory: Territory, step = this.step) {
    // Municipality fixture scope is deliberately bounded to Acre.
    if (
      territory.kind === 'exterior' ||
      (territory.kind === 'municipality' && territory.uf !== 'ac')
    )
      return;
    for (const office of (territory.kind === 'br'
      ? ['president']
      : ['president', 'governor']) as Office[]) {
      const raw = JSON.stringify(this.raw(territory, office, step));
      const snapshot = normalizeEA20(JSON.parse(raw), {
        environment: 'fixture',
        electionId: office === 'president' ? '21270' : '21272',
        office,
        territory,
        sourceUrl: `fixture:synthetic-v1/${territory.id}/${office}/${step}`,
        capturedAt: this.scenario.steps[step].capture,
        basis: 'synthetic',
        raw,
      });
      const previous = this.store.latest('fixture', office, territory.id);
      if (
        previous &&
        (snapshot.sections.totalized < previous.sections.totalized ||
          (snapshot.votes.valid ?? 0) < (previous.votes.valid ?? 0))
      )
        snapshot.warnings.push('Revisão: redução de contador; versão anterior preservada');
      this.store.insert(snapshot, raw);
    }
  }
  ingestStep(step: number) {
    this.store.db.transaction(() => {
      const enabled = new Set(
        this.store
          .watchlist('fixture')
          .filter((w) => w.enabled)
          .map((w) => w.territoryId),
      );
      for (const t of this.territories)
        if (t.kind !== 'municipality' || enabled.has(t.id)) this.ingestTerritory(t, step);
      this.store.setState('fixture:step', String(step));
    })();
  }
  advance() {
    if (this.step + 1 < this.scenario.steps.length) this.ingestStep(this.step + 1);
    return this.step;
  }
}
