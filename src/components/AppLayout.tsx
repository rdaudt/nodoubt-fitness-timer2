import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { APP_NAME, BRAND } from '../config';

const TimersIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="13" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M12 13V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M9 2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M15.5 4.5l1.6-1.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const AboutIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M12 11.5v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="8" r="1.2" fill="currentColor" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 3.8l1.4.3.7 2.1 1.3.6 2-1 1 .9-.8 2 .7 1.3 2 .8v1.4l-2 .8-.7 1.3.8 2-1 .9-2-1-1.3.6-.7 2.1-1.4.3-1.4-.3-.7-2.1-1.3-.6-2 1-1-.9.8-2-.7-1.3-2-.8v-1.4l2-.8.7-1.3-.8-2 1-.9 2 1 1.3-.6.7-2.1z"
      fill="currentColor"
    />
    <circle cx="12" cy="12" r="3.2" fill="#0a0a0a" />
  </svg>
);

const navItems = [
  { to: '/', label: 'Timers', icon: TimersIcon },
  { to: '/about', label: 'About', icon: AboutIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export const AppLayout = () => {
  const location = useLocation();
  const isRunningView = /\/timer\/[^/]+\/run$/.test(location.pathname);
  const isAboutPage = /^\/about\/?$/.test(location.pathname);

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
          {!isAboutPage && (
            <div className="coach-wrap" aria-label="Coach Gabe">
              <a href="https://www.instagram.com/nodoubt.fitness/" target="_blank" rel="noreferrer" aria-label="NoDoubt Fitness Instagram">
                <img src="/assets/coach-gabe-transparent-cropped.png" alt="Coach Gabe" className="coach-photo" />
              </a>
              <p className="coach-name">Coach Gabe</p>
            </div>
          )}
        </div>
      </header>

      <main className={isRunningView ? 'screen running-screen' : 'screen'}>
        <Outlet />
      </main>

      {!isRunningView && (
        <nav className="bottom-nav" aria-label="Primary Navigation">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')} end={item.to === '/'}>
              <span className="nav-icon" aria-hidden="true">
                <item.icon />
              </span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
};
