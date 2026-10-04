import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CandidateResult, Snapshot } from '../../../../packages/domain/src/index';
import { environments, type DashboardEnvironment, type EnvironmentConfig } from '../environment';
import RaceTrack, { type Runner } from './RaceTrack';
import SameZones, { SameZonesTrend } from './SameZones';
import UfMap from './UfMap';
import StateMosaic from './StateMosaic';
import ZoneFeed from './ZoneFeed';
import { useRotation } from './rotation';
import { mathFacts, type MathFact } from './facts';
import { Num, Rolling, duration, useAge, useFlash } from './motion';
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
  // One quarter turn of the ring per completed verification.
  const [checks, setChecks] = useState(0);
  useEffect(() => {
    if (t.lastOk) setChecks((n) => n + 1);
  }, [t.lastOk]);
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
  const rotation = useRotation(rotationIds, 7000, t.changes);

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
            <svg
              className="check-ring"
              viewBox="0 0 24 24"
              aria-hidden="true"
              style={{ transform: `rotate(${checks * 90}deg)` }}
            >
              <circle cx="12" cy="12" r="9" className="track" />
              <path d="M12 3a9 9 0 0 1 9 9" className="arc" />
            </svg>
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
            <aside className="t-left">
              <Outcomes facts={facts} heroes={runners.map((r) => r.candidate)} slotOf={slotOf} />
              <section className="t-totals" aria-label="Totais da apuração">
                <h2>Totais da apuração</h2>
                <Totals s={current} />
              </section>
              <section className="t-minor" aria-label="Indicadores e demais candidaturas">
                <Indicators s={current} leaders={leaders} series={t.series} />
                <Others others={others} />
              </section>
              <section className="t-same">
                <SameZones
                  comparison={t.comparison?.comparison ?? null}
                  timeline={t.comparison?.timeline ?? []}
                  synthetic={env.id !== 'official'}
                  showChart={false}
                  unavailable={
                    !env.comparison.available
                      ? env.comparison.summary
                      : t.comparisonError
                        ? 'Comparação indisponível no momento; o resultado agregado segue atualizado.'
                        : null
                  }
                />
              </section>
            </aside>

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
                  Meta ajustada · <Num value={race.toWin} format={int} />
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

            <aside className="t-right">
              <section className="t-map" aria-label="Mapa com foco rotativo por UF">
                <UfMap
                  rows={t.map}
                  focus={rotation.focus}
                  since={rotation.since}
                  ms={rotation.ms}
                  bulletin={rotation.bulletin}
                  slotOf={slotOf}
                  heroes={leaders}
                />
              </section>
              <ZoneFeed items={t.feed} heroes={runners.map((r) => r.candidate)} slotOf={slotOf} />
              <SameZonesTrend timeline={t.history} synthetic={env.id !== 'official'} />
            </aside>

            <StateMosaic
              rows={t.map}
              focus={rotation.focus}
              changes={t.changes}
              slotOf={slotOf}
              heroes={leaders}
            />
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
            faltam <Num value={missing} format={int} /> para a meta ajustada
          </>
        ) : (
          'passou da meta ajustada'
        )}
      </span>
    </div>
  );
}

/**
 * Possible outcomes, always on screen: faded while open, lit when the published count already
 * guarantees them (arithmetic facts, see facts.ts). Never a forecast.
 */
function Outcomes({
  facts,
  heroes,
  slotOf,
}: {
  facts: MathFact[];
  heroes: CandidateResult[];
  slotOf: (id: string) => Slot | undefined;
}) {
  const name = (c: CandidateResult) => (
    <b style={{ color: paint(slotOf(c.id)).main }}>{title(c.name)}</b>
  );
  const runoff = facts.some((f) => f.kind === 'runoff');
  const victory = facts.find((f) => f.kind === 'victory');
  const cards: { key: string; on: boolean; title: ReactNode; open: string }[] = [
    {
      key: 'runoff',
      on: runoff,
      title: '2º turno confirmado',
      open: 'alguém ainda pode passar de 50% dos válidos',
    },
    ...heroes.map((h) => ({
      key: `victory-${h.id}`,
      on: !!victory && victory.kind === 'victory' && victory.candidate.id === h.id,
      title: <>Vitória matemática: {name(h)}</>,
      open: 'votos abaixo da meta ajustada',
    })),
  ];
  if (victory && victory.kind === 'victory' && !heroes.some((h) => h.id === victory.candidate.id))
    cards.push({
      key: 'victory-other',
      on: true,
      title: <>Vitória matemática: {name(victory.candidate)}</>,
      open: '',
    });
  return (
    <section className="t-outcomes" aria-label="Desfechos possíveis">
      <div className="outcomes" aria-live="polite">
        {cards.map((c) => (
          <div key={c.key} className={`outcome card ${c.on ? 'on' : ''}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              {c.on && <path d="M7 12.5l3.4 3.4L17.5 8.6" />}
            </svg>
            <span className="o-title">{c.title}</span>
            <span className="o-sub">
              {c.on ? 'garantido pelos números publicados' : `em aberto: ${c.open}`}
            </span>
          </div>
        ))}
      </div>
      <small>
        Acendem só quando garantidos pelos números publicados · sujeitos a retificação · resultado
        oficial: TSE.
      </small>
    </section>
  );
}

function Totals({ s }: { s: Snapshot }) {
  const counted = s.votes.total;
  const absent = Math.max(0, s.electorate.installed - s.electorate.turnout);
  const of = (v: number | null, base: number | null) => (v === null || !base ? '' : pct(v / base));
  const cells: [string, number | null, string][] = [
    ['Eleitores aptos', s.electorate.total, ''],
    ['Seções apuradas', s.sections.totalized, `de ${int(s.sections.total)}`],
    [
      'Votos apurados · comparecimento',
      counted,
      s.electorate.installed ? of(s.electorate.turnout, s.electorate.installed) : '',
    ],
    ['Ausentes', absent, of(absent, s.electorate.installed)],
    ['Válidos', s.votes.valid, of(s.votes.valid, counted)],
    ['Brancos', s.votes.blank, of(s.votes.blank, counted)],
    ['Nulos', s.votes.null, of(s.votes.null, counted)],
    (s.votes.annulled ?? 0) > 0 || (s.votes.subJudice ?? 0) === 0
      ? ['Anulados', s.votes.annulled, of(s.votes.annulled, counted)]
      : ['Sub judice', s.votes.subJudice, of(s.votes.subJudice, counted)],
  ];
  return (
    <dl className="stats">
      {cells.map(([label, value, note]) => (
        <div key={label} className={label.startsWith('Votos apurados') ? 'key' : ''}>
          <dt>{label}</dt>
          <dd>
            <Num value={value} format={int} />
            {note && <small>{note}</small>}
          </dd>
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
  return (
    <dl className="minor">
      <div>
        <dt>Diferença</dt>
        <dd>
          <Num value={gap} format={int} />
          <small>
            {a && b && a.validShare !== null && b.validShare !== null
              ? pct(a.validShare - b.validShare)
              : ''}
          </small>
        </dd>
      </div>
      <div>
        <dt>Ritmo · 10 min</dt>
        <dd>
          <Num value={rate?.sections ?? null} format={(v) => `+${int(v)}`} />
          <small>{rate ? 'seções' : ''}</small>
        </dd>
      </div>
      <div>
        <dt>Eleitores a apurar</dt>
        <dd>
          <Num value={remaining} format={int} />
        </dd>
      </div>
    </dl>
  );
}

/** Other candidates, demoted to one line: name and share, largest first. */
function Others({ others }: { others: CandidateResult[] }) {
  const valid = others.filter((c) => c.validShare !== null);
  return (
    <p className="others-line">
      <span>Demais</span>{' '}
      {valid.map((c, i) => (
        <span key={c.id}>
          {i > 0 && ' · '}
          {title(c.name).split(' ').at(-1)} <Num value={c.validShare} format={(v) => pct(v)} />
        </span>
      ))}
    </p>
  );
}
