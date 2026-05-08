const APP_SHELL_CACHE = 'nodoubt-shell-v3';
const API_CACHE = 'nodoubt-api-runtime-v1';
const ASSET_CACHE = 'nodoubt-asset-runtime-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];
const TEN_MINUTES_MS = 10 * 60 * 1000;
const MAX_ASSET_ENTRIES = 60;

const appendHeader = (response, key, value) => {
  const headers = new Headers(response.headers);
  headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const isApiRuntimeRequest = (url) =>
  url.pathname === '/api/tenant-public' || url.pathname === '/api/tenant-templates';
const isAssetRuntimeRequest = (url) => url.pathname === '/api/tenant-asset';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => ![APP_SHELL_CACHE, API_CACHE, ASSET_CACHE].includes(key))
        .map((key) => caches.delete(key)),
    )),
  );
});

const readRuntimeEntry = async (cache, request) => {
  const cached = await cache.match(request);
  if (!cached) {
    return { response: null, fetchedAt: 0 };
  }
  const fetchedAt = Number(cached.headers.get('x-sw-fetched-at') ?? 0);
  return { response: cached, fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : 0 };
};

const writeRuntimeEntry = async (cache, request, response) => {
  const headers = new Headers(response.headers);
  headers.set('x-sw-fetched-at', String(Date.now()));
  await cache.put(request, new Response(await response.clone().arrayBuffer(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  }));
};

const trimAssetCache = async () => {
  const cache = await caches.open(ASSET_CACHE);
  const keys = await cache.keys();
  if (keys.length <= MAX_ASSET_ENTRIES) {
    return;
  }
  const entries = await Promise.all(keys.map(async (request) => {
    const item = await cache.match(request);
    const fetchedAt = Number(item?.headers.get('x-sw-fetched-at') ?? 0);
    return { request, fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : 0 };
  }));
  entries.sort((a, b) => a.fetchedAt - b.fetchedAt);
  const toDelete = entries.slice(0, Math.max(0, keys.length - MAX_ASSET_ENTRIES));
  await Promise.all(toDelete.map((item) => cache.delete(item.request)));
};

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  const url = new URL(event.request.url);

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put('/index.html', responseClone));
          return response;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  if (isApiRuntimeRequest(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(API_CACHE);
      const cached = await readRuntimeEntry(cache, event.request);
      if (cached.response && Date.now() - cached.fetchedAt <= TEN_MINUTES_MS) {
        event.waitUntil(
          fetch(event.request)
            .then(async (response) => {
              if (response.status === 200) {
                await writeRuntimeEntry(cache, event.request, response);
              }
            })
            .catch(() => undefined),
        );
        return appendHeader(cached.response, 'x-sw-cache', 'hit');
      }
      try {
        const network = await fetch(event.request);
        if (network.status === 200) {
          await writeRuntimeEntry(cache, event.request, network);
        }
        return appendHeader(network, 'x-sw-cache', 'network');
      } catch {
        if (cached.response) {
          return appendHeader(cached.response, 'x-sw-cache', 'stale');
        }
        throw new Error('Network unavailable');
      }
    })());
    return;
  }

  if (isAssetRuntimeRequest(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await readRuntimeEntry(cache, event.request);
      if (cached.response && Date.now() - cached.fetchedAt <= TEN_MINUTES_MS) {
        return appendHeader(cached.response, 'x-sw-cache', 'hit');
      }
      try {
        const network = await fetch(event.request);
        if (network.status === 200) {
          await writeRuntimeEntry(cache, event.request, network);
          await trimAssetCache();
        }
        return appendHeader(network, 'x-sw-cache', 'network');
      } catch {
        if (cached.response) {
          return appendHeader(cached.response, 'x-sw-cache', 'stale');
        }
        throw new Error('Network unavailable');
      }
    })());
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseClone = response.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match('/index.html'));
    }),
  );
});
