type PerfMetricName =
  | 'tenant_provider_start'
  | 'tenant_public_fetch_ms'
  | 'tenant_public_headers_ms'
  | 'tenant_public_json_parse_ms'
  | 'tenant_templates_fetch_ms'
  | 'tenant_templates_headers_ms'
  | 'tenant_templates_json_parse_ms'
  | 'tenant_data_committed'
  | 'tenant_data_ready_ms'
  | 'tenant_image_settled_ms';
type CacheSourceName = 'memory' | 'sessionStorage' | 'network' | 'sw-cache';

interface PerfRun {
  id: string;
  route: string;
  tenant: string;
  startedAtMs: number;
  markTs: Record<string, number>;
  metrics: Partial<Record<PerfMetricName, number>>;
  imagePending: Set<string>;
  imageErrors: number;
  cacheSources: Record<string, number>;
  flushed: boolean;
}

type WindowWithPerf = Window & { __perfTriageRun?: PerfRun };

const TRIAGE_KEY = '__perf_triage';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export const isPerfTriageEnabled = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    if (window.localStorage.getItem(TRIAGE_KEY) === '1') {
      return true;
    }
  } catch {
    // ignore storage access issues
  }
  return import.meta.env.VITE_PERF_TRIAGE === '1';
};

const getRun = (): PerfRun | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  return (window as WindowWithPerf).__perfTriageRun ?? null;
};

export const startPerfRun = (tenant: string, route: string): string => {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (typeof window !== 'undefined') {
    (window as WindowWithPerf).__perfTriageRun = {
      id,
      route,
      tenant,
      startedAtMs: now(),
      markTs: {},
      metrics: {},
      imagePending: new Set(),
      imageErrors: 0,
      cacheSources: {},
      flushed: false,
    };
  }
  return id;
};

export const markPerf = (name: PerfMetricName): void => {
  const run = getRun();
  if (!run) {
    return;
  }
  run.markTs[name] = now();
  if (name === 'tenant_data_committed') {
    run.metrics.tenant_data_ready_ms = Math.round(run.markTs[name] - run.startedAtMs);
  }
};

export const getPerfTraceId = (): string => getRun()?.id ?? '';

export const recordFetchMetric = (
  name:
  | 'tenant_public_fetch_ms'
  | 'tenant_templates_fetch_ms'
  | 'tenant_public_headers_ms'
  | 'tenant_public_json_parse_ms'
  | 'tenant_templates_headers_ms'
  | 'tenant_templates_json_parse_ms',
  value: number,
): void => {
  const run = getRun();
  if (!run) {
    return;
  }
  run.metrics[name] = Math.round(value);
};

export const registerExpectedImage = (key: string): void => {
  const run = getRun();
  if (!run) {
    return;
  }
  run.imagePending.add(key);
};

const detectImageSource = (resourceUrl: string): 'network' | 'sw-cache' | null => {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByName !== 'function') {
    return null;
  }
  const entries = performance.getEntriesByName(resourceUrl, 'resource');
  if (!entries.length) {
    return null;
  }
  const last = entries[entries.length - 1] as PerformanceResourceTiming;
  if (typeof last.transferSize === 'number' && last.transferSize === 0) {
    return 'sw-cache';
  }
  return 'network';
};

export const settleImage = (key: string, errored = false, resourceUrl?: string): void => {
  const run = getRun();
  if (!run) {
    return;
  }
  if (!run.imagePending.has(key)) {
    return;
  }
  run.imagePending.delete(key);
  if (errored) {
    run.imageErrors += 1;
  } else if (resourceUrl) {
    const source = detectImageSource(resourceUrl);
    if (source) {
      recordCacheSource('tenant_asset', source);
    }
  }
  if (run.imagePending.size === 0 && run.metrics.tenant_image_settled_ms === undefined) {
    run.metrics.tenant_image_settled_ms = Math.round(now() - run.startedAtMs);
    flushPerfObservation('images-settled');
  }
};

export const recordCacheSource = (key: string, source: CacheSourceName): void => {
  const run = getRun();
  if (!run) {
    return;
  }
  const metricKey = `${key}:${source}`;
  run.cacheSources[metricKey] = (run.cacheSources[metricKey] ?? 0) + 1;
};

export const flushPerfObservation = (reason: 'data-ready' | 'images-settled' | 'error'): void => {
  const run = getRun();
  if (!run || run.flushed) {
    return;
  }
  const payload = {
    reason,
    traceId: run.id,
    route: run.route,
    tenant: run.tenant,
    totalMs: Math.round(now() - run.startedAtMs),
    metrics: run.metrics,
    imagePending: run.imagePending.size,
    imageErrors: run.imageErrors,
    cacheSources: run.cacheSources,
    suspectedBottleneck: deriveBottleneck(run),
  };
  if (reason === 'images-settled' || reason === 'error') {
    run.flushed = true;
  }
  // eslint-disable-next-line no-console
  console.log('[perf-triage]', payload);
};

const deriveBottleneck = (run: PerfRun): string => {
  const publicMs = run.metrics.tenant_public_fetch_ms ?? 0;
  const templatesMs = run.metrics.tenant_templates_fetch_ms ?? 0;
  const imageMs = run.metrics.tenant_image_settled_ms ?? 0;
  const dataReadyMs = run.metrics.tenant_data_ready_ms ?? 0;
  if (imageMs > dataReadyMs + 200) {
    return 'blob/image load path';
  }
  if (publicMs >= templatesMs && publicMs > 300) {
    return 'tenant-public API/DB path';
  }
  if (templatesMs > publicMs && templatesMs > 300) {
    return 'tenant-templates API/DB path';
  }
  if (dataReadyMs > 500) {
    return 'client fetch + commit path';
  }
  return 'none-obvious';
};
