import { expect, it } from 'vitest';
import { Store } from '../db/store';
import { PersistentCollector } from './collector';
it('reinício preserva ETag, corpo deduplicado, cota, observações e suspensão 404', async () => {
  const store = new Store(':memory:');
  let now = 1000000;
  try {
    let collector = new PersistentCollector(store, () => now);
    collector.queue.add({ key: 'a', url: 'fixture:a', kind: 'zone', priority: 0 });
    await collector.tick(async () => ({ status: 200, bytes: 2, raw: '{}', etag: 'e1' }));
    collector = new PersistentCollector(store, () => now);
    expect(collector.cached('a')).toBe('{}');
    expect(collector.queue.stats.requests).toBe(1);
    expect(
      await collector.tick(async () => {
        throw Error('Não deve chamar antes da cota');
      }),
    ).toBeNull();
    now += 60000;
    await collector.tick(async (_, headers) => {
      expect(headers).toEqual({ 'If-None-Match': 'e1' });
      return { status: 304, bytes: 0 };
    });
    now += 60000;
    await collector.tick(async () => ({ status: 200, bytes: 2, raw: '{}', etag: 'e1' }));
    expect(store.db.prepare('SELECT COUNT(*) n FROM collector_body').get()).toEqual({ n: 1 });
    expect(store.db.prepare('SELECT COUNT(*) n FROM collector_observation').get()).toEqual({
      n: 3,
    });
    now += 60000;
    await collector.tick(async () => ({ status: 404, bytes: 0 }));
    collector = new PersistentCollector(store, () => now);
    collector.queue.setFavorites(new Set(['a']));
    now += 900000;
    expect(await collector.tick(async () => ({ status: 200, bytes: 2, raw: '{}' }))).toBeNull();
    expect(collector.queue.stats.requests).toBe(4);
  } finally {
    store.close();
  }
});
it('pausa global por 429 sobrevive reinício e 304 sem corpo anterior falha fechado', async () => {
  const store = new Store(':memory:');
  let now = 1000000;
  try {
    let collector = new PersistentCollector(store, () => now);
    for (const key of ['a', 'b'])
      collector.queue.add({ key, url: `fixture:${key}`, kind: 'zone', priority: 0 });
    await collector.tick(async () => ({ status: 429, bytes: 0 }));
    collector = new PersistentCollector(store, () => now);
    now += 599999;
    expect(await collector.tick(async () => ({ status: 200, bytes: 2, raw: '{}' }))).toBeNull();
    now += 1;
    expect(await collector.tick(async () => ({ status: 304, bytes: 0 }))).toMatchObject({
      status: 0,
    });
    expect(store.db.prepare('SELECT COUNT(*) n FROM collector_cache').get()).toEqual({ n: 0 });
    expect(
      store.db.prepare('SELECT error FROM collector_observation ORDER BY id DESC LIMIT 1').get(),
    ).toEqual({ error: '304 sem cache validado' });
  } finally {
    store.close();
  }
});

it('grava só o job alterado em fila nacional e mantém versões imutáveis no replay', async () => {
  const store = new Store(':memory:');
  let now = 1000000;
  try {
    const c = new PersistentCollector(store, () => now);
    for (let i = 0; i < 6292; i++)
      c.queue.add({ key: String(i), url: `fixture:${i}`, kind: 'zone', priority: 0 });
    c.save();
    store.db.exec(
      'CREATE TABLE writes(key TEXT); CREATE TRIGGER log_job_update AFTER UPDATE ON collector_job BEGIN INSERT INTO writes VALUES(new.key); END;',
    );
    await c.tick(async () => ({ status: 200, bytes: 1, raw: 'A' }));
    expect(store.db.prepare('SELECT COUNT(*) n FROM writes').get()).toEqual({ n: 2 });
    const key = (store.db.prepare('SELECT key FROM writes LIMIT 1').get() as { key: string }).key;
    now += 500;
    c.queue.hint(key, now);
    c.queue.jobs.get(key)!.priority = 100;
    await c.tick(async () => ({ status: 200, bytes: 1, raw: 'B' }));
    expect(c.captured(key, new Date(now - 1).toISOString())).toBe('A');
    expect(c.captured(key, new Date(now).toISOString())).toBe('B');
    now += 500;
    c.queue.hint(key, now);
    await c.tick(async () => ({ status: 503, bytes: 0 }));
    expect(c.cached(key)).toBe('B');
    expect(() => store.db.exec('DELETE FROM collector_observation')).toThrow('imutável');
  } finally {
    store.close();
  }
});
it('loop usa lease único e drena HTTP antes de liberar proprietário', async () => {
  const store = new Store(':memory:');
  const stop = new AbortController();
  try {
    const a = new PersistentCollector(store);
    const b = new PersistentCollector(store);
    a.queue.add({ key: 'br', url: 'fixture:br', kind: 'aggregate', priority: 0 });
    let finish!: () => void;
    const running = a.run(async () => {
      await new Promise<void>((r) => (finish = r));
      return { status: 200, bytes: 2, raw: '{}' };
    }, stop.signal);
    await expect(b.tick(async () => ({ status: 200, bytes: 0 }))).rejects.toThrow('Outro coletor');
    expect(() => b.save()).toThrow('Outro coletor');
    stop.abort();
    finish();
    await running;
    expect(store.db.prepare('SELECT COUNT(*) n FROM collector_owner').get()).toEqual({ n: 0 });
  } finally {
    store.close();
  }
});
