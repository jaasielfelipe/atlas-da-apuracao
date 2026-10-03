import type { ReadyDashboard } from '../useDashboard';

export default function AppHeader({ d }: { d: ReadyDashboard }) {
  const { env, bootstrap } = d;
  const running = bootstrap.collection?.running ?? bootstrap.collectionRunning ?? false;
  return (
    <>
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
          <nav className="header-links" aria-label="Painéis">
            {env.id !== 'official' && <a href="/live/official">Painel oficial</a>}
            {env.id !== 'simulated' && <a href="/live/simulated">Painel simulado</a>}
            {env.live && <a href="/">Demonstração</a>}
          </nav>
          <span className="badge">{env.badge}</span>
          <span className="local-status">
            <i /> {env.live ? (running ? 'Coletor ativo' : 'Coletor parado') : 'Acervo local'}
          </span>
        </div>
      </header>
      <div className="fixture-notice">
        <span>
          <strong>{env.notice.strong}</strong> {env.notice.text}
        </span>
        <span>
          {env.live
            ? `Coletor ${running ? 'ativo' : 'parado'} · ${bootstrap.captures.length} capturas`
            : 'Sem coleta externa'}
        </span>
      </div>
    </>
  );
}
