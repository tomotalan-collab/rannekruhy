import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
import { data as activities } from './fixtures.mjs';
const url = 'https://example.com/ranne-kruhy/activities.json';
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

function worker(fetchImpl, { cached = json(activities), failWrite = false, fastTimeout = false } = {}) {
  const listeners = {};
  let saved = cached;
  const cache = {
    match: async key => { assert.equal(key, url); return saved?.clone(); },
    put: async (key, response) => { assert.equal(key, url); if (failWrite) throw Error('Full'); saved = response; }
  };
  const context = vm.createContext({
    URL, Response, AbortController,
    setTimeout: (fn, ms) => { assert.equal(ms, 3000); return setTimeout(fn, fastTimeout ? 5 : ms); },
    clearTimeout,
    fetch: fetchImpl,
    caches: { open: async () => cache },
    self: { location: new URL('https://example.com/ranne-kruhy/sw.js'), addEventListener: (name, fn) => listeners[name] = fn }
  });
  vm.runInContext(source, context);
  return {
    load: () => {
      let result;
      listeners.fetch({ request: { url, method: 'GET' }, respondWith: value => result = value });
      assert.ok(result, 'Subdirectory activities requests must use network-first');
      return result;
    },
    stored: () => saved?.clone(),
    context
  };
}

test('New online activities replace cached data without changing the cache version', async () => {
  const newer = [...activities, { ...activities[0], id: 'new-activity' }];
  const w = worker(async (request, options) => {
    assert.equal(request.url, url);
    assert.equal(options.cache, 'no-store');
    return json(newer);
  });
  assert.deepEqual(await (await w.load()).json(), newer);
  assert.deepEqual(await w.stored().json(), newer);
});

for (const [name, fetchImpl] of [
  ['offline', async () => { throw Error('Offline'); }],
  ['HTTP failure', async () => new Response('Unavailable', { status: 503 })],
  ['invalid JSON', async () => new Response('<html>Error</html>')],
  ['invalid activity', async () => json([{ id: 'broken' }])],
]) test(`${name} preserves and returns the previous offline activities`, async () => {
  const w = worker(fetchImpl);
  assert.deepEqual(await (await w.load()).json(), activities);
  assert.deepEqual(await w.stored().json(), activities);
});

test('Slow connection is aborted at the timeout and uses offline data', async () => {
  let aborted = false;
  const w = worker((request, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(Error('Timeout')); });
  }), { fastTimeout: true });
  assert.deepEqual(await (await w.load()).json(), activities);
  assert.ok(aborted);
});

test('Valid online activities still work when cache storage is full', async () => {
  const w = worker(async () => json(activities), { failWrite: true });
  assert.deepEqual(await (await w.load()).json(), activities);
});

test('Offline without a saved copy returns a network error', async () => {
  const w = worker(async () => { throw Error('Offline'); }, { cached: null });
  assert.equal((await w.load()).type, 'error');
});

test('Empty database replaces cached activities and remains available offline', async () => {
  const w = worker(async () => json([]));
  assert.deepEqual(await (await w.load()).json(), []);
  assert.deepEqual(await w.stored().json(), []);
});

test('Offline validator agrees with application schema', async () => {
  const { validateActivities } = await import('../js/core.js');
  const w = worker(async () => json([]));
  for (const data of [[], activities, [{ ...activities[0], reflection: [] }],
    [{ ...activities[0], filter: 'old' }], [{ ...activities[0], steps: ['One'] }]]) {
    let accepted = true;
    try { validateActivities(data); } catch { accepted = false; }
    w.context.fixture = data;
    assert.equal(vm.runInContext('(() => { try { validateActivities(fixture); return true; } catch { return false; } })()', w.context), accepted);
  }
});

test('Upgrade activates immediately and reloads existing tabs without blocking activation', async () => {
  const listeners = {};
  const calls = [];
  const context = vm.createContext({ URL,
    caches: {
      open: async () => ({ addAll: async () => calls.push('cached') }),
      keys: async () => ['ranne-kruhy-v12', 'ranne-kruhy-v18', 'ranne-kruhy-v26', 'other-app'],
      delete: async key => calls.push(key)
    },
    self: {
      location: new URL('https://example.com/sw.js'),
      addEventListener: (name, fn) => listeners[name] = fn,
      skipWaiting: async () => calls.push('skipWaiting'),
      clients: {
        claim: async () => calls.push('claim'),
        matchAll: async () => [{ url: 'https://example.com/', navigate: () => {
          calls.push('navigate'); return new Promise(() => {});
        } }]
      }
    }
  });
  vm.runInContext(source, context);
  let pending;
  listeners.install({ waitUntil: promise => pending = promise });
  await pending;
  listeners.activate({ waitUntil: promise => pending = promise });
  await pending;
  assert.deepEqual(calls, ['cached', 'skipWaiting', 'ranne-kruhy-v12', 'ranne-kruhy-v18', 'claim', 'navigate']);
});
