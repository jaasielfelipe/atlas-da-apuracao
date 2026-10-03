import { environments, type DashboardEnvironment } from './environment';
import { dateTime } from './format';
import { useDashboard, type ReadyDashboard } from './useDashboard';
import AppHeader from './components/AppHeader';
import Sidebar from './components/Sidebar';
import PageHeading from './components/PageHeading';
import MapPanel from './components/MapPanel';
import DetailsPanel from './components/DetailsPanel';
import TimelinePanel from './components/TimelinePanel';
import Provenance from './components/Provenance';

export default function App({ environment = 'fixture' }: { environment?: DashboardEnvironment }) {
  const d = useDashboard(environments[environment]);
  if (!d.bootstrap || !d.territory)
    return (
      <main className="startup">
        <div className="brand-mark">A</div>
        <h1>Atlas da Apuração</h1>
        <p role="status">{d.error || 'Abrindo o acervo local…'}</p>
        {d.error && <button onClick={d.retry}>Tentar novamente</button>}
      </main>
    );
  const ready = d as ReadyDashboard;
  const capture = d.at ?? d.bootstrap.captures.at(-1);
  return (
    <div className="app-shell">
      <AppHeader d={ready} />
      <main className="workspace">
        <Sidebar d={ready} />
        <div className="main-area">
          <PageHeading d={ready} />
          <div className="dashboard-grid" aria-busy={d.loading}>
            <MapPanel d={ready} />
            <DetailsPanel d={ready} />
          </div>
          <TimelinePanel d={ready} />
          <Provenance d={ready} />
          <footer className="page-footer">
            <span>
              ATLAS DA APURAÇÃO <b>·</b> ACERVO LOCAL
            </span>
            <span>
              Corte selecionado: {capture ? dateTime(capture) : '—'} · {d.env.footer}
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
