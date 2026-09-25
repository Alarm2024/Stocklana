// Fixture test: Jupiter Price API v3 omits tokens without a reliable price (key missing entirely).
// That must surface as UNKNOWN with reason "Jupiter omitted: no reliable price" — never 0, never a crash.
import test from 'node:test';
import assert from 'node:assert/strict';
import { jupiterPriceFor, JUPITER_OMITTED } from '../docs/js/jupiter.js';
import { runPegWatch } from '../docs/js/peg-watch.js';

const PRESENT = 'MintPresent1111111111111111111111111111111';
const OMITTED = 'MintOmitted1111111111111111111111111111111';
// Shape copied from a real Price API v3 reply; OMITTED is simply absent.
const FIXTURE = { [PRESENT]: { usdPrice: 100.5, blockId: 1, decimals: 8, priceChange24h: 0 } };

test('jupiterPriceFor: missing key -> UNKNOWN reason, null price', () => {
  assert.deepEqual(jupiterPriceFor(FIXTURE, OMITTED), { usd: null, entry: null, reason: JUPITER_OMITTED });
  assert.equal(JUPITER_OMITTED, 'Jupiter omitted: no reliable price');
  assert.equal(jupiterPriceFor(FIXTURE, PRESENT).usd, 100.5);
  assert.equal(jupiterPriceFor({}, OMITTED).usd, null);
  assert.equal(jupiterPriceFor(null, OMITTED).usd, null);
});

test('runPegWatch: omitted mint renders UNKNOWN (not 0) and does not throw', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('api.jup.ag/price')) return new Response(JSON.stringify(FIXTURE), { status: 200 });
    if (u.includes('hermes')) return new Response('[]', { status: 200 });
    return new Response('{"jsonrpc":"2.0","id":1,"error":{"message":"offline fixture"}}', { status: 200 }); // RPC
  };
  try {
    const stocks = [
      { symbol: 'AAAx', underlying: 'AAA', mint: PRESENT, pythFeedId: '00'.repeat(32), pythSymbol: 'Equity.US.AAA/USD', pythOnChainAccounts: [] },
      { symbol: 'BBBx', underlying: 'BBB', mint: OMITTED, pythFeedId: '00'.repeat(32), pythSymbol: 'Equity.US.BBB/USD', pythOnChainAccounts: [] },
    ];
    const res = await runPegWatch({ stocks });
    const [a, b] = res.rows;
    assert.equal(a.onChainUsd, 100.5);
    assert.equal(b.onChainUsd, null);
    assert.notEqual(b.onChainUsd, 0);
    assert.equal(b.premiumBpsLabel, 'UNKNOWN');
    assert.ok(b.errors.includes(JUPITER_OMITTED), b.errors.join('; '));
    assert.ok(b.flags.includes('UNKNOWN'));
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('xStocks API: primary host fails -> fallback api.backed.fi answers and is recorded', async () => {
  const { fetchBackedSnapshot } = await import('../docs/js/backed.js');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('api.xstocks.fi')) return new Response('down', { status: 503 });
    if (u.includes('/price-data')) return new Response('{"quote":123.45}', { status: 200 });
    return new Response('{"error":"fixture"}', { status: 500 });
  };
  try {
    const snap = await fetchBackedSnapshot([{ symbol: 'TSTx', mint: PRESENT }]);
    const a = snap.assets[0];
    assert.equal(a.quote.ok, true);
    assert.equal(a.quote.quote, 123.45);
    assert.equal(a.quote.host, 'api.backed.fi');
    assert.equal(a.multiplier.ok, false); // other endpoints fail on both hosts -> UNKNOWN with both errors
    assert.match(a.multiplier.error, /api\.xstocks\.fi: HTTP 503.*api\.backed\.fi: HTTP 500/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
