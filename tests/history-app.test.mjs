import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as core from '../js/core.js';
import { createActivityHistory, HISTORY_KEY } from '../js/history.js';

const source = (await readFile(new URL('../js/app.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '');
import { data } from './fixtures.mjs';

function app(saved = new Map()) {
  const callbacks = new Map();
  let sequence = 0;
  const elements = new Map();
  function element() {
    return { innerHTML: '', textContent: '', childNodes: [], classList: { add() {} },
      setAttribute() {}, addEventListener() {}, append() {}, focus() {}, animate() {},
      querySelector: () => element(), querySelectorAll: () => [] };
  }
  const context = vm.createContext({
    ...core, createActivityHistory,
    localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
    document: { querySelector: selector => { if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); }, createElement: element },
    window: { matchMedia: () => ({ matches: false, addEventListener() {} }), scrollTo() {}, addEventListener() {} },
    navigator: {}, fetch: async () => ({ ok: true, json: async () => data }),
    setTimeout: (fn, ms) => { callbacks.set(++sequence, { fn, ms }); return sequence; },
    clearTimeout: id => callbacks.delete(id)
  });
  vm.runInContext(source, context);
  // Set the loaded fixture synchronously for precise animation control.
  context.fixture = data;
  vm.runInContext('activities = fixture;', context);
  return { context, saved, callbacks, elements };
}

test('Cancelled animation records nothing; reveal records once and favorite redraw does not', () => {
  const a = app();
  vm.runInContext('choose(900);', a.context);
  assert.equal(a.saved.has(HISTORY_KEY), false);
  vm.runInContext('home();', a.context);
  assert.equal(a.callbacks.size, 0);
  assert.equal(a.saved.has(HISTORY_KEY), false);
  vm.runInContext('choose(900);', a.context);
  const pending = [...a.callbacks.values()].find(timer => timer.ms === 900);
  assert.ok(pending);
  pending.fn();
  const first = a.saved.get(HISTORY_KEY);
  assert.equal(Object.keys(JSON.parse(first).lastSeen).length, 1);
  vm.runInContext('render(false);', a.context);
  assert.equal(a.saved.get(HISTORY_KEY), first);
});

test('App reopening and changing filters keeps history while favorites remain random', () => {
  const a = app();
  vm.runInContext("grade=1; filter={kind:'category', value:'upokojenie'}; choose();", a.context);
  const firstId = vm.runInContext('current.id', a.context);
  const reopened = app(a.saved);
  vm.runInContext("grade=1; filter={kind:'all'}; choose();", reopened.context);
  assert.notEqual(vm.runInContext('current.id', reopened.context), firstId);
  assert.equal(Object.keys(JSON.parse(a.saved.get(HISTORY_KEY)).lastSeen).length, 2);
  reopened.context.favoriteId = firstId;
  vm.runInContext("favorites=[favoriteId]; filter={kind:'favorites'}; choose();", reopened.context);
  assert.equal(vm.runInContext('current.id', reopened.context), firstId);
  assert.equal(JSON.parse(a.saved.get(HISTORY_KEY)).lastSeen[firstId], 3);
});

test('Empty catalogue supports navigation and detail renders two closed disclosures', () => {
  const a = app();
  vm.runInContext("activities=[]; choose();", a.context);
  assert.equal(vm.runInContext('screen', a.context), 'empty');
  vm.runInContext('home();', a.context);
  assert.equal(vm.runInContext('screen', a.context), 'home');
  vm.runInContext("activities=fixture; grade=2; filter={kind:'category', value:'komunikacia'}; choose(); choose();", a.context);
  assert.equal(vm.runInContext('current.gradeLevel', a.context), 2);
  assert.equal(vm.runInContext('current.filter', a.context), 'komunikacia');
  const html = a.elements.get('#app').innerHTML;
  assert.equal((html.match(/<details>/g) || []).length, 2);
  assert.doesNotMatch(html, /<details open|<small>Tempo/);
  assert.match(html, /Typ aktivity/);
  assert.match(html, /Pomôcky/);
});

test('Blocked storage reports failure instead of claiming persistence', () => {
  const a = app();
  vm.runInContext("localStorage.setItem = () => { throw Error('Blocked'); };", a.context);
  assert.equal(vm.runInContext("save('rk-favorites-v2', ['001'])", a.context), false);
  assert.match(a.elements.get('#status').textContent, /nepovolil uloženie/);
  const b = app();
  assert.equal(vm.runInContext("save('rk-favorites-v2', ['001'])", b.context), true);
  assert.equal(b.saved.get('rk-favorites-v2'), '["001"]');
});
