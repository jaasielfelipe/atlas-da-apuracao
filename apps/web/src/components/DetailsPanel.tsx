import { candidateColor, dateTime, integer, percent } from '../format';
import type { CollectionState, ReadyDashboard } from '../useDashboard';

function Metric({ name, value, detail }: { name: string; value: string; detail: string }) {
  return (
    <div className="metric" title={detail}>
      <span>{name}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

/** National zone collection of the running collector (live environments only). */
function CollectionStatus({ collection }: { collection: CollectionState }) {
  const c = collection.coverage;
  return (
    <div className="collection-status" data-testid="collection-status">
      <span className="eyebrow">COLETA ZONAL PRESIDENCIAL</span>
      <dl>
        <div>
          <dt>Segmentos observados</dt>
          <dd>
            {integer(c?.observedSegments)} / {integer(c?.expectedSegments)}
          </dd>
        </div>
        <div>
          <dt>ZEs inteiras concluídas</dt>
          <dd>
            {integer(c?.completeZones)} / {integer(c?.expectedZones)}
          </dd>
        </div>
      </dl>
      <small>
        Coletor {collection.running ? 'ativo' : 'parado'}
        {collection.collector
          ? ` · ${collection.collector.rate.observedRps10s.toFixed(1)} req/s` +
            (collection.collector.rate.pausedUntil
              ? ` · pausado até ${dateTime(collection.collector.rate.pausedUntil)}`
              : '')
          : ''}
        {' · '}última observação{' '}
        {collection.lastObservation ? dateTime(collection.lastObservation) : '—'}. Cobertura atual,
        independente do instante selecionado.
      </small>
    </div>
  );
}

export default function DetailsPanel({ d }: { d: ReadyDashboard }) {
  const { layer, at, env, territory, watching, snapshot, office, busy, candidates, ranking } = d;
  const collection = env.live ? d.bootstrap.collection : undefined;
  return (
    <section className="results-panel" aria-label="Detalhes do território">
      <div className="panel-top">
        <span className="eyebrow">
          {layer === 'result'
            ? 'RESULTADO ACUMULADO'
            : layer === 'coverage'
              ? 'UNIVERSO OBSERVADO'
              : 'COMPARAÇÃO HISTÓRICA'}
        </span>
        <span className="small-tag">{at ? 'Replay' : env.tag}</span>
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
          <button disabled={busy} onClick={d.toggleWatch}>
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
              : env.comparison.summary}
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
            <small>{env.comparison.status}</small>
          </div>
        </div>
      ) : !snapshot ? (
        <>
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
                : !env.live && territory.uf !== 'ac' && territory.kind === 'municipality'
                  ? 'A fixture municipal cobre apenas o Acre nesta etapa.'
                  : 'O acervo não contém dados anteriores ao início do monitoramento.'}
            </p>
            <strong>—</strong>
          </div>
          {layer === 'coverage' && collection && <CollectionStatus collection={collection} />}
        </>
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
            {env.live ? `Fonte: ${env.sourceLabel}.` : 'Base sintética.'} Cobertura de seções não
            equivale a votos nem a boletins disponíveis.
          </p>
          {collection && <CollectionStatus collection={collection} />}
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
                    style={{ color: candidateColor(c.number, ranking) }}
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
                      background: candidateColor(c.number, ranking),
                    }}
                  />
                </div>
                <div className="candidate-votes">{integer(c.countedVotes)} votos computados</div>
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
  );
}
