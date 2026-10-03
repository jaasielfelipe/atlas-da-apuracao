import { createApp } from './app';
// ATLAS_DB: fixture database. OFFICIAL_DB / SIMULATED_DB / HISTORY_DB override the collector and
// history databases (tests and alternate archives); defaults live under data/.
const { app } = await createApp({
  dbPath: process.env.ATLAS_DB,
  officialDbPath: process.env.OFFICIAL_DB,
  simulatedDbPath: process.env.SIMULATED_DB,
  historyDbPath: process.env.HISTORY_DB,
  logger: true,
});
await app.listen({ host: '127.0.0.1', port: 3001 });
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
