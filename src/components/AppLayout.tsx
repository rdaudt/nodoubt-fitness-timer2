import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { APP_NAME, BRAND } from '../config';
import { getPerfTraceId, isPerfTriageEnabled, registerExpectedImage, settleImage } from '../services/perfTriage';
import { useTenant } from '../services/tenantContext';
import { BottomNav } from './BottomNav';

export const AppLayout = () => {
  const location = useLocation();
  const { profile, toTenantPath } = useTenant();
  const isRunningView = /\/timer\/[^/]+\/run$/.test(location.pathname);
  const isAboutPage = /\/about\/?$/.test(location.pathname);
  const igUsername = (profile?.igUsername ?? '').trim().replace(/^@+/, '');
  const instagramUrl = igUsername ? `https://www.instagram.com/${encodeURIComponent(igUsername)}/` : '';
  const primaryLink = instagramUrl || profile?.socialLinks[0]?.url || BRAND.instagramUrl;
  const logoUrl = profile?.logoUrl ?? '';
  const coachPhoto = profile?.coachPhotoUrl ?? '';
  const coachName = profile?.coachName ?? '';
  const businessName = profile?.businessName ?? '';
  const headerTagline = profile?.headerTagline ?? '';
  const perfEnabled = isPerfTriageEnabled();
  const tracedImageUrl = (url: string): string => {
    if (!perfEnabled || !url.startsWith('/api/tenant-asset?')) {
      return url;
    }
    const traceId = getPerfTraceId();
    if (!traceId) {
      return url;
    }
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}traceId=${encodeURIComponent(traceId)}&route=${encodeURIComponent(location.pathname)}`;
  };

  useEffect(() => {
    if (!perfEnabled) {
      return;
    }
    if (logoUrl) {
      registerExpectedImage('header-logo');
    }
    if (coachPhoto && !isAboutPage) {
      registerExpectedImage('header-coach-photo');
    }
  }, [coachPhoto, isAboutPage, logoUrl, perfEnabled]);

  return (
    <div className="app-shell">
      <header className={isRunningView ? 'topbar topbar-compact' : 'topbar'}>
        <div className="topbar-inner">
          <a href={primaryLink} target="_blank" rel="noreferrer" className="brand-logo-link" aria-label={APP_NAME}>
            {logoUrl && (
              <img
                src={tracedImageUrl(logoUrl)}
                alt={`${businessName} logo`}
                className="brand-logo"
                onLoad={(event) => settleImage('header-logo', false, event.currentTarget.currentSrc)}
                onError={() => settleImage('header-logo', true)}
              />
            )}
          </a>
          <a href={primaryLink} target="_blank" rel="noreferrer" className="brand-text-wrap" aria-label={APP_NAME}>
            <p className="brand-name">{businessName}</p>
            {headerTagline && <p className="brand-tagline">{headerTagline}</p>}
          </a>
          {!isAboutPage && (
            <a href={primaryLink} target="_blank" rel="noreferrer" className="coach-wrap" aria-label={coachName}>
              {coachPhoto && (
                <img
                  src={tracedImageUrl(coachPhoto)}
                  alt={coachName}
                  className="coach-photo"
                  onLoad={(event) => settleImage('header-coach-photo', false, event.currentTarget.currentSrc)}
                  onError={() => settleImage('header-coach-photo', true)}
                />
              )}
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
