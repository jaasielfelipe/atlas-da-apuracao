import { expect, it } from 'vitest';
import { ConservativeCollector } from './collector';
it('não sobrepõe HTTP e inicia pausa de 429 na conclusão da resposta', async () => {
  let now = 0;
  const c = new ConservativeCollector(500, 1000, () => now);
  c.add({ key: 'a', url: 'fixture:a', kind: 'zone', priority: 0 });
  let resolveResponse!: (r: { status: number; bytes: number }) => void;
  const pending = c.tick(
    0,
    () =>
      new Promise((resolve) => {
        resolveResponse = resolve;
      }),
  );
  now = 20000;
  expect(await c.tick(now, async () => ({ status: 200, bytes: 0 }))).toBeNull();
  resolveResponse({ status: 429, bytes: 0 });
  await pending;
  expect(c.snapshot().nextRequest).toBe(620000);
});
it('orçamento único inclui 304, cache condicional e suspensão 404', async () => {
  const c = new ConservativeCollector(500, 1000);
  c.add({ key: 'a', url: 'fixture:a', kind: 'zone', priority: 0 });
  const calls: Record<string, string>[] = [];
  await c.tick(0, async (_, h) => {
    calls.push(h);
    return { status: 200, bytes: 20, etag: '"a"' };
  });
  expect(await c.tick(499, async () => ({ status: 200, bytes: 0 }))).toBeNull();
  await c.tick(1000, async (_, h) => {
    calls.push(h);
    return { status: 304, bytes: 0 };
  });
  expect(calls[1]).toEqual({ 'If-None-Match': '"a"' });
  expect(c.stats.requests).toBe(2);
  await c.tick(2000, async () => ({ status: 404, bytes: 0 }));
  expect(await c.tick(900000, async () => ({ status: 200, bytes: 0 }))).toBeNull();
  expect(c.stats.requests).toBe(3);
});
it('favoritos não limitam expansão; remover interrompe apenas agregado municipal', async () => {
  const c = new ConservativeCollector(500, 1000);
  for (let i = 0; i < 10; i++)
    c.add({
      key: `z${i}`,
      url: `fixture:z${i}`,
      kind: 'zone',
      municipality: `ac:${i}`,
      priority: 0,
    });
  c.add({
    key: 'municipal',
    url: 'fixture:municipal',
    kind: 'aggregate',
    municipality: 'ac:0',
    priority: 30,
  });
  c.setFavorites(new Set(['ac:0']));
  const served = new Set<string>();
  for (let t = 0; t < 20000; t += 500)
    await c.tick(t, async (j) => {
      served.add(j.key);
      return { status: 200, bytes: 1 };
    });
  expect(served.size).toBe(11);
  c.setFavorites(new Set());
  expect(c.jobs.get('municipal')?.suspended).toBe(true);
  expect(c.jobs.get('z0')?.suspended).toBe(false);
});
it('429 suspende o orçamento global e falha de rede aplica backoff', async () => {
  const c = new ConservativeCollector();
  c.add({ key: 'a', url: 'fixture:a', kind: 'zone', priority: 0 });
  c.add({ key: 'b', url: 'fixture:b', kind: 'zone', priority: 0 });
  await c.tick(0, async () => ({ status: 429, bytes: 0 }));
  expect(await c.tick(599999, async () => ({ status: 200, bytes: 0 }))).toBeNull();
  await c.tick(600000, async () => {
    throw Error('offline');
  });
  expect(c.stats.errors).toBe(2);
  expect([...c.jobs.values()].some((j) => j.due > 600000)).toBe(true);
});
