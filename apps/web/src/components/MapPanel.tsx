import AtlasMap from '../map/AtlasMap';
import { colors } from '../format';
import type { ReadyDashboard } from '../useDashboard';

export default function MapPanel({ d }: { d: ReadyDashboard }) {
  const { layer, territory, bootstrap, rows, env, ranking, legend } = d;
  return (
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
        onSelect={d.select}
        live={env.live}
        ranking={ranking}
        attribution={env.sourceLabel}
      />
      <div className="map-legend">
        {layer === 'result' && env.live ? (
          <>
            {legend.map((c, i) => (
              <span key={c.number}>
                <i style={{ background: colors[i] }} />
                {c.number} · {c.name}
              </span>
            ))}
            {legend.length > 0 && (
              <span>
                <i style={{ background: colors[3] }} />
                Demais
              </span>
            )}
          </>
        ) : layer === 'result' ? (
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
  );
}
