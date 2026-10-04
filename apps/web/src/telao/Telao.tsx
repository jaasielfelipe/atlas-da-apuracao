import { useEffect, useMemo, useRef, useState } from 'react';
import type { Snapshot } from '../../../../packages/domain/src/index';
import { environments, type DashboardEnvironment } from '../environment';
import RaceTrack, { type Runner } from './RaceTrack';
import SameZones from './SameZones';
import { Rolling, duration, useAge, useFlash } from './motion';
import { paint, useSlots } from './paint';
import { increment, leaders as pickLeaders, pace, raceState } from './race';
import { useTelao } from './useTelao';
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

export default function Telao({ environment }: { environment: DashboardEnvironment }) {
  const env = environments[environment];
  const t = useTelao(env);
  const scale = useStageScale();
  const theme =
    new URLSearchParams(window.location.search).get('tema') === 'claro' ? 'light' : 'dark';
  const current = t.current,
    previous = t.previous;
  const leaders = useMemo(() => (current ? pickLeaders(current) : []), [current]);
  const slotOf = useSlots(leaders, t.comparison?.series);
  const fresh = useFlash(current?.digest);
  const age = useAge(t.lastOk);
  const bulletinAge = useAge(current ? Date.parse(current.capturedAt) : null);
  const running = t.status?.collection?.running;
  const live = useRef<HTMLDivElement>(null);

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
  const runners: Runner[] = leaders.map((c, i) => {
    const before = previous?.candidates.find((p) => p.id === c.id)?.countedVotes ?? null;
    const inc = increment(c.countedVotes ?? 0, before);
    return {
      candidate: c,
      slot: slotOf(c.id),
      votes: c.countedVotes ?? 0,
      from: inc.from,
      lane: i === 0 ? -8 : 8,
    };
  });
  // Lanes follow the candidate's slot, not the rank, so the drawing never swaps on a lead change.
  runners.sort((a, b) => (a.slot ?? 'z').localeCompare(b.slot ?? 'z'));
  runners.forEach((r, i) => (r.lane = i === 0 ? -8 : 8));
  const rate = pace(t.series);
  const remaining =
    current && current.electorate.total - current.electorate.totalized >= 0
      ? current.electorate.total - current.electorate.totalized
      : null;

  return (
    <div className="telao-viewport" data-theme={theme}>
      <div className="telao-stage" style={{ transform: `scale(${scale})` }}>
        <header className="t-top">
          <div className="t-brand">
            <strong>ATLAS DA APURAÇÃO</strong>
            <span>Presidente · 1º turno · Brasil</span>
          </div>
          <span className={`t-badge ${env.id}`}>{env.badge}</span>
          {env.id !== 'official' && <span className="t-warning">{env.notice.text}</span>}
          <div className={`t-live ${fresh ? 'fresh' : ''} ${t.error ? 'stale' : ''}`} ref={live}>
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
                {bulletinAge !== null && ` · capturado há ${duration(bulletinAge)}`}
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
            <section className="card race" aria-label="Corrida pela maioria absoluta">
              <div className="race-head">
                {runners.length === 0 && (
                  <p className="race-waiting">
                    Aguardando os primeiros votos válidos apurados para posicionar as candidaturas.
                  </p>
                )}
                {runners.map((r) => {
                  const p = paint(r.slot);
                  const delta = r.votes - r.from;
                  const missing = Math.max(0, race.toWin - r.votes);
                  return (
                    <div key={r.candidate.id} className="race-runner">
                      <span className="name" style={{ color: p.main }}>
                        {r.candidate.name}
                      </span>
                      <Rolling value={r.votes} format={int} className="votes" />
                      <span className="share">
                        {r.candidate.validShare === null ? '—' : pct(r.candidate.validShare)} dos
                        válidos
                        {previous && (
                          <em key={current.digest} className="inc" style={{ background: p.soft }}>
                            +{int(delta)}
                          </em>
                        )}
                      </span>
                      <span className="distance">
                        {missing > 0
                          ? `faltam ${int(missing)} para a meta ajustada`
                          : 'passou da meta ajustada'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <RaceTrack
                race={race}
                previousTarget={previousRace ? previousRace.target : null}
                runners={runners}
              />
              <ul className="race-legend">
                <li>
                  <i className="sw fixed" />
                  50% dos aptos: {int(race.fixedLine)}
                </li>
                <li>
                  <i className="sw target" />
                  Meta ajustada: <Rolling value={race.toWin} format={int} />
                </li>
                <li>Abstenções: {int(race.abstentions)}</li>
                <li>Brancos e nulos: {int(race.blankNull)}</li>
                <li>Outros candidatos: {int(race.others)}</li>
              </ul>
              <p className="race-note">
                Pista fixa de 0 a 55% dos eleitores aptos, em votos. Meta ajustada = metade dos
                votos válidos ainda possíveis (aptos − abstenções − brancos − nulos − anulados
                apurados); recua a cada boletim. Trecho claro: último boletim.
              </p>
            </section>

            <div className="t-col">
              <Scoreboard snapshot={current} previous={previous} slotOf={slotOf} />
              <section className="card facts" aria-label="Indicadores da apuração">
                <Fact label="Diferença 1º – 2º">
                  {leaders.length === 2 ? (
                    <>
                      <Rolling
                        value={(leaders[0].countedVotes ?? 0) - (leaders[1].countedVotes ?? 0)}
                        format={int}
                      />
                      <small>
                        {leaders[0].validShare !== null && leaders[1].validShare !== null
                          ? `${pct(leaders[0].validShare - leaders[1].validShare)} dos válidos`
                          : '—'}
                      </small>
                    </>
                  ) : (
                    '—'
                  )}
                </Fact>
                <Fact label="Ritmo (10 min)">
                  {rate ? (
                    <>
                      +{int(rate.sections)} seções
                      <small>
                        {rate.share === null ? '—' : `+${pct(rate.share / 100, 2)}`} em{' '}
                        {Math.round(rate.minutes)} min
                      </small>
                    </>
                  ) : (
                    <>
                      —<small>aguardando dois boletins</small>
                    </>
                  )}
                </Fact>
                <Fact label="Eleitores em seções não apuradas">
                  <Rolling value={remaining} format={int} />
                  <small>dado do TSE; não é previsão de votos</small>
                </Fact>
                <Fact label="Comparecimento apurado">
                  <Rolling value={current.electorate.turnoutShare} format={(v) => pct(v)} />
                  <small>nas seções instaladas</small>
                </Fact>
              </section>
            </div>

            <div className="t-col">
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
            </div>

            <UfStrip rows={t.map} slotOf={slotOf} leaderIds={leaders.map((l) => l.id)} />
          </main>
        )}
        <div className="sr-only" aria-live="polite">
          {current &&
            `${runners.map((r) => `${r.candidate.name}: ${int(r.votes)} votos`).join('; ')}. ` +
              `Meta ajustada ${int(race?.toWin ?? 0)}. Seções apuradas ${pct(current.sections.share ?? 0, 2)}.`}
        </div>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function Scoreboard({
  snapshot,
  previous,
  slotOf,
}: {
  snapshot: Snapshot;
  previous: Snapshot | null;
  slotOf: (id: string) => 'a' | 'b' | undefined;
}) {
  const rows = [...snapshot.candidates].sort(
    (a, b) => (b.countedVotes ?? -1) - (a.countedVotes ?? -1),
  );
  return (
    <section className="card board" aria-label="Votos por candidatura">
      <header className="card-head">
        <h2>Votos válidos</h2>
        <Rolling value={snapshot.votes.valid} format={int} className="muted" />
      </header>
      <ol>
        {rows.map((c) => {
          const p = paint(slotOf(c.id));
          const before = previous?.candidates.find((x) => x.id === c.id)?.validShare ?? null;
          const delta =
            c.validShare !== null && before !== null ? (c.validShare - before) * 100 : null;
          return (
            <li key={c.id} className={c.validShare === null ? 'void' : ''}>
              <span className="nm">
                <b>{c.number}</b> {c.name}
              </span>
              <span className="bar">
                <span
                  style={{
                    width: `${Math.min(100, ((c.validShare ?? 0) / 0.6) * 100)}%`,
                    background: p.main,
                  }}
                />
                <i className="half" title="50% dos válidos apurados" />
              </span>
              <span className="sh">
                {c.validShare === null ? (
                  <span title={c.destination ?? ''}>—</span>
                ) : (
                  <Rolling value={c.validShare} format={(v) => pct(v)} />
                )}
              </span>
              <span className="dl">
                {delta === null
                  ? ''
                  : `${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${Math.abs(delta).toFixed(1).replace('.', ',')}`}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="note">
        Escala 0–60%. Marca: 50% dos válidos apurados. Δ em p.p. desde o boletim anterior.
      </p>
    </section>
  );
}

function UfStrip({
  rows,
  slotOf,
  leaderIds,
}: {
  rows: { territoryId: string; snapshot: Snapshot | null }[];
  slotOf: (id: string) => 'a' | 'b' | undefined;
  leaderIds: string[];
}) {
  const ufs = rows.filter((r) => r.territoryId.length === 2 && r.territoryId !== 'zz');
  return (
    <section className="card ufs" aria-label="Apuração por UF">
      {ufs.map((r) => {
        const s = r.snapshot;
        const top = s
          ? [...s.candidates]
              .filter((c) => c.validShare !== null)
              .sort((a, b) => (b.countedVotes ?? 0) - (a.countedVotes ?? 0))
          : [];
        const lead =
          top.length > 1 && top[0].validShare !== null && top[1].validShare !== null
            ? (top[0].validShare - top[1].validShare) * 100
            : null;
        const slot = top[0] && leaderIds.includes(top[0].id) ? slotOf(top[0].id) : undefined;
        return (
          <div key={r.territoryId} className="uf" title={top[0]?.name}>
            <span className="code">{r.territoryId.toUpperCase()}</span>
            <span className="meter">
              <span style={{ width: `${(s?.sections.share ?? 0) * 100}%` }} />
            </span>
            <span className="val">
              {s?.sections.share == null ? '—' : pct(s.sections.share, 0)}
            </span>
            <span className="lead">
              <i style={{ background: s ? paint(slot).main : 'transparent' }} />
              {lead === null ? '—' : `+${lead.toFixed(1).replace('.', ',')}`}
            </span>
          </div>
        );
      })}
    </section>
  );
}
