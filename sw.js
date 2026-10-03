const CACHE = 'ranne-kruhy-v26';
const ASSETS = ['./','./index.html','./styles.css','./js/app.js','./js/core.js','./js/history.js','./activities.json','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png'];
const ACTIVITIES_URL = new URL('./activities.json', self.location.href).href;

const FILTERS = [
  { value: 'uvod-skolskeho-roka', label: 'Úvod školského roka', emoji: '🌱' },
  { value: 'upokojenie', label: 'Upokojenie', emoji: '😌' },
  { value: 'zvysenie-energie', label: 'Zvýšenie energie', emoji: '⚡' },
  { value: 'zvladanie-vyziev', label: 'Zvládanie výziev', emoji: '💪' },
  { value: 'posilnenie-vztahov', label: 'Posilnenie vzťahov', emoji: '❤️' },
  { value: 'praca-s-emociami', label: 'Práca s emóciami', emoji: '😊' },
  { value: 'komunikacia', label: 'Komunikácia', emoji: '💬' }
];
function validateActivities(data) {
  if (!Array.isArray(data)) throw new Error('Aktivity musia byť pole.');
  const ids = new Set();
  const text = value => typeof value === 'string' && value.trim().length > 0;
  for (const a of data) {
    if (!a || !text(a.id) || ids.has(a.id) || !text(a.title) ||
        ![1, 2].includes(a.gradeLevel) || !FILTERS.some(f => f.value === a.filter) ||
        !Array.isArray(a.types) || !a.types.length || !a.types.every(text) ||
        !text(a.materials) || !Array.isArray(a.steps) || a.steps.length < 3 ||
        a.steps.length > 4 || !a.steps.every(s => text(s) && s.length <= 160) ||
        !Array.isArray(a.reflection) || !a.reflection.length || !a.reflection.every(text) ||
        !text(a.details)) throw new Error('Neplatná aktivita: ' + a?.id);
    ids.add(a.id);
  }
  return data;
}

async function loadActivities(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    // Bypass the browser HTTP cache as well as the service worker cache.
    const response = await fetch(request, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('Activities request failed');
    validateActivities(await response.clone().json());
    clearTimeout(timeout);
    // A storage failure must not prevent using a valid online response.
    try {
      const cache = await caches.open(CACHE);
      await cache.put(ACTIVITIES_URL, response.clone());
    } catch { /* Offline storage may be unavailable or full. */ }
    return response;
  } catch {
    const cache = await caches.open(CACHE);
    return (await cache.match(ACTIVITIES_URL)) || Response.error();
  } finally {
    clearTimeout(timeout);
  }
}
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const obsolete = (await caches.keys()).filter(key => key.startsWith('ranne-kruhy-') && key !== CACHE);
    await Promise.all(obsolete.map(key => caches.delete(key)));
    await self.clients.claim();
    // Existing tabs can still contain the old app even after the worker changes.
    // Reload them only on an upgrade, after the complete new app is cached.
    if (obsolete.length) {
      const windows = await self.clients.matchAll({ type: 'window' });
      windows.forEach(client => { client.navigate(client.url).catch(() => {}); });
    }
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method!=='GET' || new URL(event.request.url).origin!==self.location.origin) return;
  if (new URL(event.request.url).pathname === new URL(ACTIVITIES_URL).pathname) {
    event.respondWith(loadActivities(event.request));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached || fetch(event.request).catch(()=>event.request.mode==='navigate' ? caches.match('./index.html') : Response.error())));
});
