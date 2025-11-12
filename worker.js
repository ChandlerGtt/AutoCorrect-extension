// In Blob-loaded worker, relative paths break. Use the base we injected.
importScripts(self.__ac_base + 'libs/pako.min.js'); // exposes global `pako`


const ABC = 'abcdefghijklmnopqrstuvwxyz';
const shardCache = new Map(); // key -> Set(words)
const lru = [];
const MAX_SHARDS = 6;

function shardKey(word) {
  const w = (word || '').toLowerCase();
  return (w[0] || '_') + (w[1] || '_'); // "ab", "a_", "__"
}

async function loadShard(key) {
  if (shardCache.has(key)) return shardCache.get(key);
  try {
    const url = chrome.runtime.getURL(`assets/shards/${key}.txt.gz`);
    const res = await fetch(url);
    if (!res.ok) return new Set();
    const gz = new Uint8Array(await res.arrayBuffer());
    const txt = new TextDecoder().decode(pako.ungzip(gz));
    const set = new Set(txt.split('\n').filter(Boolean));
    shardCache.set(key, set);

    // naive LRU
    lru.push(key);
    if (lru.length > MAX_SHARDS) {
      const old = lru.shift();
      if (old && old !== key) shardCache.delete(old);
    }
    return set;
  } catch (e) {
    return new Set();
  }
}

function neighborKeys(key) {
  const a = key[0], b = key[1];
  const out = new Set([key, '_' + b, a + '_', '__']);
  for (const c of ABC) { out.add(c + b); out.add(a + c); }
  return Array.from(out);
}

async function candidateUniverse(word) {
  const keys = neighborKeys(shardKey(word));
  const sets = await Promise.all(keys.map(loadShard));
  const merged = new Set();
  for (const s of sets) for (const w of s) merged.add(w);
  return merged;
}

function edits1(w) {
  const out = new Set();
  for (let i = 0; i <= w.length; i++) {
    for (const c of ABC) out.add(w.slice(0, i) + c + w.slice(i)); // insert
  }
  for (let i = 0; i < w.length; i++) {
    out.add(w.slice(0, i) + w.slice(i + 1)); // delete
    for (const c of ABC) out.add(w.slice(0, i) + c + w.slice(i + 1)); // replace
    if (i < w.length - 1) out.add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2)); // transpose
  }
  return out;
}

function rank(cands, target) {
  const t = target.toLowerCase();
  return Array.from(cands).sort((a, b) => {
    const da = Math.abs(a.length - t.length);
    const db = Math.abs(b.length - t.length);
    return da === db ? a.localeCompare(b) : da - db;
  });
}

self.onmessage = async ({ data }) => {
  const raw = (data.word || '').toLowerCase();
  if (!raw || !/^[a-z]+$/.test(raw)) {
    postMessage({ suggestions: [] });
    return;
  }
  const universe = await candidateUniverse(raw);
  if (universe.has(raw)) { postMessage({ suggestions: [] }); return; }

  const near = new Set();
  for (const e1 of edits1(raw)) if (universe.has(e1)) near.add(e1);
  postMessage({ suggestions: rank(near, raw).slice(0, 8) });
};
