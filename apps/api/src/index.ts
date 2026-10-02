import { createApp } from './app';
const { app } = await createApp({ dbPath: process.env.ATLAS_DB, logger: true });
await app.listen({ host: '127.0.0.1', port: 3001 });
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
