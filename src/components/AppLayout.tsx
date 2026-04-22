import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { APP_NAME, BRAND } from '../config';

const navItems = [
  { to: '/', label: 'Timers' },
  { to: '/about', label: 'About' },
  { to: '/settings', label: 'Settings' },
];

export const AppLayout = () => {
  const location = useLocation();
  const isRunningView = /\/timer\/[^/]+\/run$/.test(location.pathname);

  return (
    <div className="app-shell">
      <header className={isRunningView ? 'topbar topbar-compact' : 'topbar'}>
        <div className="topbar-inner">
          <Link to="/" className="brand-logo-link" aria-label={APP_NAME}>
            <img src="/assets/nodoubt-fitness-logo-transparent-white-cropped.png" alt="NoDoubt Fitness logo" className="brand-logo" />
          </Link>
          <Link to="/" className="brand-text-wrap" aria-label={APP_NAME}>
            <p className="brand-name">{BRAND.businessName}</p>
            <p className="brand-tagline">{BRAND.tagline}</p>
          </Link>
          <div className="coach-wrap" aria-label="Coach Gabe">
            <img src="/assets/coach-gabe-transparent-cropped.png" alt="Coach Gabe" className="coach-photo" />
            <p className="coach-name">Coach Gabe</p>
          </div>
        </div>
      </header>

      <main className={isRunningView ? 'screen running-screen' : 'screen'}>
        <Outlet />
      </main>

      {!isRunningView && (
        <nav className="bottom-nav" aria-label="Primary Navigation">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')} end={item.to === '/'}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
};
