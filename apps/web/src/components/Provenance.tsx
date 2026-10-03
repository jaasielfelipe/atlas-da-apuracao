import { dateTime, integer } from '../format';
import type { ReadyDashboard } from '../useDashboard';

export default function Provenance({ d }: { d: ReadyDashboard }) {
  const { snapshot, env } = d;
  if (!snapshot) return null;
  return (
    <details className="provenance">
      <summary>
        Origem, horários e denominadores <span>Snapshot {snapshot.id.slice(0, 8)}</span>
      </summary>
      <div className="provenance-grid">
        <div>
          <b>Base</b>
          <span>
            {env.sourceLabel} · fase {snapshot.phase} · turno {snapshot.round}
          </span>
          <b>Fonte</b>
          <code>{snapshot.sourceUrl}</code>
        </div>
        <div>
          <b>Geração da fonte</b>
          <span>{dateTime(snapshot.sourceGeneratedAt)}</span>
          <b>{env.captureLabel}</b>
          <span>{dateTime(snapshot.capturedAt)}</span>
          <b>Totalização informada</b>
          <span>{snapshot.sourceTotalizedAt ? dateTime(snapshot.sourceTotalizedAt) : '—'}</span>
        </div>
        <div>
          <b>Denominadores</b>
          <span>
            Participação: votos válidos ({integer(snapshot.votes.valid)}). Seções:{' '}
            {integer(snapshot.sections.total)}. Eleitorado: {integer(snapshot.electorate.total)}.
          </span>
          <a href={`${env.base}/sources/${snapshot.id}`} target="_blank" rel="noreferrer">
            Inspecionar JSON e hash ↗
          </a>
        </div>
      </div>
      {snapshot.warnings.map((w) => (
        <p key={w}>{w}</p>
      ))}
    </details>
  );
}
