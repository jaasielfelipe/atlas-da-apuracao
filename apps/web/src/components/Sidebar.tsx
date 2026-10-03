import type { ReadyDashboard } from '../useDashboard';

export default function Sidebar({ d }: { d: ReadyDashboard }) {
  const { bootstrap, territory, territoryId, office, search, hits, select, setSearch, env } = d;
  const saved = bootstrap.watchlist.filter((w) => w.enabled);
  return (
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
      <select id="uf" value={territory.uf ?? ''} onChange={(e) => select(e.target.value || 'br')}>
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
            const t = bootstrap.territories.find((t) => t.id === w.territoryId);
            if (!t) return null;
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
        <span className="eyebrow">{env.sidebar.eyebrow}</span>
        <p>{env.sidebar.text}</p>
        <small>{env.sidebar.hint}</small>
      </div>
      <div className="sidebar-bottom">
        <span className="local-dot" /> SQLite · armazenamento local
        <small>1º turno · Horário de Brasília</small>
      </div>
    </aside>
  );
}
