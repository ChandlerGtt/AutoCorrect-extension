// scripts/build-dict.js  (CommonJS)
// Usage: node scripts/build-dict.js /path/to/words.txt
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/build-dict.js /path/to/words.txt');
  process.exit(1);
}

const outDir = path.join(process.cwd(), 'assets', 'shards');
fs.mkdirSync(outDir, { recursive: true });

const raw = fs.readFileSync(src, 'utf8');
const words = raw
  .split(/\r?\n/)
  .map(w => w.trim().toLowerCase())
  .filter(w => /^[a-z]+$/.test(w));

const byPrefix = new Map(); // shard by first two letters
for (const w of words) {
  const k = (w[0] || '_') + (w[1] || '_'); // e.g., a_, ab, __
  if (!byPrefix.has(k)) byPrefix.set(k, []);
  byPrefix.get(k).push(w);
}

for (const [k, arr] of byPrefix) {
  arr.sort();
  const dedup = arr.filter((v, i) => i === 0 || v !== arr[i - 1]);
  const gz = zlib.gzipSync(Buffer.from(dedup.join('\n'), 'utf8'), { level: 9 });
  fs.writeFileSync(path.join(outDir, `${k}.txt.gz`), gz);
}

console.log(`✅ Wrote ${byPrefix.size} shards to assets/shards/`);
