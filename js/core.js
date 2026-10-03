export const FILTERS = [
  { value: 'uvod-skolskeho-roka', label: 'Úvod školského roka', emoji: '🌱' },
  { value: 'upokojenie', label: 'Upokojenie', emoji: '😌' },
  { value: 'zvysenie-energie', label: 'Zvýšenie energie', emoji: '⚡' },
  { value: 'zvladanie-vyziev', label: 'Zvládanie výziev', emoji: '💪' },
  { value: 'posilnenie-vztahov', label: 'Posilnenie vzťahov', emoji: '❤️' },
  { value: 'praca-s-emociami', label: 'Práca s emóciami', emoji: '😊' },
  { value: 'komunikacia', label: 'Komunikácia', emoji: '💬' }
];
export function validateActivities(data) {
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
export function filterActivities(data, grade, filter, favorites = []) {
  return data.filter(a => a.gradeLevel === grade &&
    (filter.kind !== 'category' || a.filter === filter.value) &&
    (filter.kind !== 'favorites' || favorites.includes(a.id)));
}
export function pickActivity(pool, currentId, random = Math.random, lastSeen = {}) {
  const others = pool.filter(a => a.id !== currentId);
  const candidates = others.length ? others : pool;
  const priority = a => Object.hasOwn(lastSeen, a.id) ? lastSeen[a.id] : 0;
  const oldest = candidates.reduce((min, a) => Math.min(min, priority(a)), Infinity);
  const choices = candidates.filter(a => priority(a) === oldest);
  return choices.length ? choices[Math.floor(random() * choices.length)] : null;
}
