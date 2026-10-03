import TimelineChart from '../charts/TimelineChart';
import ZoneComparison from '../charts/ZoneComparison';
import { time } from '../format';
import type { ReadyDashboard } from '../useDashboard';

export default function TimelinePanel({ d }: { d: ReadyDashboard }) {
  const { layer, metric, scale, playing, at, bootstrap, office, env, snapshots, busy } = d;
  const selectedIndex = at
    ? Math.max(0, bootstrap.captures.indexOf(at))
    : bootstrap.captures.length - 1;
  const fixtureDone = bootstrap.fixtureStep >= bootstrap.fixtureSteps - 1;
  return (
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
          <button className={playing ? 'selected' : ''} onClick={d.togglePlay}>
            {playing ? 'Ⅱ Pausar' : '▷ Replay'}
          </button>
          <button className={!at ? 'selected' : ''} onClick={d.goNow}>
            Agora
          </button>
          {layer === 'result' && (
            <select
              aria-label="Métrica da timeline"
              value={metric}
              onChange={(e) => d.setMetric(e.target.value as 'share' | 'votes')}
            >
              <option value="share">Participação (%)</option>
              <option value="votes">Votos acumulados</option>
            </select>
          )}
          <select
            aria-label="Escala da timeline"
            value={scale}
            onChange={(e) => d.setScale(e.target.value as 'time' | 'progress')}
          >
            <option value="time">Horário de captura</option>
            <option value="progress">Progresso das seções</option>
          </select>
        </div>
      </div>
      {layer === 'comparison' && office === 'president' && env.comparison.available ? (
        <ZoneComparison
          endpoint={`${env.base}/comparison`}
          territory={d.territoryId}
          at={at}
          revision={d.revision}
          onSelect={d.selectTime}
        />
      ) : layer !== 'comparison' && snapshots.length > 0 ? (
        <TimelineChart
          snapshots={snapshots}
          layer={layer}
          scale={scale}
          metric={metric}
          selected={at}
          onSelect={d.selectTime}
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
          onChange={(e) => d.selectTime(bootstrap.captures[Number(e.target.value)])}
        />
        <span>{time(bootstrap.captures.at(-1))}</span>
      </div>
      <div className="timeline-foot">
        <span>
          {snapshots.length} observações do território · pontos sem interpolação · Brasília (UTC−3)
        </span>
        {!env.live && (
          <button
            className="advance-button"
            disabled={busy || fixtureDone}
            onClick={d.advanceFixture}
          >
            {fixtureDone ? 'Sequência completa' : '+ Próxima captura sintética'}
          </button>
        )}
      </div>
    </section>
  );
}
