import { useEffect, useMemo, useState } from 'react';
import type { CandidateResult, Snapshot } from '../../../../packages/domain/src/index';
import { environments, type DashboardEnvironment, type EnvironmentConfig } from '../environment';
import RaceTrack, { type Runner } from './RaceTrack';
import SameZones from './SameZones';
import UfMap from './UfMap';
import StateMosaic from './StateMosaic';
import { useRotation } from './rotation';
import { mathFacts, type MathFact } from './facts';
import { Rolling, duration, useAge, useFlash } from './motion';
import { paint, useSlots, type Slot } from './paint';
import { increment, leaders as pickLeaders, pace, raceState } from './race';
import { useDemo, useTelao, type Telao as TelaoData } from './useTelao';
import type { DemoScenario } from './demo';
import './telao.css';

const int = (v: number) => new Intl.NumberFormat('pt-BR').format(Math.round(v));
const pct = (v: number, digits = 1) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v * 100) + '%';
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

/** Fixed 1920×1080 stage scaled to the window: the layout never reflows on the big screen. */
function useStageScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return scale;
}

/** Route entry: `?demo` (fixture only) plays a synthetic count to show the motion. */
export default function Telao({ environment }: { environment: DashboardEnvironment }) {
  const query = new URLSearchParams(window.location.search);
  if (environment === 'fixture' && query.has('demo')) {
    const scenario: DemoScenario = query.get('demo') === 'vitoria' ? 'vitoria' : 'segundo-turno';
    const pace = Math.max(800, Math.min(10_000, Number(query.get('ritmo')) || 3000));
    return <DemoTelao scenario={scenario} intervalMs={pace} />;
  }
  return <LiveTelao env={environments[environment]} />;
}
function LiveTelao({ env }: { env: EnvironmentConfig }) {
  return <TelaoView env={env} data={useTelao(env)} />;
}
function DemoTelao({ scenario, intervalMs }: { scenario: DemoScenario; intervalMs: number }) {
  const env: EnvironmentConfig = {
    ...environments.fixture,
    badge: 'DEMONSTRAÇÃO',
    notice: {
      strong: 'Demonstração.',
      text: 'Apuração sintética gerada no navegador para mostrar o movimento. Não são resultados.',
    },
  };
  return <TelaoView env={env} data={useDemo(scenario, intervalMs)} />;
}

function TelaoView({ env, data: t }: { env: EnvironmentConfig; data: TelaoData }) {
  const scale = useStageScale();
  const theme =
    new URLSearchParams(window.location.search).get('tema') === 'claro' ? 'light' : 'dark';
  const current = t.current,
    previous = t.previous;
  const series = t.comparison?.series;
  // Heroes: the two series candidates when their identities are known (official: Lula and
  // Flávio, even before the first vote); otherwise the two leading candidates.
  const leaders = useMemo(() => {
    if (!current) return [];
    const byId = (id?: string) => current.candidates.find((c) => c.id === id);
    const known = [byId(series?.bolsonaro.id), byId(series?.lula_haddad.id)];
    return known[0] && known[1] ? (known as CandidateResult[]) : pickLeaders(current);
  }, [current, series]);
  const slotOf = useSlots(leaders, t.comparison?.series);
  const fresh = useFlash(current?.digest);
  const age = useAge(t.lastOk);
  const bulletinAge = useAge(current ? Date.parse(current.capturedAt) : null);
  const running = t.status?.collection?.running;
  const facts = useMemo(() => (current ? mathFacts(current) : []), [current]);
  // Rotating focus shared by the map and the mosaic, largest electorates first.
  const rotationIds = useMemo(
    () =>
      t.map
        .filter((r) => r.snapshot && r.territoryId !== 'zz')
        .sort((a, b) => b.snapshot!.electorate.total - a.snapshot!.electorate.total)
        .map((r) => r.territoryId),
    [t.map],
  );
  const rotation = useRotation(rotationIds);

  const race = current
    ? raceState(
        current,
        leaders.map((l) => l.id),
      )
    : null;
  const previousRace = previous
    ? raceState(
        previous,
        leaders.map((l) => l.id),
      )
    : null;
  const runners: Runner[] = leaders
    .map((c) => {
      const before = previous?.candidates.find((p) => p.id === c.id)?.countedVotes ?? null;
      return {
        candidate: c,
        slot: slotOf(c.id),
        votes: c.countedVotes ?? 0,
        from: increment(c.countedVotes ?? 0, before).from,
        lane: -8 as -8 | 8,
      };
    })
    // Lanes and columns follow the candidate's slot, not the rank: a lead change never swaps them.
    .sort((a, b) => (a.slot ?? 'z').localeCompare(b.slot ?? 'z'))
    .map((r, i) => ({ ...r, lane: (i === 0 ? -8 : 8) as -8 | 8 }));
  const others = current
    ? [...current.candidates]
        .filter((c) => !leaders.some((l) => l.id === c.id))
        .sort((a, b) => (b.countedVotes ?? -1) - (a.countedVotes ?? -1))
    : [];

  return (
    <div className="telao-viewport" data-theme={theme}>
      <div className="telao-stage" style={{ transform: `scale(${scale})` }}>
        <header className="t-top">
          <div className="t-brand">
            <strong>ATLAS DA APURAÇÃO</strong>
            <span>Presidente · 1º turno · Brasil</span>
          </div>
          <div className="t-env">
            <span className={`t-badge ${env.id}`}>{env.badge}</span>
            {env.id !== 'official' && <span className="t-warning">{env.notice.text}</span>}
          </div>
          <div className={`t-live ${fresh ? 'fresh' : ''} ${t.error ? 'stale' : ''}`}>
            <span className="pulse" aria-hidden="true" />
            <div>
              <strong>
                {t.error
                  ? 'Sem conexão local — último dado preservado'
                  : fresh
                    ? 'Novo boletim'
                    : running === false
                      ? 'Coletor parado'
                      : 'Ao vivo'}
              </strong>
              <small>
                {current ? `boletim TSE ${clock(current.sourceGeneratedAt)}` : 'aguardando boletim'}
                {bulletinAge !== null && ` · há ${duration(bulletinAge)}`}
                {age !== null && ` · verificado há ${duration(age)}`}
              </small>
            </div>
          </div>
          <div className="t-counted">
            <span>Seções apuradas</span>
            <Rolling
              value={current?.sections.share ?? null}
              format={(v) => pct(v, 2)}
              className="big"
            />
          </div>
          <div className="t-progress" aria-hidden="true">
            <span style={{ width: `${(current?.sections.share ?? 0) * 100}%` }} />
          </div>
        </header>

        {!current || !race ? (
          <main className="t-empty">
            <p>{t.error || 'Aguardando o primeiro boletim nacional do TSE.'}</p>
          </main>
        ) : (
          <main className="t-main">
            <Facts facts={facts} slotOf={slotOf} />

            <section className="t-hero" aria-label="Corrida pela maioria absoluta">
              <div className="race-head">
                {runners.length === 0 && (
                  <p className="race-waiting">
                    Aguardando os primeiros votos válidos apurados para posicionar as candidaturas.
                  </p>
                )}
                {runners.map((r) => (
                  <RunnerHead
                    key={r.candidate.id}
                    r={r}
                    toWin={race.toWin}
                    hasPrevious={!!previous}
                    digest={current.digest}
                  />
                ))}
              </div>
              <RaceTrack
                race={race}
                previousTarget={previousRace ? previousRace.target : null}
                runners={runners}
              />
              <ul className="race-legend">
                <li>
                  <i className="sw fixed" />
                  50% dos aptos · {int(race.fixedLine)}
                </li>
                <li>
                  <i className="sw target" />
                  Meta ajustada · <Rolling value={race.toWin} format={int} />
                </li>
                <li>
                  <i className="sw inc" />
                  último boletim
                </li>
              </ul>
              <p className="race-note">
                Pista: 0–55% dos eleitores aptos, em votos. Meta ajustada: metade dos válidos ainda
                possíveis; recua a cada boletim.
              </p>
            </section>

            <section className="t-totals" aria-label="Totais da apuração">
              <h2>Totais da apuração</h2>
              <Totals s={current} />
              <h2 className="sub">Indicadores</h2>
              <Indicators s={current} leaders={leaders} series={t.series} />
              <h2 className="sub">Demais candidaturas</h2>
              <ol className="others">
                {others.slice(0, 3).map((c) => (
                  <li key={c.id} className={c.validShare === null ? 'void' : ''}>
                    <span className="nm">
                      <b>{c.number}</b> {title(c.name)}
                    </span>
                    <span className="sh">
                      {c.validShare === null ? (
                        <span title={c.destination ?? ''}>—</span>
                      ) : (
                        <Rolling value={c.validShare} format={(v) => pct(v)} />
                      )}
                    </span>
                    <span className="vt">
                      {c.countedVotes === null ? (
                        '—'
                      ) : (
                        <Rolling value={c.countedVotes} format={int} />
                      )}
                    </span>
                  </li>
                ))}
                {others.length > 3 && (
                  <li className="more">
                    <span className="nm">e mais {others.length - 3} candidaturas</span>
                    <span className="sh">
                      {pct(others.slice(3).reduce((a, c) => a + (c.validShare ?? 0), 0))}
                    </span>
                    <span className="vt">
                      {int(others.slice(3).reduce((a, c) => a + (c.countedVotes ?? 0), 0))}
                    </span>
                  </li>
                )}
              </ol>
            </section>

            <section className="t-map" aria-label="Mapa com foco rotativo por UF">
              <UfMap
                rows={t.map}
                focus={rotation.focus}
                since={rotation.since}
                ms={rotation.ms}
                slotOf={slotOf}
                heroes={leaders}
              />
            </section>

            <section className="t-same">
              <SameZones
                comparison={t.comparison?.comparison ?? null}
                timeline={t.comparison?.timeline ?? []}
                synthetic={env.id !== 'official'}
                unavailable={
                  !env.comparison.available
                    ? env.comparison.summary
                    : t.comparisonError
                      ? 'Comparação indisponível no momento; o resultado agregado segue atualizado.'
                      : null
                }
              />
            </section>

            <StateMosaic rows={t.map} focus={rotation.focus} slotOf={slotOf} heroes={leaders} />
          </main>
        )}
        <div className="sr-only" aria-live="polite">
          {current &&
            `${runners.map((r) => `${r.candidate.name}: ${int(r.votes)} votos`).join('; ')}. ` +
              `Seções apuradas ${pct(current.sections.share ?? 0, 2)}.`}
        </div>
      </div>
    </div>
  );
}

function RunnerHead({
  r,
  toWin,
  hasPrevious,
  digest,
}: {
  r: Runner;
  toWin: number;
  hasPrevious: boolean;
  digest: string;
}) {
  const p = paint(r.slot);
  const delta = r.votes - r.from;
  const missing = Math.max(0, toWin - r.votes);
  return (
    <div
      className="race-runner"
      style={{ ['--mark' as string]: p.main, ['--soft' as string]: p.soft }}
    >
      <span className="name">{title(r.candidate.name)}</span>
      <Rolling value={r.votes} format={int} className="votes" />
      <span className="share">
        <Rolling value={r.candidate.validShare} format={(v) => pct(v)} className="pct" />
        <small>dos válidos</small>
        {hasPrevious && (
          <em key={digest} className="inc">
            +{int(delta)}
          </em>
        )}
      </span>
      <span className="distance">
        {missing > 0 ? (
          <>
            faltam <Rolling value={missing} format={int} /> para a meta ajustada
          </>
        ) : (
          'passou da meta ajustada'
        )}
      </span>
    </div>
  );
}

/** Facts the published count already guarantees; shown only when true. */
function Facts({ facts, slotOf }: { facts: MathFact[]; slotOf: (id: string) => Slot | undefined }) {
  const name = (c: CandidateResult) => (
    <b style={{ color: paint(slotOf(c.id)).main }}>{title(c.name)}</b>
  );
  return (
    <div className="t-facts" aria-live="polite">
      {facts.map((f) => (
        <div key={f.kind} className={`fact-chip ${f.kind}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12.5l4.2 4.2L19 7" />
          </svg>
          {f.kind === 'victory' ? (
            <span>Vitória matemática no 1º turno: {name(f.candidate)}</span>
          ) : f.kind === 'finalists' ? (
            <span>
              {name(f.candidates[0])} e {name(f.candidates[1])} no 2º turno
            </span>
          ) : (
            <span>2º turno confirmado</span>
          )}
        </div>
      ))}
      {facts.length > 0 && (
        <small>
          Fatos aritméticos sobre os números publicados, válidos para qualquer resultado das seções
          restantes; sujeitos a retificação. O resultado oficial é proclamado pelo TSE.
        </small>
      )}
    </div>
  );
}

function Totals({ s }: { s: Snapshot }) {
  const counted = s.votes.total;
  const absent = Math.max(0, s.electorate.installed - s.electorate.turnout);
  const of = (v: number | null, base: number | null) => (v === null || !base ? '' : pct(v / base));
  const rows: [string, number | null, string][] = [
    ['Eleitores aptos', s.electorate.total, ''],
    ['Seções apuradas', s.sections.totalized, `de ${int(s.sections.total)}`],
    [
      'Votos apurados',
      counted,
      s.electorate.installed
        ? `comparecimento ${of(s.electorate.turnout, s.electorate.installed)}`
        : '',
    ],
    ['Ausentes', absent, of(absent, s.electorate.installed)],
    ['Válidos', s.votes.valid, of(s.votes.valid, counted)],
    ['Brancos', s.votes.blank, of(s.votes.blank, counted)],
    ['Nulos', s.votes.null, of(s.votes.null, counted)],
  ];
  if ((s.votes.annulled ?? 0) > 0)
    rows.push(['Anulados', s.votes.annulled, of(s.votes.annulled, counted)]);
  if ((s.votes.subJudice ?? 0) > 0)
    rows.push(['Sub judice', s.votes.subJudice, of(s.votes.subJudice, counted)]);
  return (
    <dl className="totals">
      {rows.map(([label, value, note]) => (
        <div key={label} className={label === 'Votos apurados' ? 'key' : ''}>
          <dt>{label}</dt>
          <dd>
            <Rolling value={value} format={int} />
          </dd>
          <span className="note">{note}</span>
        </div>
      ))}
    </dl>
  );
}

function Indicators({
  s,
  leaders,
  series,
}: {
  s: Snapshot;
  leaders: CandidateResult[];
  series: Snapshot[];
}) {
  const rate = pace(series);
  const remaining = Math.max(0, s.electorate.total - s.electorate.totalized);
  // Between the two heroes, whatever their order.
  const [a, b] = [...leaders].sort((x, y) => (y.countedVotes ?? 0) - (x.countedVotes ?? 0));
  const gap =
    a && b && (a.countedVotes ?? 0) > 0 ? (a.countedVotes ?? 0) - (b.countedVotes ?? 0) : null;
  const gapShare =
    a && b && a.validShare !== null && b.validShare !== null
      ? `${pct(a.validShare - b.validShare)} dos válidos`
      : '';
  return (
    <dl className="totals indicators">
      <div>
        <dt>Diferença</dt>
        <dd>
          <Rolling value={gap} format={int} />
        </dd>
        <span className="note">{gapShare}</span>
      </div>
      <div>
        <dt>Ritmo (10 min)</dt>
        <dd>{rate ? <Rolling value={rate.sections} format={(v) => `+${int(v)}`} /> : '—'}</dd>
        <span className="note">
          {rate
            ? `seções · ${rate.share === null ? '—' : '+' + pct(rate.share / 100, 2)}`
            : 'aguardando boletins'}
        </span>
      </div>
      <div>
        <dt>Eleitores a apurar</dt>
        <dd>
          <Rolling value={remaining} format={int} />
        </dd>
        <span className="note">seções não apuradas</span>
      </div>
    </dl>
  );
}
