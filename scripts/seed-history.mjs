#!/usr/bin/env node
/**
 * One-off: seed docs/data/history.json from REAL past snapshots in git history.
 * Only docs/data/prestocks.json versions exist before the history feature, and they contain the
 * headline premium only (no depth quotes, no xStocks premium) — so seeded points carry only
 * prestocks.{SYM}.p. Timestamps are the snapshot's own fetched_at; source records the commit sha.
 * Nothing is interpolated.
 */
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

const FILE = 'docs/data/prestocks.json';
const HP = 'docs/data/history.json';
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 << 20 });

const shas = git('log', '--all', '--format=%H', '--', FILE).trim().split('\n').filter(Boolean);
let hist;
try {
  hist = JSON.parse(await readFile(HP, 'utf8'));
} catch {
  hist = { version: 1, cap_days: 14, points: [] };
}
const have = new Set(hist.points.map((p) => p.t));
let added = 0;
for (const sha of shas) {
  let snap;
  try {
    snap = JSON.parse(git('show', `${sha}:${FILE}`));
  } catch {
    continue; // file deleted/invalid at that commit
  }
  if (!snap.fetched_at || have.has(snap.fetched_at)) continue;
  const point = { t: snap.fetched_at, source: `git:${sha.slice(0, 7)}`, prestocks: {}, xstocks: {} };
  for (const t of snap.tokens || []) {
    if (typeof t.premium === 'number') point.prestocks[t.symbol] = { p: Number(t.premium.toFixed(6)), b10k: null, s10k: null };
  }
  hist.points.push(point);
  have.add(snap.fetched_at);
  added++;
}
const cutoff = Date.now() - (hist.cap_days || 14) * 86400000;
hist.points = hist.points.filter((p) => new Date(p.t).getTime() >= cutoff).sort((a, b) => a.t.localeCompare(b.t));
hist.updated_at = new Date().toISOString();
await writeFile(HP, JSON.stringify(hist, null, 1) + '\n');
console.log(`seeded ${added} point(s) from ${shas.length} commit(s); total ${hist.points.length}`);
