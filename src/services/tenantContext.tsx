import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { PublicTemplate, TenantPublicProfile } from '../types';
import { fetchTenantPublicProfile, fetchTenantPublicTemplates } from './tenantApi';
import { setStorageTenant } from './storage';

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
  const navigate = useNavigate();
  const slug = tenantSlug.trim().toLowerCase();
  const [profile, setProfile] = useState<TenantPublicProfile | null>(null);
  const [templates, setTemplates] = useState<PublicTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    if (!isValidSlug(slug)) {
      navigate('/invalid-url', { replace: true });
      return;
    }

    setStorageTenant(slug);
    window.localStorage.setItem('active_tenant_slug', slug);
    setLoaded(false);
    setProfile(null);
    setTemplates([]);
    void Promise.all([
      fetchTenantPublicProfile(slug),
      fetchTenantPublicTemplates(slug),
    ]).then(([tenantProfile, tenantTemplates]) => {
      if (!active) {
        return;
      }
      if (!tenantProfile) {
        navigate('/invalid-url', { replace: true });
        return;
      }
      setProfile(tenantProfile);
      setTemplates(tenantTemplates);
      setLoaded(true);
    }).catch(() => {
      if (active) {
        navigate('/invalid-url', { replace: true });
      }
    });

    return () => {
      active = false;
    };
  }, [navigate, slug]);

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
