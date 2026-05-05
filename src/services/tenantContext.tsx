import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { PublicTemplate, TenantPublicProfile } from '../types';
import { fetchTenantPublicProfile, fetchTenantPublicTemplates } from './tenantApi';
import { setStorageTenant } from './storage';

const FALLBACK_DEFAULT_TENANT_SLUG = 'gabe';
const envDefaultSlugRaw = typeof import.meta.env.VITE_DEFAULT_TENANT_SLUG === 'string'
  ? import.meta.env.VITE_DEFAULT_TENANT_SLUG.trim().toLowerCase()
  : '';
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
const DEFAULT_TENANT_SLUG = isValidSlug(envDefaultSlugRaw) ? envDefaultSlugRaw : FALLBACK_DEFAULT_TENANT_SLUG;

export const TenantProvider = ({ children }: { children: React.ReactNode }) => {
  const { tenantSlug = '' } = useParams();
  const navigate = useNavigate();
  const slug = tenantSlug.trim().toLowerCase();
  const [profile, setProfile] = useState<TenantPublicProfile | null>(null);
  const [templates, setTemplates] = useState<PublicTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isValidSlug(slug)) {
      navigate(`/${DEFAULT_TENANT_SLUG}`, { replace: true });
      return;
    }

    setLoaded(false);
    void Promise.all([
      fetchTenantPublicProfile(slug),
      fetchTenantPublicTemplates(slug),
    ]).then(([tenantProfile, tenantTemplates]) => {
      if (!tenantProfile) {
        navigate(`/${DEFAULT_TENANT_SLUG}`, { replace: true });
        return;
      }
      setProfile(tenantProfile);
      setTemplates(tenantTemplates);
      setStorageTenant(tenantProfile.slug);
      window.localStorage.setItem('active_tenant_slug', tenantProfile.slug);
      setLoaded(true);
    });
  }, [navigate, slug]);

  const value = useMemo<TenantContextValue>(() => ({
    slug: slug || DEFAULT_TENANT_SLUG,
    profile,
    templates,
    loaded,
    toTenantPath: (path: string) => `/${slug || DEFAULT_TENANT_SLUG}${path.startsWith('/') ? path : `/${path}`}`,
  }), [loaded, profile, slug, templates]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export const useTenant = (): TenantContextValue => {
  const context = useContext(TenantContext);
  return context ?? fallbackTenantContext;
};

export const tenantDefaults = {
  defaultSlug: DEFAULT_TENANT_SLUG,
};
