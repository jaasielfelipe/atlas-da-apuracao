import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Bootstrap, Layer, Office, Snapshot } from '../../../packages/domain/src/index';
import AtlasMap from './map/AtlasMap';
import TimelineChart from './charts/TimelineChart';
import ZoneComparison from './charts/ZoneComparison';
import { api, candidateColor, dateTime, integer, percent, time } from './format';

type View = { snapshot: Snapshot | null; monitoring: boolean; status: string };
type MapRow = { territoryId: string; snapshot: Snapshot | null };
const layers: { id: Layer; name: string; number: string }[] = [
  { id: 'result', name: 'Resultado', number: '01' },
  { id: 'coverage', name: 'Cobertura', number: '02' },
  { id: 'comparison', name: 'Comparação', number: '03' },
];
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function Metric({ name, value, detail }: { name: string; value: string; detail: string }) {
  return (
    <div className="metric" title={detail}>
      <span>{name}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
export default function App() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null),
    [error, setError] = useState('');
  const [territoryId, setTerritory] = useState('br'),
    [office, setOffice] = useState<Office>('president'),
    [layer, setLayer] = useState<Layer>('result');
  const [at, setAt] = useState<string | null>(null),
    [playing, setPlaying] = useState(false),
    [scale, setScale] = useState<'time' | 'progress'>('time'),
    [metric, setMetric] = useState<'share' | 'votes'>('share');
  const [view, setView] = useState<View | null>(null),
    [snapshots, setSnapshots] = useState<Snapshot[]>([]),
    [rows, setRows] = useState<MapRow[]>([]);
  const [search, setSearch] = useState(''),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const b = await api<Bootstrap>('/api/v1/bootstrap');
    setBootstrap(b);
    setRevision((n) => n + 1);
  }, []);
  useEffect(() => {
    refresh().catch((e) => {
      setError(e.message);
      setLoading(false);
    });
  }, [refresh]);
  const territory = bootstrap?.territories.find((t) => t.id === territoryId);
  useEffect(() => {
    if (!bootstrap || !territory) return;
    let active = true;
    setLoading(true);
    const query = new URLSearchParams({ office, territory: territoryId, ...(at ? { at } : {}) });
    const mapQuery = new URLSearchParams({
      office,
      territory: territory.uf ?? 'br',
      ...(at ? { at } : {}),
    });
    Promise.all([
      api<View>(`/api/v1/latest?${query}`),
      api<Snapshot[]>(
        `/api/v1/snapshots?${new URLSearchParams({ office, territory: territoryId })}`,
      ),
      api<MapRow[]>(`/api/v1/map?${mapQuery}`),
    ])
      .then(([v, series, map]) => {
        if (active) {
          setView(v);
          setSnapshots(series);
          setRows(map);
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [territoryId, office, at, revision, bootstrap, territory]);
  useEffect(() => {
    if (!playing || !bootstrap) return;
    const timer = window.setInterval(() => {
      setAt((previous) => {
        const index = bootstrap.captures.indexOf(previous ?? '');
        if (index + 1 >= bootstrap.captures.length) {
          setPlaying(false);
          return previous;
        }
        return bootstrap.captures[index + 1];
      });
    }, 1300);
    return () => window.clearInterval(timer);
  }, [playing, bootstrap]);
  const select = useCallback((id: string) => {
    setTerritory(id);
    setSearch('');
    setView(null);
    setRows([]);
    setSnapshots([]);
  }, []);
  const selectTime = useCallback((instant: string) => {
    setAt(instant);
    setPlaying(false);
  }, []);
  const candidates = useMemo(
    () =>
      [...(view?.snapshot?.candidates ?? [])].sort(
        (a, b) => (b.countedVotes ?? -1) - (a.countedVotes ?? -1),
      ),
    [view],
  );
  const hits = useMemo(
    () =>
      search.length < 2
        ? []
        : (bootstrap?.territories ?? [])
            .filter(
              (t) => t.kind === 'municipality' && normalize(t.name).includes(normalize(search)),
            )
            .slice(0, 7),
    [search, bootstrap],
  );
  async function mutate(url: string, method: string, body?: unknown) {
    setBusy(true);
    try {
      await api(url, method, body);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!bootstrap || !territory)
    return (
      <main className="startup">
        <div className="brand-mark">A</div>
        <h1>Atlas da Apuração</h1>
        <p role="status">{error || 'Abrindo o acervo local…'}</p>
        {error && (
          <button onClick={() => refresh().catch((e) => setError(e.message))}>
            Tentar novamente
          </button>
        )}
      </main>
    );
  const snapshot = view?.snapshot;
  const selectedIndex = at
    ? Math.max(0, bootstrap.captures.indexOf(at))
    : bootstrap.captures.length - 1;
  const watching = bootstrap.watchlist.some((w) => w.enabled && w.territoryId === territoryId);
  const saved = bootstrap.watchlist.filter((w) => w.enabled);
  const capture = at ?? bootstrap.captures.at(-1);
  const fullTitle = office === 'president' ? 'Presidente' : 'Governador';
  return (
    <div className="app-shell">
      <header className="app-header">
        <a href="/" className="brand" aria-label="Atlas da Apuração, início">
          <span className="brand-mark">
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <path d="M16 3 28 27H4L16 3Z M10 19h12 M16 3v24" />
            </svg>
          </span>
          <span>
            ATLAS <b>DA APURAÇÃO</b>
          </span>
        </a>
        <span className="header-edition">
          ELEIÇÕES GERAIS <strong>2026</strong>
        </span>
        <div className="header-status">
          <a href="/simulated">Acervo simulado</a>
          <span className="badge">FIXTURE</span>
          <span className="local-status">
            <i /> Acervo local
          </span>
        </div>
      </header>
      <div className="fixture-notice">
        <span>
          <strong>Ambiente de demonstração.</strong> Números e horários sintéticos. Não são
          resultados oficiais.
        </span>
        <span>Sem coleta externa</span>
      </div>
      <main className="workspace">
        <aside className="sidebar">
          <div className="eyebrow">EXPLORAR TERRITÓRIOS</div>
          <button
            className={`territory-home ${territoryId === 'br' ? 'active' : ''}`}
            disabled={office === 'governor'}
            onClick={() => select('br')}
          >
            <span>◎</span> Brasil <span className="arrow">↗</span>
          </button>
          <label className="field-label" htmlFor="uf">
            Unidade da federação
          </label>
          <select
            id="uf"
            value={territory.uf ?? ''}
            onChange={(e) => select(e.target.value || 'br')}
          >
            <option value="" disabled={office === 'governor'}>
              Todo o Brasil
            </option>
            {bootstrap.territories
              .filter((t) => t.kind === 'uf')
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
          <div className="search-group">
            <label className="field-label" htmlFor="municipality-search">
              Buscar município
            </label>
            <div className="search-input">
              <span>⌕</span>
              <input
                id="municipality-search"
                placeholder="Nome do município…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
            {search.length >= 2 && (
              <ul className="search-results" aria-label="Municípios encontrados">
                {hits.map((t) => (
                  <li key={t.id}>
                    <button onClick={() => select(t.id)}>
                      {t.name}
                      <small>
                        {t.uf?.toUpperCase()} · {t.tseCode}
                      </small>
                    </button>
                  </li>
                ))}
                {!hits.length && <li className="empty-search">Nenhum município encontrado</li>}
              </ul>
            )}
          </div>
          <div className="saved-heading">
            <span className="eyebrow">MUNICÍPIOS SALVOS</span>
            <span>{saved.length}</span>
          </div>
          {saved.length ? (
            <ul className="saved-list">
              {saved.map((w) => {
                const t = bootstrap.territories.find((t) => t.id === w.territoryId)!;
                return (
                  <li key={w.territoryId}>
                    <button
                      className={territoryId === t.id ? 'active' : ''}
                      onClick={() => select(t.id)}
                    >
                      <span>◇</span>
                      <span>
                        {t.name}
                        <small>{t.uf?.toUpperCase()} · Monitorado</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="saved-empty">
              <span>◇</span>
              <p>Seu recorte começa aqui.</p>
              <small>Busque um município e salve para acompanhar seus snapshots.</small>
            </div>
          )}
          <div className="sidebar-note">
            <span className="eyebrow">NESTA DEMONSTRAÇÃO</span>
            <p>27 UFs e municípios do Acre.</p>
            <small>Selecionar um município não inicia o monitoramento.</small>
          </div>
          <div className="sidebar-bottom">
            <span className="local-dot" /> SQLite · armazenamento local
            <small>1º turno · Horário de Brasília</small>
          </div>
        </aside>
        <div className="main-area">
          <section className="page-heading">
            <div>
              <nav className="breadcrumb" aria-label="Território">
                <button disabled={office === 'governor'} onClick={() => select('br')}>
                  Brasil
                </button>
                {territory.uf && (
                  <>
                    <span>/</span>
                    <button onClick={() => select(territory.uf!)}>
                      {territory.uf.toUpperCase()}
                    </button>
                  </>
                )}
                {territory.kind === 'municipality' && (
                  <>
                    <span>/</span>
                    <span>Município</span>
                  </>
                )}
              </nav>
              <h1>
                {territory.name === 'Brasil' ? 'Brasil' : territory.name.toLocaleLowerCase('pt-BR')}
              </h1>
              <p>
                1º turno <span>·</span> {fullTitle} <span>·</span>{' '}
                {at ? 'Replay do acervo' : 'Último snapshot local'}
              </p>
            </div>
            <div className="heading-actions">
              <label className="field-label" htmlFor="office">
                Cargo
              </label>
              <select
                id="office"
                value={office}
                onChange={(e) => {
                  const next = e.target.value as Office;
                  setOffice(next);
                  setView(null);
                  if (next === 'governor' && ['br', 'exterior'].includes(territory.kind))
                    select('ac');
                }}
              >
                <option value="president">Presidente</option>
                <option value="governor">Governador</option>
              </select>
            </div>
          </section>
          {error && (
            <div className="error-banner" role="alert">
              Fonte local indisponível: {error}.{' '}
              {snapshot ? `Último dado preservado: ${time(snapshot.capturedAt)}.` : ''}
              <button onClick={() => refresh().catch((e) => setError(e.message))}>
                Tentar novamente
              </button>
            </div>
          )}
          <div className="layer-row">
            <div className="layer-tabs" role="tablist" aria-label="Camada de análise">
              {layers.map((l) => (
                <button
                  key={l.id}
                  role="tab"
                  aria-selected={layer === l.id}
                  onClick={() => setLayer(l.id)}
                >
                  <span>{l.number}</span>
                  {l.name}
                </button>
              ))}
            </div>
            <span className="capture-status" role="status">
              {loading ? 'Carregando…' : at ? 'REPLAY' : 'CAPTURA'}{' '}
              <b>{time(snapshot?.capturedAt)}</b>
            </span>
          </div>
          <div className="dashboard-grid" aria-busy={loading}>
            <section className="map-panel" aria-label="Exploração cartográfica">
              <div className="panel-top">
                <div>
                  <span className="eyebrow">
                    {layer === 'coverage'
                      ? 'COBERTURA DE SEÇÕES'
                      : layer === 'comparison'
                        ? 'REFERÊNCIA TERRITORIAL'
                        : 'RESULTADO POR TERRITÓRIO'}
                  </span>
                  <p>
                    {layer === 'coverage'
                      ? 'Seções totalizadas / seções totais'
                      : layer === 'comparison'
                        ? 'Comparação ainda indisponível'
                        : 'Maior participação nos votos válidos'}
                  </p>
                </div>
                <span className="small-tag">
                  {territory.kind === 'br' ? 'BR' : territory.uf?.toUpperCase()}
                </span>
              </div>
              <AtlasMap
                selected={territory}
                territories={bootstrap.territories}
                rows={rows}
                layer={layer}
                onSelect={select}
              />
              <div className="map-legend">
                {layer === 'result' ? (
                  <>
                    <span>
                      <i style={{ background: '#24726a' }} />
                      Candidatura A
                    </span>
                    <span>
                      <i style={{ background: '#637bb1' }} />B
                    </span>
                    <span>
                      <i style={{ background: '#b38b4d' }} />C
                    </span>
                  </>
                ) : layer === 'coverage' ? (
                  <>
                    <span>0%</span>
                    <span className="legend-gradient" />
                    <span>100%</span>
                  </>
                ) : (
                  <span>Histórico não importado</span>
                )}
                <span>
                  <i className="no-data" />
                  Sem dado
                </span>
              </div>
            </section>
            <section className="results-panel" aria-label="Detalhes do território">
              <div className="panel-top">
                <span className="eyebrow">
                  {layer === 'result'
                    ? 'RESULTADO ACUMULADO'
                    : layer === 'coverage'
                      ? 'UNIVERSO OBSERVADO'
                      : 'COMPARAÇÃO HISTÓRICA'}
                </span>
                <span className="small-tag">{at ? 'Replay' : 'Fixture'}</span>
              </div>
              {territory.kind === 'municipality' && (
                <div className="monitoring">
                  <span>
                    {watching
                      ? '◇ Monitoramento ativo'
                      : snapshot
                        ? 'Monitoramento pausado'
                        : 'Não monitorado'}
                  </span>
                  <button
                    disabled={busy}
                    onClick={() =>
                      mutate(
                        watching
                          ? `/api/v1/watchlist/${encodeURIComponent(territoryId)}`
                          : '/api/v1/watchlist',
                        watching ? 'DELETE' : 'POST',
                        watching ? undefined : { territoryId },
                      )
                    }
                  >
                    {watching ? 'Parar' : 'Salvar município'}
                  </button>
                </div>
              )}
              {layer === 'comparison' ? (
                <div className="comparison-empty">
                  <div className="empty-symbol">↔</div>
                  <h2>Comparação territorial</h2>
                  <p>
                    {office === 'governor'
                      ? 'O comparativo histórico é exclusivo para Presidente nesta versão.'
                      : 'Demonstração sintética disponível abaixo. Históricos reais e conciliação nacional continuam pendentes.'}
                  </p>
                  <div className="comparison-method">
                    <b>Referência territorial</b>
                    <span>2026 parcial × histórico final</span>
                    <small>Coberturas diferentes · não carregado</small>
                  </div>
                  <div className="comparison-method">
                    <b>
                      {territory.kind === 'municipality'
                        ? 'Unidades município–zona concluídas e conciliadas'
                        : 'Zonas concluídas e conciliadas'}
                    </b>
                    <span>Mesma coorte nos três anos · líderes entre todos os candidatos</span>
                    <small>Fixture ativa · coleta zonal nacional não validada</small>
                  </div>
                </div>
              ) : !snapshot ? (
                <div className="empty-state">
                  <div className="empty-symbol">◇</div>
                  <h2>
                    {territory.kind === 'municipality' && !watching
                      ? 'Não monitorado'
                      : 'Sem snapshot neste instante'}
                  </h2>
                  <p>
                    {territory.kind === 'municipality' && !watching
                      ? 'Salve este município para começar a guardar seus resultados.'
                      : territory.uf !== 'ac' && territory.kind === 'municipality'
                        ? 'A fixture municipal cobre apenas o Acre nesta etapa.'
                        : 'O acervo não contém dados anteriores ao início do monitoramento.'}
                  </p>
                  <strong>—</strong>
                </div>
              ) : layer === 'coverage' ? (
                <div className="coverage-content">
                  <Metric
                    name="Seções totalizadas"
                    value={percent(snapshot.sections.share)}
                    detail={`${integer(snapshot.sections.totalized)} / ${integer(snapshot.sections.total)} seções`}
                  />
                  <div className="progress-track">
                    <span style={{ width: `${(snapshot.sections.share ?? 0) * 100}%` }} />
                  </div>
                  <Metric
                    name="Eleitorado em seções totalizadas"
                    value={percent(snapshot.electorate.share)}
                    detail={`${integer(snapshot.electorate.totalized)} / ${integer(snapshot.electorate.total)} eleitores aptos`}
                  />
                  <Metric
                    name="Comparecimento observado"
                    value={percent(snapshot.electorate.turnoutShare)}
                    detail={`${integer(snapshot.electorate.turnout)} / ${integer(snapshot.electorate.installed)} eleitores das seções instaladas`}
                  />
                  <p className="footnote">
                    Base sintética. Cobertura de seções não equivale a votos nem a boletins
                    disponíveis.
                  </p>
                </div>
              ) : (
                <div className="result-content">
                  <div className="result-summary">
                    <span>Votos válidos</span>
                    <strong data-testid="valid-votes">{integer(snapshot.votes.valid)}</strong>
                    <small>{percent(snapshot.sections.share)} das seções totalizadas</small>
                  </div>
                  <div className="candidate-list">
                    {candidates.map((c) => (
                      <div className="candidate" key={c.id}>
                        <div className="candidate-top">
                          <span
                            className="candidate-number"
                            style={{ color: candidateColor(c.number) }}
                          >
                            {c.number}
                          </span>
                          <span className="candidate-name">
                            {c.name}
                            <small>
                              {c.party} · {c.destination ?? 'Destinação não informada'}
                            </small>
                          </span>
                          <strong
                            title={`${integer(c.countedVotes)} votos computados / ${integer(snapshot.votes.valid)} votos válidos. ${c.destination === 'Válido' ? 'Participação válida quando os totais conciliam.' : 'Destinação excluída do numerador válido.'}`}
                          >
                            {percent(c.validShare)}
                          </strong>
                        </div>
                        <div className="candidate-track">
                          <span
                            style={{
                              width: `${(c.validShare ?? 0) * 100}%`,
                              background: candidateColor(c.number),
                            }}
                          />
                        </div>
                        <div className="candidate-votes">
                          {integer(c.countedVotes)} votos computados
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="vote-totals">
                    <span>
                      Brancos <b>{integer(snapshot.votes.blank)}</b>
                    </span>
                    <span>
                      Nulos <b>{integer(snapshot.votes.null)}</b>
                    </span>
                  </div>
                </div>
              )}
            </section>
          </div>
          <section className="timeline-panel" aria-label="Timeline de snapshots">
            <div className="timeline-heading">
              <div>
                <span className="eyebrow">ACERVO NO TEMPO</span>
                <h2>
                  {layer === 'coverage'
                    ? 'Evolução da cobertura'
                    : layer === 'comparison'
                      ? 'Instante selecionado'
                      : metric === 'votes'
                        ? 'Votos acumulados'
                        : 'Participação nos votos válidos'}
                </h2>
              </div>
              <div className="timeline-controls">
                <button
                  className={playing ? 'selected' : ''}
                  onClick={() => {
                    if (playing) setPlaying(false);
                    else {
                      if (!at || selectedIndex === bootstrap.captures.length - 1)
                        setAt(bootstrap.captures[0]);
                      setPlaying(true);
                    }
                  }}
                >
                  {playing ? 'Ⅱ Pausar' : '▷ Replay'}
                </button>
                <button
                  className={!at ? 'selected' : ''}
                  onClick={() => {
                    setAt(null);
                    setPlaying(false);
                  }}
                >
                  Agora
                </button>
                {layer === 'result' && (
                  <select
                    aria-label="Métrica da timeline"
                    value={metric}
                    onChange={(e) => setMetric(e.target.value as 'share' | 'votes')}
                  >
                    <option value="share">Participação (%)</option>
                    <option value="votes">Votos acumulados</option>
                  </select>
                )}
                <select
                  aria-label="Escala da timeline"
                  value={scale}
                  onChange={(e) => setScale(e.target.value as 'time' | 'progress')}
                >
                  <option value="time">Horário de captura</option>
                  <option value="progress">Progresso das seções</option>
                </select>
              </div>
            </div>
            {layer === 'comparison' && office === 'president' ? (
              <ZoneComparison
                territory={territoryId}
                at={at}
                revision={revision}
                onSelect={selectTime}
              />
            ) : layer !== 'comparison' && snapshots.length > 0 ? (
              <TimelineChart
                snapshots={snapshots}
                layer={layer}
                scale={scale}
                metric={metric}
                selected={at}
                onSelect={selectTime}
              />
            ) : (
              <p className="chart-empty">
                {layer === 'comparison'
                  ? 'As séries históricas aparecerão após validação das fontes.'
                  : 'Nenhuma observação disponível para este território.'}
              </p>
            )}
            <div className="timeline-slider">
              <span>{time(bootstrap.captures[0])}</span>
              <input
                aria-label="Instante da timeline"
                type="range"
                min="0"
                max={Math.max(0, bootstrap.captures.length - 1)}
                step="1"
                value={selectedIndex}
                onChange={(e) => selectTime(bootstrap.captures[Number(e.target.value)])}
              />
              <span>{time(bootstrap.captures.at(-1))}</span>
            </div>
            <div className="timeline-foot">
              <span>
                {snapshots.length} observações do território · pontos sem interpolação · Brasília
                (UTC−3)
              </span>
              <button
                className="advance-button"
                disabled={busy || bootstrap.fixtureStep >= bootstrap.fixtureSteps - 1}
                onClick={() => mutate('/api/v1/fixture/advance', 'POST')}
              >
                {bootstrap.fixtureStep >= bootstrap.fixtureSteps - 1
                  ? 'Sequência completa'
                  : '+ Próxima captura sintética'}
              </button>
            </div>
          </section>
          {snapshot && (
            <details className="provenance">
              <summary>
                Origem, horários e denominadores <span>Snapshot {snapshot.id.slice(0, 8)}</span>
              </summary>
              <div className="provenance-grid">
                <div>
                  <b>Base</b>
                  <span>
                    Fixture sintética · fase {snapshot.phase} · turno {snapshot.round}
                  </span>
                  <b>Fonte</b>
                  <code>{snapshot.sourceUrl}</code>
                </div>
                <div>
                  <b>Geração da fonte</b>
                  <span>{dateTime(snapshot.sourceGeneratedAt)}</span>
                  <b>Captura da fixture</b>
                  <span>{dateTime(snapshot.capturedAt)}</span>
                  <b>Totalização informada</b>
                  <span>
                    {snapshot.sourceTotalizedAt ? dateTime(snapshot.sourceTotalizedAt) : '—'}
                  </span>
                </div>
                <div>
                  <b>Denominadores</b>
                  <span>
                    Participação: votos válidos ({integer(snapshot.votes.valid)}). Seções:{' '}
                    {integer(snapshot.sections.total)}. Eleitorado:{' '}
                    {integer(snapshot.electorate.total)}.
                  </span>
                  <a href={`/api/v1/sources/${snapshot.id}`} target="_blank" rel="noreferrer">
                    Inspecionar JSON e hash ↗
                  </a>
                </div>
              </div>
              {snapshot.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </details>
          )}
          <footer className="page-footer">
            <span>
              ATLAS DA APURAÇÃO <b>·</b> ACERVO LOCAL
            </span>
            <span>Corte selecionado: {capture ? dateTime(capture) : '—'} · sintético</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
