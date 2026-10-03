import { readFileSync, writeFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { parseZoneRegistry } from '../packages/tse/src/zones';
import type { Segment } from '../packages/tse/src/zones';
import { structuralReconciliation } from '../packages/tse/src/reconciliation';
const db = new Database('data/history/atlas-history.sqlite', { readonly: true });
try {
  const registry = parseZoneRegistry(
    JSON.parse(readFileSync('packages/fixtures/zonal/official-ea12.json', 'utf8')),
    'official',
  );
  const imports = [2018, 2022].map((year) => {
    const rows = db
      .prepare('SELECT * FROM historical_import WHERE year=? ORDER BY captured_at DESC')
      .all(year) as any[];
    if (rows.length !== 1) throw Error('Import histórico ausente/ambíguo');
    return rows[0];
  });
  const historical = imports.map(
    (i) =>
      db
        .prepare('SELECT uf,municipality,zone FROM historical_segment WHERE import_id=?')
        .all(i.id) as Segment[],
  );
  const report = {
    capturedAt: new Date().toISOString(),
    registryDigest: registry.digest,
    imports,
    method: 'Inventário estrutural nacional; reorganizações não auditadas; nenhum match promovido',
    ...structuralReconciliation(registry.segments, historical[0], historical[1]),
  };
  writeFileSync('docs/evidence/national/reconciliation.json', JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        ...report,
        details: undefined,
        absent2018: report.absent2018.length,
        absent2022: report.absent2022.length,
        historicalOnly2018: report.historicalOnly2018.length,
        historicalOnly2022: report.historicalOnly2022.length,
      },
      null,
      2,
    ),
  );
} finally {
  db.close();
}
