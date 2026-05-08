import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { PublicTemplate, TenantPublicProfile } from '../types';
import { fetchTenantPublicProfile, fetchTenantPublicTemplates } from './tenantApi';
import { flushPerfObservation, isPerfTriageEnabled, markPerf, recordCacheSource, startPerfRun } from './perfTriage';
import { setStorageTenant } from './storage';
import { clearTenantSessionCache, getTenantSessionCache, isTenantCacheStale, setTenantSessionCache } from './tenantSessionCache';

const RESERVED_SLUGS = new Set(['api', 'timer', 'settings', 'templates', 'template', 'about', 'history']);
const SLUG_RE = /^[a-z0-9-]{3,32}$/;

interface TenantContextValue {
  slug: string;
  profile: TenantPublicProfile | null;
  templates: PublicTemplate[];
  loaded: boolean;
  toTenantPath: (path: string) => string;
}

const TenantContext = createContext<TenantContextValue | null>(null);
const fallbackTenantContext: TenantContextValue = {
  slug: '',
  profile: null,
  templates: [],
  loaded: true,
  toTenantPath: (path: string) => (path.startsWith('/') ? path : `/${path}`),
};

const isValidSlug = (slug: string): boolean => SLUG_RE.test(slug) && !RESERVED_SLUGS.has(slug);

export const TenantProvider = ({ children }: { children: React.ReactNode }) => {
  const { tenantSlug = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const slug = tenantSlug.trim().toLowerCase();
  const [profile, setProfile] = useState<TenantPublicProfile | null>(null);
  const [templates, setTemplates] = useState<PublicTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const previousSlugRef = useRef('');

  useEffect(() => {
    let active = true;
    const perfEnabled = isPerfTriageEnabled();
    const perfRoute = `${location.pathname}${location.search}`;
    const traceId = perfEnabled ? startPerfRun(slug, perfRoute) : '';
    if (perfEnabled) {
      markPerf('tenant_provider_start');
    }

    if (!isValidSlug(slug)) {
      navigate('/invalid-url', { replace: true });
      return;
    }
    if (previousSlugRef.current && previousSlugRef.current !== slug) {
      clearTenantSessionCache();
    }
    previousSlugRef.current = slug;

    setStorageTenant(slug);
    window.localStorage.setItem('active_tenant_slug', slug);
    const cached = getTenantSessionCache(slug);
    const stale = cached ? isTenantCacheStale(cached.entry) : true;

    if (cached) {
      setProfile(cached.entry.profile);
      setTemplates(cached.entry.templates);
      setLoaded(Boolean(cached.entry.profile));
      recordCacheSource('tenant_public', cached.source);
      recordCacheSource('tenant_templates', cached.source);
    } else {
      setLoaded(false);
      setProfile(null);
      setTemplates([]);
    }

    if (cached && !stale && perfEnabled) {
      markPerf('tenant_data_committed');
      flushPerfObservation('data-ready');
    }

    void Promise.all([
      fetchTenantPublicProfile(slug, perfEnabled ? {
        traceId,
        route: perfRoute,
        onCacheSource: (source) => recordCacheSource('tenant_public', source),
      } : undefined),
      fetchTenantPublicTemplates(slug, perfEnabled ? {
        traceId,
        route: perfRoute,
        onCacheSource: (source) => recordCacheSource('tenant_templates', source),
      } : undefined),
    ]).then(([tenantProfile, tenantTemplates]) => {
      if (!active) {
        return;
      }
      if (!tenantProfile) {
        if (cached?.entry.profile) {
          setLoaded(true);
          if (perfEnabled) {
            flushPerfObservation('error');
          }
          return;
        }
        navigate('/invalid-url', { replace: true });
        return;
      }
      setProfile(tenantProfile);
      setTemplates(tenantTemplates);
      setLoaded(true);
      setTenantSessionCache(slug, tenantProfile, tenantTemplates);
      if (perfEnabled) {
        markPerf('tenant_data_committed');
        flushPerfObservation('data-ready');
      }
    }).catch(() => {
      if (active) {
        if (cached?.entry.profile) {
          setLoaded(true);
          if (perfEnabled) {
            flushPerfObservation('error');
          }
          return;
        }
        if (perfEnabled) {
          flushPerfObservation('error');
        }
        navigate('/invalid-url', { replace: true });
      }
    });

    return () => {
      active = false;
    };
  }, [location.pathname, location.search, navigate, slug]);

  const value = useMemo<TenantContextValue>(() => ({
    slug,
    profile,
    templates,
    loaded,
    toTenantPath: (path: string) => `/${slug}${path.startsWith('/') ? path : `/${path}`}`,
  }), [loaded, profile, slug, templates]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export const useTenant = (): TenantContextValue => {
  const context = useContext(TenantContext);
  return context ?? fallbackTenantContext;
};
