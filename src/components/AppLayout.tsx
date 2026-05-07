import { Outlet, useLocation } from 'react-router-dom';
import { APP_NAME, BRAND } from '../config';
import { useTenant } from '../services/tenantContext';
import { BottomNav } from './BottomNav';

export const AppLayout = () => {
  const location = useLocation();
  const { profile, toTenantPath } = useTenant();
  const isRunningView = /\/timer\/[^/]+\/run$/.test(location.pathname);
  const isAboutPage = /\/about\/?$/.test(location.pathname);
  const primaryLink = profile?.socialLinks[0]?.url || BRAND.instagramUrl;
  const logoUrl = profile?.logoUrl ?? '';
  const coachPhoto = profile?.coachPhotoUrl ?? '';
  const coachName = profile?.coachName ?? '';
  const businessName = profile?.businessName ?? '';

  return (
    <div className="app-shell">
      <header className={isRunningView ? 'topbar topbar-compact' : 'topbar'}>
        <div className="topbar-inner">
          <a href={primaryLink} target="_blank" rel="noreferrer" className="brand-logo-link" aria-label={APP_NAME}>
            {logoUrl && <img src={logoUrl} alt={`${businessName} logo`} className="brand-logo" />}
          </a>
          <a href={primaryLink} target="_blank" rel="noreferrer" className="brand-text-wrap" aria-label={APP_NAME}>
            <p className="brand-name">{businessName}</p>
          </a>
          {!isAboutPage && (
            <a href={primaryLink} target="_blank" rel="noreferrer" className="coach-wrap" aria-label={coachName}>
              {coachPhoto && <img src={coachPhoto} alt={coachName} className="coach-photo" />}
              <p className="coach-name">{coachName}</p>
            </a>
          )}
        </div>
      </header>

      <main className={isRunningView ? 'screen running-screen' : 'screen'}>
        <Outlet />
      </main>

      {!isRunningView && (
        <BottomNav clickable toTenantPath={toTenantPath} />
      )}
    </div>
  );
};
