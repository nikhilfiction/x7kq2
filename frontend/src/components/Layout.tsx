import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Forecast' },
  { to: '/accuracy', label: 'Accuracy' },
  { to: '/method', label: 'Method' },
]

export default function Layout() {
  // Keep the view controls (?mode=...&horizon=...) when moving between pages.
  const { search } = useLocation()

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">Windfall</span>
          <span className="brand-tag">UK desk</span>
        </div>
        <nav aria-label="Main" className="nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={{ pathname: item.to, search }}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main" className="page">
        <Outlet />
      </main>

      <footer className="footer">
        <span>Data: Elexon BMRS (FUELHH, WINDFOR). January 2026.</span>
        <span className="footer-links">
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </span>
      </footer>
    </div>
  )
}
