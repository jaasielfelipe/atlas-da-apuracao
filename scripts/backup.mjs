import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const source = resolve('data/atlas.sqlite');
if (!existsSync(source)) throw Error('Execute a aplicação antes de fazer backup');
mkdirSync('data/backups', { recursive: true });
const destination = resolve(
  'data/backups',
  `atlas-${new Date().toISOString().replaceAll(':', '-')}.sqlite`,
);
const db = new Database(source, { readonly: true });
try {
  await db.backup(destination);
  const copy = new Database(destination, { readonly: true });
  try {
    if (copy.pragma('integrity_check', { simple: true }) !== 'ok')
      throw Error('Falha de integridade do backup');
  } finally {
    copy.close();
  }
  console.log(`Backup SQLite consistente (inclui WAL): ${destination}`);
} finally {
  db.close();
}
