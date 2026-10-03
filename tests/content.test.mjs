import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const activities = JSON.parse(await readFile(new URL('../activities.json', import.meta.url), 'utf8'));

test('Editorial content has no broken sentences, duplicated steps or placeholder instructions', () => {
  for (const a of activities) {
    assert.equal(new Set(a.steps).size, a.steps.length, `${a.id}: repeated step`);
    for (const step of a.steps) {
      assert.match(step, /^[A-ZÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]/u, `${a.id}: sentence fragment`);
      // A quoted sentence stem is intentional in activities such as Nedokončené vety.
      assert.match(step, /(?:[.!?][“»]?|…“)$/u, `${a.id}: unfinished step`);
      assert.doesNotMatch(step, /(?:napr\.|t\.\s*j\.|…|\.\.\.)$/u, `${a.id}: truncated ending`);
      assert.doesNotMatch(step, /vykonajú podľa dohodnutých pravidiel|Na záver sa trieda krátko podelí o svoj zážitok/u, `${a.id}: placeholder`);
    }
    for (const value of [...a.steps, a.details, ...a.reflection]) {
      assert.equal((value.match(/„/g) || []).length, (value.match(/“/g) || []).length, `${a.id}: unclosed quotation`);
      assert.equal((value.match(/\(/g) || []).length, (value.match(/\)/g) || []).length, `${a.id}: unclosed parentheses`);
    }
    assert.notEqual(a.details, a.steps.join(' '), `${a.id}: detail repeats the quick guide`);
    for (const step of a.steps) {
      assert.ok(!a.details.includes(step), `${a.id}: detail copies a full quick step`);
    }
  }
});

test('Materials do not contain malformed web links', () => {
  for (const a of activities) {
    assert.doesNotMatch(a.materials, /https?:\/\/\S*\s+\S*\.(?:com|sk|org)/u, `${a.id}: broken URL`);
  }
});
