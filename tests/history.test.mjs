import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FILTERS, filterActivities, pickActivity } from '../js/core.js';
import { HISTORY_KEY, createActivityHistory } from '../js/history.js';

import { data } from './fixtures.mjs';
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
function cycle(pool, history, previous = null) {
  const seen = [];
  for (let i = 0; i < pool.length; i++) {
    const next = pickActivity(pool, previous, Math.random, history.snapshot());
    history.record(next.id);
    seen.push(next.id);
    previous = next.id;
  }
  assert.equal(new Set(seen).size, pool.length);
  return seen;
}

test('All filters and both grades exhaust unseen activities before repeating', () => {
  for (const grade of [1, 2]) {
    for (const filter of [{ kind: 'all' }, ...FILTERS.map(({value}) => ({ kind: 'category', value }))]) {
      const pool = filterActivities(data, grade, filter);
      const history = createActivityHistory(storage());
      const first = cycle(pool, history);
      // Once all are seen, strict oldest-first revisits the original order.
      assert.deepEqual(cycle(pool, history, first.at(-1)), first);
      assert.ok(pool.every(a => a.gradeLevel === grade));
    }
  }
});

for (const count of [1, 2, 6, 200]) test(`History survives reopening throughout a ${count}-activity pool`, () => {
  const pool = Array.from({ length: count }, (_, i) => ({ ...data[0], id: `test-${i}` }));
  const saved = storage();
  let history = createActivityHistory(saved);
  const used = [];
  for (let i = 0; i < count; i++) {
    history = createActivityHistory(saved);
    const next = pickActivity(pool, null, Math.random, history.snapshot());
    assert.ok(!used.includes(next.id));
    used.push(next.id);
    history.record(next.id);
  }
  assert.equal(pickActivity(pool, null, Math.random, createActivityHistory(saved).snapshot()).id, used[0]);
});

test('Equal priorities are resolved randomly, including unseen and equally old items', () => {
  const pool = data.slice(0, 3);
  for (const lastSeen of [{}, Object.fromEntries(pool.map(a => [a.id, 7]))]) {
    assert.equal(pickActivity(pool, null, () => 0, lastSeen), pool[0]);
    assert.equal(pickActivity(pool, null, () => .99, lastSeen), pool[2]);
  }
});

test('Current activity is excluded even if it is the only unseen candidate', () => {
  const pool = data.slice(0, 2);
  assert.equal(pickActivity(pool, pool[0].id, () => 0, { [pool[1].id]: 1 }), pool[1]);
  assert.equal(pickActivity([pool[0]], pool[0].id), pool[0]);
  assert.equal(pickActivity([], null), null);
});

test('Shared history follows IDs across filters and gives new IDs priority', () => {
  const history = createActivityHistory(storage());
  const a = data[0];
  history.record(a.id);
  const filtered = filterActivities(data, a.gradeLevel, { kind: 'category', value: a.filter });
  assert.notEqual(pickActivity(filtered, null, () => 0, history.snapshot()).id, a.id);
  const newActivity = { ...a, id: 'new-id-with-same-title' };
  assert.equal(pickActivity([a, newActivity], null, () => 0, history.snapshot()), newActivity);
  history.record('removed-id');
  assert.equal(pickActivity([a], null, () => 0, history.snapshot()), a);
});

test('Corrupt storage is ignored and favorites and grade keys remain untouched', () => {
  for (const raw of ['broken JSON', 'null', '[]', '{"version":2}', '{"version":1,"lastSeen":[]}']) {
    const saved = storage({ [HISTORY_KEY]: raw, 'rk-favorites': '["rk-001"]', 'rk-grade': '2' });
    const history = createActivityHistory(saved);
    assert.deepEqual(history.snapshot(), {});
    history.record('rk-001');
    assert.deepEqual(history.snapshot(), { 'rk-001': 1 });
    assert.equal(saved.getItem('rk-favorites'), '["rk-001"]');
    assert.equal(saved.getItem('rk-grade'), '2');
  }
  const history = createActivityHistory(storage({ [HISTORY_KEY]: JSON.stringify({ version: 1, lastSeen: { good: 4, negative: -1, string: '2', fraction: .5, bad: null } }) }));
  assert.deepEqual(history.snapshot(), { good: 4 });
});

test('Blocked reads and writes retain useful history for the current session', () => {
  const history = createActivityHistory({ getItem() { throw Error('Blocked'); }, setItem() { throw Error('Full'); } });
  const first = cycle(data.slice(0, 6), history);
  assert.equal(pickActivity(data.slice(0, 6), null, Math.random, history.snapshot()).id, first[0]);
});

test('Open instances read one another’s history before their next selection', () => {
  const saved = storage();
  const first = createActivityHistory(saved), second = createActivityHistory(saved);
  first.record(data[0].id);
  assert.equal(second.snapshot()[data[0].id], 1);
  second.record(data[1].id);
  assert.equal(first.snapshot()[data[1].id], 2);
});

test('Favorites keep the old random selection regardless of history', () => {
  const favoriteIds = [data[0].id, data[1].id, data[22].id];
  const pool = filterActivities(data, 1, { kind: 'favorites' }, favoriteIds);
  const history = createActivityHistory(storage());
  history.record(data[0].id);
  assert.equal(pickActivity(pool, null, () => 0), data[0]);
  assert.equal(pickActivity(pool, data[0].id, () => 0), data[1]);
  assert.deepEqual(favoriteIds, [data[0].id, data[1].id, data[22].id]);
});
