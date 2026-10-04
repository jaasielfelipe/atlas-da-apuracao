import { useLayoutEffect, useRef } from 'react';
import type { CandidateResult } from '../../../../packages/domain/src/index';
import { paint, type Slot } from './paint';
import type { ZoneFeedItem } from './useTelao';

const SHOWN = 5;
const int = (v: number) => new Intl.NumberFormat('pt-BR').format(Math.round(v));
const clock = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(iso));
const title = (name: string) =>
  name
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|\s)(\p{L})/gu, (_, s: string, l: string) => s + l.toLocaleUpperCase('pt-BR'));
const short = (name: string) => title(name).split(' ').at(-1);
const keyOf = (f: ZoneFeedItem) => `${f.uf}${f.municipality}${f.zone}${f.capturedAt}`;
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * "Results coming in": the latest município–zona units that counted new sections in this election,
 * with the 2026 votes each update added (heroes by identity, everyone else as "outros").
 * Vertical motion: new entries drop in at the top (briefly highlighted), the rest slide down
 * from where they were (FLIP), and the oldest fades out at the bottom edge.
 */
export default function ZoneFeed({
  items,
  heroes,
  slotOf,
}: {
  items: ZoneFeedItem[];
  heroes: CandidateResult[];
  slotOf: (id: string) => Slot | undefined;
}) {
  const shown = items.slice(0, SHOWN);
  const nodes = useRef(new Map<string, HTMLLIElement>());
  const tops = useRef(new Map<string, number>());
  const seen = useRef(new Set<string>());

  useLayoutEffect(() => {
    const next = new Map<string, number>();
    for (const f of shown) {
      const key = keyOf(f),
        el = nodes.current.get(key);
      if (!el) continue;
      const top = el.offsetTop;
      next.set(key, top);
      if (reduced()) continue;
      const before = tops.current.get(key);
      if (before === undefined) {
        // New entry: only animate once the feed had content (not on first paint).
        if (seen.current.size)
          el.animate(
            [
              { transform: 'translateY(-28px)', opacity: 0 },
              { transform: 'none', opacity: 1 },
            ],
            { duration: 700, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
          );
        if (seen.current.size) el.classList.add('new');
      } else if (before !== top) {
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'none' }], {
          duration: 700,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        });
      }
    }
    for (const f of shown) seen.current.add(keyOf(f));
    tops.current = next;
  });

  return (
    <section className="feed" aria-label="Últimas atualizações por zona">
      <h2>Chegando agora</h2>
      {shown.length === 0 ? (
        <p className="feed-empty">Nenhuma zona com seções novas apuradas ainda.</p>
      ) : (
        <ol>
          {shown.map((f) => {
            const heroVotes = heroes.map((h) => ({ h, v: f.added[h.id] ?? 0 }));
            const others = Math.max(0, f.validAdded - heroVotes.reduce((a, x) => a + x.v, 0));
            const key = keyOf(f);
            return (
              <li
                key={key}
                ref={(el) => {
                  if (el) nodes.current.set(key, el);
                  else nodes.current.delete(key);
                }}
              >
                <span className="when">{clock(f.capturedAt)}</span>
                <span className="where">
                  <b>
                    {f.municipalityName ? title(f.municipalityName) : `Município ${f.municipality}`}
                  </b>{' '}
                  {f.uf.toUpperCase()} · zona {Number(f.zone)}
                </span>
                <span className="secs">+{int(f.sections.added)} seções</span>
                {heroVotes.map(({ h, v }) => (
                  <span
                    key={h.id}
                    className="votes"
                    style={{ ['--mark' as string]: paint(slotOf(h.id)).main }}
                  >
                    <i />
                    {short(h.name)} +{int(v)}
                  </span>
                ))}
                <span className="votes rest">outros +{int(others)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
