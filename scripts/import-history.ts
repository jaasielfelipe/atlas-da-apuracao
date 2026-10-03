import { readFileSync, writeFileSync } from 'node:fs';
import { Store } from '../apps/api/src/db/store';
import { persistHistory } from '../apps/api/src/db/history';
import { parseZoneRegistry } from '../packages/tse/src/zones';
import { reconcileZone } from '../packages/tse/src/history';
import { digest } from '../packages/tse/src/index';
// Explicit offline import. No network and no activation of runtime official collection.
const store = new Store('data/history/atlas-history.sqlite');
try {
  const imports = [];
  for (const year of [2018, 2022] as const) {
    const metadata = JSON.parse(readFileSync(`data/history/${year}-download.json`, 'utf8'));
    imports.push(
      persistHistory(
        store,
        readFileSync(`data/history/${year}-BR.csv`),
        year,
        metadata.url,
        metadata.capturedAt,
      ),
    );
  }
  const registry = parseZoneRegistry(
    JSON.parse(readFileSync('packages/fixtures/zonal/official-ea12.json', 'utf8')),
    'official',
  );
  const zones = [...new Set(registry.segments.filter((s) => s.uf === 'ac').map((s) => s.zone))];
  const audit = zones.map((zone) => {
    const current = registry.segments
      .filter((s) => s.uf === 'ac' && s.zone === zone)
      .map((s) => s.municipality);
    const historical = imports.map((i) =>
      (
        store.db
          .prepare(
            'SELECT municipality FROM historical_segment WHERE import_id=? AND uf=? AND zone=?',
          )
          .all(i.id, 'ac', zone) as { municipality: string }[]
      ).map((s) => s.municipality),
    );
    const result = reconcileZone(current, historical[0], historical[1]);
    return {
      zone,
      current,
      historical2018: historical[0],
      historical2022: historical[1],
      ...result,
    };
  });
  const capturedAt = new Date().toISOString();
  for (const a of audit)
    store.db
      .prepare('INSERT OR IGNORE INTO territorial_audit VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run(
        digest([registry.digest, imports, a]),
        capturedAt,
        registry.digest,
        imports[0].id,
        imports[1].id,
        'ac',
        a.zone,
        a.status,
        'Comparação das composições municipais; reorganizações não auditadas',
        a.reason,
      );
  const report = {
    capturedAt,
    imports,
    registryDigest: registry.digest,
    scope: 'AC — prova estrutural; sem auditoria de reorganizações',
    audit,
  };
  writeFileSync(
    'packages/fixtures/history/reconciliation-ac.json',
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  store.close();
}
