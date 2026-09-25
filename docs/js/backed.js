/**
 * xStocks (Backed) public API — PUBLIC endpoints only (no key, nothing under /client or /trades).
 * Verified with curl on 2026-09-25:
 *   GET /public/assets/{symbol}                      -> { symbol, underlyingSymbol, isTradingHalted, deployments[] ... }
 *   GET /public/assets/{symbol}/price-data           -> { quote: number }
 *   GET /public/assets/{symbol}/multiplier?network=Solana -> { currentMultiplier, newMultiplier, activationDateTime, reason }
 *   GET /public/system/status/{symbol}               -> { symbol, isMarketTradingHalted, isAtomicTradingHalted }
 *   GET /public/proof-of-reserves/{symbol}           -> { symbol, timestamp, sharesHeld, circulatingSupply, holdings[] }
 * api.backed.fi sends no CORS headers, so the browser reads docs/data/xstocks.json written by
 * scripts/fetch-xstocks.mjs (GitHub Action). This module runs in Node (Action + CLI).
 */
export const BACKED_BASE = 'https://api.backed.fi/api/v2/public';
const SOLANA_RPCS = ['https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com'];
const UA = 'Stocklana-PegWatch/1.0 (+https://github.com/Alarm2024/Stocklana; read-only)';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const errMsg = (e) => String(e?.message || e);

async function getJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}${new URL(url).pathname}`);
  return res.json();
}

/** Wrap one request: { ok, fetched_at, data } or { ok:false, fetched_at, error }. */
async function probe(url, pick) {
  const fetched_at = new Date().toISOString();
  try {
    const data = pick(await getJson(url));
    return { ok: true, fetched_at, source: url, ...data };
  } catch (e) {
    return { ok: false, fetched_at, source: url, error: errMsg(e) };
  }
}

async function rpc(method, params) {
  let last;
  for (const url of SOLANA_RPCS) {
    try {
      const j = await getJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      if (j.error) throw new Error(j.error.message || 'RPC error');
      return j.result;
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

/** Effective Token-2022 ScaledUiAmount multiplier read from the mint account. */
async function onChainMultipliers(mints) {
  const fetched_at = new Date().toISOString();
  try {
    const result = await rpc('getMultipleAccounts', [mints, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
    const nowSec = Math.floor(Date.now() / 1000);
    return mints.map((mint, i) => {
      const v = result?.value?.[i];
      if (!v) return { ok: false, fetched_at, error: 'mint account not found' };
      const ext = v.data?.parsed?.info?.extensions?.find((e) => e.extension === 'scaledUiAmountConfig');
      if (!ext) return { ok: true, fetched_at, multiplier: 1, note: 'no scaledUiAmountConfig extension', slot: result.context?.slot ?? null };
      const s = ext.state;
      const effective =
        Number(s.newMultiplierEffectiveTimestamp) > 0 && nowSec >= Number(s.newMultiplierEffectiveTimestamp)
          ? Number(s.newMultiplier)
          : Number(s.multiplier);
      return {
        ok: Number.isFinite(effective),
        fetched_at,
        multiplier: effective,
        raw: s,
        slot: result.context?.slot ?? null,
        ...(Number.isFinite(effective) ? {} : { error: 'unparseable multiplier' }),
      };
    });
  } catch (e) {
    return mints.map(() => ({ ok: false, fetched_at, error: errMsg(e) }));
  }
}

/** @param {{symbol:string, mint:string}[]} stocks */
export async function fetchBackedSnapshot(stocks) {
  const started = new Date().toISOString();
  const chain = await onChainMultipliers(stocks.map((s) => s.mint));
  const assets = [];
  for (const [i, s] of stocks.entries()) {
    const sym = encodeURIComponent(s.symbol);
    const [asset, quote, multiplier, status, por] = await Promise.all([
      probe(`${BACKED_BASE}/assets/${sym}`, (d) => {
        const sol = (d.deployments || []).find((x) => x.network === 'Solana');
        if (typeof d.isTradingHalted !== 'boolean') throw new Error('isTradingHalted missing');
        return {
          name: d.name ?? null,
          underlyingSymbol: d.underlyingSymbol ?? null,
          isTradingHalted: d.isTradingHalted,
          currentPeriod: d.trading?.currentPeriod ?? null,
          solanaMint: sol?.address ?? null,
          mintMatchesConfig: sol?.address === s.mint,
        };
      }),
      probe(`${BACKED_BASE}/assets/${sym}/price-data`, (d) => {
        if (!isNum(d.quote)) throw new Error('quote missing or not a number');
        return { quote: d.quote };
      }),
      probe(`${BACKED_BASE}/assets/${sym}/multiplier?network=Solana`, (d) => {
        if (!isNum(d.currentMultiplier) || d.currentMultiplier <= 0) throw new Error('currentMultiplier missing');
        return {
          currentMultiplier: d.currentMultiplier,
          newMultiplier: isNum(d.newMultiplier) && d.newMultiplier > 0 ? d.newMultiplier : null,
          activationDateTime: isNum(d.activationDateTime) && d.activationDateTime > 0 ? d.activationDateTime : null,
          reason: d.reason ?? null,
        };
      }),
      probe(`${BACKED_BASE}/system/status/${sym}`, (d) => {
        if (typeof d.isMarketTradingHalted !== 'boolean') throw new Error('isMarketTradingHalted missing');
        return { isMarketTradingHalted: d.isMarketTradingHalted, isAtomicTradingHalted: d.isAtomicTradingHalted ?? null };
      }),
      probe(`${BACKED_BASE}/proof-of-reserves/${sym}`, (d) => {
        if (!d.timestamp || d.sharesHeld == null) throw new Error('timestamp/sharesHeld missing');
        return {
          timestamp: d.timestamp,
          sharesHeld: d.sharesHeld,
          circulatingSupply: d.circulatingSupply ?? null,
          holdings: (d.holdings || []).map((h) => ({ provider: h.provider, quantity: h.quantity, symbol: h.symbol })),
        };
      }),
    ]);
    const c = chain[i];
    const multiplierCheck =
      multiplier.ok && c.ok
        ? {
            status: Math.abs(multiplier.currentMultiplier / c.multiplier - 1) <= 1e-9 ? 'MATCH' : 'DIFF',
            backed: multiplier.currentMultiplier,
            onchain: c.multiplier,
            fetched_at: c.fetched_at,
          }
        : { status: 'UNKNOWN', error: [multiplier.ok ? null : multiplier.error, c.ok ? null : `on-chain: ${c.error}`].filter(Boolean).join('; '), fetched_at: c.fetched_at };
    assets.push({ symbol: s.symbol, mint: s.mint, asset, quote, multiplier, status, proof_of_reserves: por, onchain_multiplier: c, multiplier_check: multiplierCheck });
  }
  return { fetched_at: started, completed_at: new Date().toISOString(), source: BACKED_BASE, assets };
}
