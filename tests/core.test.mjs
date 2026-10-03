import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FILTERS, validateActivities, filterActivities, pickActivity } from '../js/core.js';
import { data } from './fixtures.mjs';

test('Production database is valid, including an empty catalogue', async () => {
  const catalogue = JSON.parse(await readFile(new URL('../activities.json', import.meta.url), 'utf8'));
  assert.doesNotThrow(() => validateActivities(catalogue));
  assert.deepEqual(validateActivities([]), []);
});
test('Every new filter respects grade and category', () => {
  validateActivities(data);
  for (const grade of [1, 2]) for (const { value } of FILTERS) {
    const pool = filterActivities(data, grade, { kind: 'category', value });
    assert.equal(pool.length, 4);
    assert.ok(pool.every(a => a.gradeLevel === grade && a.filter === value));
  }
});
test('Surprise ignores category and favorites respect grade', () => {
  assert.equal(filterActivities(data, 2, { kind: 'all', value: FILTERS[0].value }).length, 28);
  assert.deepEqual(filterActivities(data, 1, { kind: 'favorites' }, [data[0].id, data[28].id]), [data[0]]);
  assert.equal(pickActivity([]), null);
});
test('Next skips current when possible and supports single activity', () => {
  assert.equal(pickActivity(data.slice(0, 2), data[0].id).id, data[1].id);
  assert.equal(pickActivity([data[0]], data[0].id), data[0]);
});
test('Import rejects old schema, duplicates, missing text and long or wrong step counts', () => {
  assert.throws(() => validateActivities([data[0], data[0]]));
  for (const change of [{ filter: 'pokojné' }, { filter: undefined, tempo: 'živé' }, { steps: ['Jeden'] },
    { steps: Array(5).fill('Krok') }, { steps: ['a'.repeat(161), 'Krok', 'Krok'] },
    { reflection: [] }, { details: '' }, { id: 1 }, { gradeLevel: 3 }, { types: [] }]) {
    assert.throws(() => validateActivities([{ ...data[0], ...change }]));
  }
  assert.throws(() => validateActivities([null]));
  assert.throws(() => validateActivities({}));
  assert.doesNotThrow(() => validateActivities([{ ...data[0], types: ['Ľubovoľný opis typu'] }]));
});
