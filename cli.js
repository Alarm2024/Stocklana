#!/usr/bin/env node
import { runPegWatch, formatTable } from './docs/js/peg-watch.js';

const result = await runPegWatch();
console.log(formatTable(result));

const failed = result.rows.filter((r) => r.errors.length);
if (failed.length) {
  console.error('\nErrors:');
  for (const r of failed) {
    console.error(`  ${r.symbol}: ${r.errors.join('; ')}`);
  }
  process.exit(1);
}
