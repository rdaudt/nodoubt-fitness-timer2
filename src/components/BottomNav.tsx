import { NavLink, useLocation } from 'react-router-dom';

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

const HistoryIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 12a8 8 0 1 0 2.3-5.6" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M4 4v4h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 8v5l3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const TemplatesIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 4h14v16H5z" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M8 8h8M8 12h8M8 16h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
  { to: '', label: 'Timers', icon: TimersIcon },
  { to: '/templates', label: 'Templates', icon: TemplatesIcon },
  { to: '/history', label: 'History', icon: HistoryIcon },
  { to: '/about', label: 'About', icon: AboutIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

interface BottomNavProps {
  clickable: boolean;
  toTenantPath?: (path: string) => string;
}

export const BottomNav = ({ clickable, toTenantPath }: BottomNavProps) => {
  const location = useLocation();
  const normalizePath = (value: string): string => value.replace(/\/+$/, '') || '/';

  if (!clickable) {
    return (
      <nav className="bottom-nav" aria-label="Primary Navigation">
        {navItems.map((item) => (
          <div key={item.to} className="nav-item nav-item-disabled" aria-disabled="true">
            <span className="nav-icon" aria-hidden="true">
              <item.icon />
            </span>
            <span className="nav-label">{item.label}</span>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav className="bottom-nav" aria-label="Primary Navigation">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={toTenantPath ? toTenantPath(item.to) : item.to}
          className={({ isActive }) => {
            const targetPath = normalizePath(toTenantPath ? toTenantPath(item.to) : item.to);
            const currentPath = normalizePath(location.pathname);
            const isTimersLanding = item.to === '' && currentPath === targetPath;
            return (isActive || isTimersLanding) ? 'nav-item active' : 'nav-item';
          }}
          end={item.to === ''}
        >
          <span className="nav-icon" aria-hidden="true">
            <item.icon />
          </span>
          <span className="nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
};
