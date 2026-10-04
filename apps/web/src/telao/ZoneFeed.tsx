import type { CandidateResult } from '../../../../packages/domain/src/index';
import { paint, type Slot } from './paint';
import type { ZoneFeedItem } from './useTelao';

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

/**
 * "Results coming in": the latest município–zona units that counted new sections in this election,
 * with the 2026 votes each update added (heroes by identity, everyone else as "outros").
 * Newest first; each new entry slides in.
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
  return (
    <section className="feed" aria-label="Últimas atualizações por zona">
      <h2>Chegando agora</h2>
      {items.length === 0 ? (
        <p className="feed-empty">Nenhuma zona com seções novas apuradas ainda.</p>
      ) : (
        <ol>
          {items.slice(0, 5).map((f) => {
            const heroVotes = heroes.map((h) => ({ h, v: f.added[h.id] ?? 0 }));
            const others = Math.max(0, f.validAdded - heroVotes.reduce((a, x) => a + x.v, 0));
            return (
              <li key={`${f.uf}${f.municipality}${f.zone}${f.capturedAt}`}>
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
