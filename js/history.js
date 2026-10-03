export const HISTORY_KEY = 'rk-activity-history-v2';

function decode(raw) {
  try {
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !data.lastSeen || typeof data.lastSeen !== 'object' || Array.isArray(data.lastSeen)) return {};
    return Object.fromEntries(Object.entries(data.lastSeen).filter(([id, order]) =>
      id.length > 0 && Number.isSafeInteger(order) && order > 0));
  } catch { return {}; }
}

// Storage is injected so unavailable localStorage never prevents selection.
export function createActivityHistory(storage) {
  let lastSeen = {};
  function snapshot() {
    try {
      const saved = decode(storage.getItem(HISTORY_KEY));
      // Merge other tabs' observations and retain this session if a write failed.
      lastSeen = Object.fromEntries([...new Set([...Object.keys(lastSeen), ...Object.keys(saved)])]
        .map(id => [id, Math.max(Object.hasOwn(lastSeen, id) ? lastSeen[id] : 0, Object.hasOwn(saved, id) ? saved[id] : 0)]));
    } catch { /* Continue with this session's history. */ }
    return { ...lastSeen };
  }
  function record(id) {
    snapshot();
    let latest = Object.values(lastSeen).reduce((max, order) => Math.max(max, order), 0);
    if (latest === Number.MAX_SAFE_INTEGER) {
      const ranks = new Map([...new Set(Object.values(lastSeen))].sort((a, b) => a - b).map((order, i) => [order, i + 1]));
      lastSeen = Object.fromEntries(Object.entries(lastSeen).map(([key, order]) => [key, ranks.get(order)]));
      latest = ranks.size;
    }
    lastSeen = { ...lastSeen, [id]: latest + 1 };
    try { storage.setItem(HISTORY_KEY, JSON.stringify({ version: 1, lastSeen })); }
    catch { /* Preserve history in memory without adding UI or interrupting the activity. */ }
  }
  return { snapshot, record };
}
