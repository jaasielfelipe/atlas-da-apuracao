import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ZoneStore } from '../db/zones';
import { attachAcceptedHistory } from '../db/territorial';
import { compareZones, type ZoneDataset } from '../../../../packages/domain/src/zones';
import { rawDigest } from '../../../../packages/tse/src/index';

/** Comparison handler for the official collection database; mounted by the dashboard routes. */
export function officialComparisonHandler(path: string, historyPath: string, root: string) {
  // attachAcceptedHistory only appends the (static) historical rows/matches valid at `at`;
  // cache them per registry + audit set. Timeline points are immutable once their instant has
  // passed (captures are append-only, no future information), so cache those per instant too.
  const historyCache = new Map<
    string,
    { results: ZoneDataset['results']; matches: ZoneDataset['matches'] }
  >();
  const timelineCache = new Map<string, ReturnType<typeof compareZones>>();
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const q = z
      .object({
        territory: z
          .string()
          .regex(/^(br|[a-z]{2})(:[0-9]{5})?$/)
          .default('br'),
        at: z
          .string()
          .datetime()
          .transform((v) => new Date(v).toISOString())
          .optional(),
      })
      .parse(request.query);
    if (!existsSync(path) || !existsSync(historyPath))
      return reply
        .code(503)
        .send({ error: 'Acervo oficial/histórico ainda indisponível; agregados independentes.' });
    const db = new Database(path, { readonly: true, fileMustExist: true });
    const history = new Database(historyPath, { readonly: true, fileMustExist: true });
    try {
      return db.transaction(() => {
        if (
          db
            .prepare(
              "SELECT 1 FROM zone_registry WHERE environment<>'official' UNION SELECT 1 FROM snapshot WHERE environment<>'official' LIMIT 1",
            )
            .get()
        )
          throw Error('Ambiente incompatível');
        const at = q.at ?? new Date().toISOString();
        const current = new ZoneStore({ db }).load('official', at);
        if (!current)
          return {
            environment: 'official',
            comparison: null,
            timeline: [],
            method: 'Sem cadastro capturado neste instante',
          };
        const [uf, municipality] = q.territory.split(':');
        if (
          q.territory !== 'br' &&
          !current.segments.some(
            (s) => s.uf === uf && (!municipality || s.municipality === municipality),
          )
        )
          return reply.code(400).send({ error: 'Território desconhecido' });
        const json = (file: string) => JSON.parse(readFileSync(resolve(root, file), 'utf8'));
        const identities = json('packages/fixtures/history/series-identities.json');
        const raw = readFileSync(
          resolve(root, 'packages/fixtures/zonal/official-ac01120-z0008.json'),
          'utf8',
        );
        const observed = json('packages/fixtures/zonal/observation.json').find(
          (o: any) => o.file === 'official-ac01120-z0008.json',
        );
        if (
          rawDigest(raw) !== identities[2026].rawSha256 ||
          observed.sha256 !== identities[2026].rawSha256
        )
          throw Error('Prova de identidade alterada');
        const source = JSON.parse(raw);
        if (
          source.f !== 'o' ||
          source.t !== '1' ||
          source.ele !== identities[2026].election ||
          current.results.some((r) => r.year !== 2026 || r.election !== source.ele)
        )
          throw Error('Eleição incompatível');
        const candidates = source.carg.flatMap((c: any) =>
          c.agr.flatMap((a: any) => a.par.flatMap((p: any) => p.cand)),
        );
        for (const series of ['bolsonaro', 'lula_haddad']) {
          const i = identities[2026][series];
          if (
            !candidates.some((c: any) => c.sqcand === i.id && c.n === i.number && c.nm === i.name)
          )
            throw Error('Identidade não resolvida');
        }
        current.mappings = Object.fromEntries(
          [2018, 2022, 2026].map((year) => [
            year,
            {
              bolsonaro: identities[year].bolsonaro.id,
              lula_haddad: identities[year].lula_haddad.id,
            },
          ]),
        ) as ZoneDataset['mappings'];
        const audit = history
          .prepare(
            'SELECT COUNT(*) n, MAX(captured_at) last FROM territorial_audit WHERE current_registry_digest=? AND captured_at<=?',
          )
          .get(current.registryDigest, at) as { n: number; last: string | null };
        const historyKey = `${current.registryDigest}|${audit.n}|${audit.last}`;
        let cached = historyCache.get(historyKey);
        if (!cached) {
          const attached = attachAcceptedHistory(history, current, at);
          cached = {
            results: attached.results.slice(current.results.length),
            matches: attached.matches,
          };
          if (historyCache.size > 8) historyCache.clear();
          historyCache.set(historyKey, cached);
        }
        const dataset: ZoneDataset = {
          ...current,
          results: [...current.results, ...cached.results],
          matches: [...cached.matches],
        };
        for (const year of [2018, 2022] as const) {
          if (
            dataset.results.some((r) => r.year === year && r.election !== identities[year].election)
          )
            throw Error('Eleição histórica incompatível');
          for (const series of ['bolsonaro', 'lula_haddad']) {
            const i = identities[year][series];
            const rows = history
              .prepare(
                'SELECT DISTINCT v.number,v.name FROM historical_vote v JOIN historical_import h ON h.id=v.import_id WHERE h.year=? AND v.candidate_id=?',
              )
              .all(year, i.id) as { number: string; name: string }[];
            if (rows.length !== 1 || rows[0].number !== i.number || rows[0].name !== i.name)
              throw Error('Identidade histórica não resolvida');
          }
        }
        if (observed.capturedAt > at) dataset.matches = [];
        const scope = q.territory === 'br' ? {} : { uf, municipality };
        // Bounded recent timeline; no interpolation or inferred historical capture timestamps.
        const captures = [
          ...new Set([
            ...current.results.map((r) => r.capturedAt),
            ...dataset.matches.map((m) => m.capturedAt),
          ]),
        ]
          .filter((t) => t <= at)
          .sort()
          .slice(-20);
        const comparison = compareZones(dataset, at, scope);
        return {
          environment: 'official',
          comparison,
          // Exact 2026 identities of each series (for display colors; no matching by name).
          series: Object.fromEntries(
            (['bolsonaro', 'lula_haddad'] as const).map((s) => [
              s,
              { id: identities[2026][s].id, number: identities[2026][s].number },
            ]),
          ),
          reconciliation: {
            acceptedSegments: dataset.matches.length,
            method: 'user_accepted_structural',
          },
          timeline: captures.map((t) => {
            const key = `${q.territory}|${t}|${historyKey}|${dataset.matches.length}`;
            let point = t < at ? timelineCache.get(key) : undefined;
            if (!point) {
              point = { ...compareZones(dataset, t, scope), rows: [] };
              if (timelineCache.size > 5000) timelineCache.clear();
              if (t < at) timelineCache.set(key, point);
            }
            return point;
          }),
          timelineLimit: 20,
          method:
            'Históricos finais TSE; aceite territorial informado pelo usuário (user_accepted_structural). Mesma coorte completa nos três anos; timeline das últimas 20 capturas/eventos de aceite.',
        };
      })();
    } finally {
      history.close();
      db.close();
    }
  };
}
