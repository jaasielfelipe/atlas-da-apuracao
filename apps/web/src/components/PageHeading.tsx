import type { Layer, Office } from '../../../../packages/domain/src/index';
import { time } from '../format';
import type { ReadyDashboard } from '../useDashboard';

const layers: { id: Layer; name: string; number: string }[] = [
  { id: 'result', name: 'Resultado', number: '01' },
  { id: 'coverage', name: 'Cobertura', number: '02' },
  { id: 'comparison', name: 'Comparação', number: '03' },
];

export default function PageHeading({ d }: { d: ReadyDashboard }) {
  const { territory, office, at, error, snapshot, layer, loading } = d;
  return (
    <>
      <section className="page-heading">
        <div>
          <nav className="breadcrumb" aria-label="Território">
            <button disabled={office === 'governor'} onClick={() => d.select('br')}>
              Brasil
            </button>
            {territory.uf && (
              <>
                <span>/</span>
                <button onClick={() => d.select(territory.uf!)}>
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
            1º turno <span>·</span> {office === 'president' ? 'Presidente' : 'Governador'}{' '}
            <span>·</span> {at ? 'Replay do acervo' : 'Último snapshot local'}
          </p>
        </div>
        <div className="heading-actions">
          <label className="field-label" htmlFor="office">
            Cargo
          </label>
          <select
            id="office"
            value={office}
            onChange={(e) => d.changeOffice(e.target.value as Office)}
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
          <button onClick={d.retry}>Tentar novamente</button>
        </div>
      )}
      <div className="layer-row">
        <div className="layer-tabs" role="tablist" aria-label="Camada de análise">
          {layers.map((l) => (
            <button
              key={l.id}
              role="tab"
              aria-selected={layer === l.id}
              onClick={() => d.setLayer(l.id)}
            >
              <span>{l.number}</span>
              {l.name}
            </button>
          ))}
        </div>
        <span className="capture-status" role="status">
          {loading ? 'Carregando…' : at ? 'REPLAY' : 'CAPTURA'} <b>{time(snapshot?.capturedAt)}</b>
        </span>
      </div>
    </>
  );
}
