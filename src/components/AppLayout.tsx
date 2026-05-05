import { Outlet, useLocation } from 'react-router-dom';
import type { SyntheticEvent } from 'react';
import { APP_NAME, BRAND } from '../config';
import { useTenant } from '../services/tenantContext';
import coachGabeHeader from '../../media/coach-gabe-header.jpeg';
import { BottomNav } from './BottomNav';

const withFallbackImage = (fallbackSrc: string) => (event: SyntheticEvent<HTMLImageElement>) => {
  const image = event.currentTarget;
  if (image.src.endsWith(fallbackSrc)) {
    return;
  }
  image.src = fallbackSrc;
};

export const AppLayout = () => {
  const location = useLocation();
  const { profile, toTenantPath } = useTenant();
  const isRunningView = /\/timer\/[^/]+\/run$/.test(location.pathname);
  const isAboutPage = /\/about\/?$/.test(location.pathname);
  const primaryLink = profile?.socialLinks[0]?.url || BRAND.instagramUrl;
  const logoUrl = profile?.logoUrl || '/assets/nodoubt-training-logo.png';
  const coachPhoto = profile?.coachPhotoUrl || coachGabeHeader;
  const coachName = profile?.coachName || 'Coach Gabe';
  const businessName = profile?.businessName || BRAND.businessName;
  const tagline = BRAND.tagline;

  return (
    <div className="app-shell">
      <header className={isRunningView ? 'topbar topbar-compact' : 'topbar'}>
        <div className="topbar-inner">
          <a href={primaryLink} target="_blank" rel="noreferrer" className="brand-logo-link" aria-label={APP_NAME}>
            <img src={logoUrl} alt={`${businessName} logo`} className="brand-logo" onError={withFallbackImage('/assets/nodoubt-training-logo.png')} />
          </a>
          <a href={primaryLink} target="_blank" rel="noreferrer" className="brand-text-wrap" aria-label={APP_NAME}>
            <p className="brand-name">{businessName}</p>
            <p className="brand-tagline">{tagline}</p>
          </a>
          {!isAboutPage && (
            <a href={primaryLink} target="_blank" rel="noreferrer" className="coach-wrap" aria-label={coachName}>
              <img src={coachPhoto} alt={coachName} className="coach-photo" onError={withFallbackImage(coachGabeHeader)} />
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
