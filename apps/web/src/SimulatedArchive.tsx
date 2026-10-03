import { useEffect, useState, useRef } from 'react';
import type { Snapshot, Territory } from '../../../packages/domain/src/index';
import { api, dateTime, integer, percent } from './format';
type Archive = {
  environment: 'simulated';
  lastObservation: string | null;
  coverage: {
    expectedSegments: number;
    observedSegments: number;
    completeSegments: number;
    expectedZones: number;
    completeZones: number;
  } | null;
  territories: Territory[];
};
export default function SimulatedArchive() {
  const loadedScope = useRef('');
  const [archive, setArchive] = useState<Archive | null>(null),
    [error, setError] = useState('');
  const [office, setOffice] = useState<'president' | 'governor'>('president'),
    [territory, setTerritory] = useState('br');
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]),
    [index, setIndex] = useState(0),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    api<Archive>('/api/v1/simulated/archive')
      .then((a) => {
        if (active) setArchive(a);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const scope = `${office}:${territory}`;
    if (loadedScope.current !== scope) {
      setSnapshots([]);
      loadedScope.current = scope;
    }
    api<{ snapshots: Snapshot[] }>(
      `/api/v1/simulated/results?office=${office}&territory=${territory}`,
    )
      .then((r) => {
        if (active) {
          setSnapshots(r.snapshots);
          setIndex(Math.max(0, r.snapshots.length - 1));
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
  }, [office, territory, revision]);
  const snapshot = snapshots[index],
    coverage = archive?.coverage;
  return (
    <main className="sim-archive">
      <header>
        <a href="/">← Painel fixture</a>
        <span className="badge">SIMULADO TSE</span>
      </header>
      <h1>Acervo simulado</h1>
      <p className="fixture-notice">
        <strong>Não são resultados oficiais.</strong> Capturas do ambiente de testes do TSE, em
        banco separado.
      </p>
      <p>
        Consulta local. Abrir esta página não inicia coleta.{' '}
        <button onClick={() => setRevision((r) => r + 1)}>Atualizar acervo</button>
      </p>
      {error && <p role="alert">{error}</p>}
      <section aria-label="Cobertura coletada atual">
        <h2>Coleta zonal presidencial</h2>
        <p>
          Última observação: {archive?.lastObservation ? dateTime(archive.lastObservation) : '—'} ·
          cobertura atual, independente do replay do resultado abaixo.
        </p>
        <dl>
          <div>
            <dt>Segmentos observados / esperados</dt>
            <dd>
              {integer(coverage?.observedSegments)} / {integer(coverage?.expectedSegments)}
            </dd>
          </div>
          <div>
            <dt>ZEs inteiras concluídas / esperadas</dt>
            <dd>
              {integer(coverage?.completeZones)} / {integer(coverage?.expectedZones)}
            </dd>
          </div>
        </dl>
        <p>
          Comparação histórica: <strong>pendente de conciliação auditada</strong>. Zona concluída
          não significa zona comparável. Não há estimativa para zonas parciais.
        </p>
      </section>
      <section aria-label="Resultado agregado do simulado">
        <h2>Resultado agregado EA20</h2>
        <div className="archive-controls">
          <label>
            Cargo
            <select
              value={office}
              onChange={(e) => {
                const v = e.target.value as typeof office;
                setOffice(v);
                if (v === 'governor' && ['br', 'zz'].includes(territory)) setTerritory('ac');
              }}
            >
              <option value="president">Presidente</option>
              <option value="governor">Governador</option>
            </select>
          </label>
          <label>
            Território
            <select value={territory} onChange={(e) => setTerritory(e.target.value)}>
              {(archive?.territories ?? [])
                .filter((t) => office === 'president' || t.kind === 'uf')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {loading && !snapshot ? (
          <p>Carregando capturas…</p>
        ) : !snapshot ? (
          <p>Nenhum resultado capturado para este recorte.</p>
        ) : (
          <>
            <p>
              Captura: {dateTime(snapshot.capturedAt)} · fonte:{' '}
              {dateTime(snapshot.sourceGeneratedAt)}
            </p>
            <p>
              Seções totalizadas: {integer(snapshot.sections.totalized)} /{' '}
              {integer(snapshot.sections.total)} · votos válidos:{' '}
              <strong>{integer(snapshot.votes.valid)}</strong>
            </p>
            <div className="archive-table">
              <table>
                <thead>
                  <tr>
                    <th>Candidatura</th>
                    <th>Votos computados</th>
                    <th>Participação nos válidos</th>
                    <th>Destinação</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.candidates.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.number} · {c.name}
                      </td>
                      <td>{integer(c.countedVotes)}</td>
                      <td>{percent(c.validShare)}</td>
                      <td>{c.destination ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label>
              Captura do agregado
              <input
                aria-label="Captura do agregado"
                type="range"
                min={0}
                max={Math.max(0, snapshots.length - 1)}
                value={index}
                disabled={snapshots.length < 2}
                onChange={(e) => setIndex(Number(e.target.value))}
              />
            </label>
            <p>
              {snapshots.length} captura(s). Apenas versões observadas, sem interpolação.{' '}
              <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">
                Fonte no simulado TSE
              </a>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
