import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
// pnpm backup [fixture|official|simulated|<path.sqlite>] — online SQLite backup, safe while the
// collector writes (includes WAL pages), verified with integrity_check.
const targets = {
  fixture: 'data/atlas.sqlite',
  official: 'data/official/collection.sqlite',
  simulated: 'data/simulated/collection.sqlite',
};
const argument = process.argv[2] ?? 'fixture';
const source = resolve(targets[argument] ?? argument);
if (!existsSync(source)) throw Error(`Banco inexistente: ${source}`);
mkdirSync('data/backups', { recursive: true });
const label = targets[argument] ? argument : basename(source, '.sqlite');
const destination = resolve(
  'data/backups',
  `${label === 'fixture' ? 'atlas' : label}-${new Date().toISOString().replaceAll(':', '-')}.sqlite`,
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
