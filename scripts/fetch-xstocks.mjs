#!/usr/bin/env node
/** Writes docs/data/xstocks.json from the xStocks (Backed) PUBLIC API + on-chain multiplier check. */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STOCKS } from '../docs/js/config.js';
import { fetchBackedSnapshot } from '../docs/js/backed.js';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/data/xstocks.json');
const snap = await fetchBackedSnapshot(STOCKS);
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(snap, null, 2) + '\n');
let failures = 0;
for (const a of snap.assets) {
  const parts = ['asset', 'quote', 'multiplier', 'status', 'proof_of_reserves'].filter((k) => !a[k].ok);
  failures += parts.length;
  console.log(
    `${a.symbol}\tquote ${a.quote.ok ? a.quote.quote : 'UNKNOWN'}\tmult ${a.multiplier.ok ? a.multiplier.currentMultiplier : 'UNKNOWN'} (${a.multiplier_check.status})\thalted ${a.asset.ok ? a.asset.isTradingHalted : 'UNKNOWN'}\tPoR ${a.proof_of_reserves.ok ? a.proof_of_reserves.timestamp : 'UNKNOWN'}${parts.length ? '\tFAILED: ' + parts.join(',') : ''}`,
  );
}
console.log('fetched_at', snap.fetched_at);
if (failures === snap.assets.length * 5) process.exitCode = 1; // everything failed
