#!/usr/bin/env node
/**
 * PreStocks snapshot: fetches the PreStocks public API plus on-chain cross-checks
 * (Jupiter Price API v3, Solana RPC getTokenSupply / getAccountInfo) and writes
 * docs/data/prestocks.json. Read-only; no keys. Run by .github/workflows/prestocks-snapshot.yml
 * because prestocks.com/api/prestocks does not send CORS headers (browser fetch is blocked).
 *
 * Every value carries the fetch time of its source. Failures are recorded as
 * { ok: false, error } — never as 0.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'docs/data/prestocks.json');

const PRESTOCKS_API = 'https://prestocks.com/api/prestocks';
const JUPITER_PRICE = 'https://api.jup.ag/price/v3';
const RPCS = ['https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com'];
const UA = 'Stocklana-PegWatch/1.0 (+https://github.com/Alarm2024/Stocklana; read-only snapshot)';

const MATCH_TOLERANCE = 0.01; // 1% for price; supply compared with tiny float tolerance
const SUPPLY_TOLERANCE = 1e-6;

const now = () => new Date().toISOString();
const errMsg = (e) => String(e?.message || e);

async function getJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

async function rpc(method, params) {
  let last;
  for (const url of RPCS) {
    try {
      const j = await getJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      if (j.error) throw new Error(`RPC ${method}: ${j.error.message || JSON.stringify(j.error)}`);
      return { result: j.result, rpc: url };
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error('all RPC endpoints failed');
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function relDiff(a, b) {
  if (!isNum(a) || !isNum(b) || b === 0) return null;
  return a / b - 1;
}

async function main() {
  let previous = null;
  try {
    previous = JSON.parse(await readFile(OUT, 'utf8'));
  } catch {
    /* first run */
  }

  // 1. PreStocks API
  const psFetchedAt = now();
  let tokensRaw;
  try {
    tokensRaw = await getJson(PRESTOCKS_API);
    if (!Array.isArray(tokensRaw)) throw new Error('unexpected response shape (not an array)');
  } catch (e) {
    // Keep the last good snapshot, record the failed attempt honestly.
    const error = `PreStocks API failed: ${errMsg(e)}`;
    console.error(error);
    if (previous?.tokens) {
      previous.last_attempt = { at: psFetchedAt, ok: false, error };
      await writeFile(OUT, JSON.stringify(previous, null, 2) + '\n');
      console.error('Kept previous snapshot from', previous.fetched_at);
    } else {
      await mkdir(dirname(OUT), { recursive: true });
      await writeFile(
        OUT,
        JSON.stringify({ fetched_at: null, last_attempt: { at: psFetchedAt, ok: false, error }, tokens: [] }, null, 2) + '\n',
      );
    }
    process.exitCode = 1;
    return;
  }

  const mints = tokensRaw.map((t) => t.contract_address).filter(Boolean);

  // 2. Jupiter prices (one batch)
  const jupFetchedAt = now();
  let jup = { ok: false, error: 'not fetched' };
  try {
    jup = { ok: true, data: await getJson(`${JUPITER_PRICE}?ids=${mints.join(',')}`) };
  } catch (e) {
    jup = { ok: false, error: `Jupiter: ${errMsg(e)}` };
  }

  // 3. Per-token on-chain checks
  const tokens = [];
  for (const t of tokensRaw) {
    const mint = t.contract_address;
    const markPrice = isNum(t.markPrice) ? t.markPrice : null;
    const tokenPrice = isNum(t.tokenPrice) ? t.tokenPrice : null;
    const premium = relDiff(tokenPrice, markPrice);

    const row = {
      symbol: t.symbol ?? null,
      name: t.name ?? null,
      mint: mint ?? null,
      external_url: t.external_url ?? null,
      prestocks: {
        fetched_at: psFetchedAt,
        markPrice,
        tokenPrice,
        markValuation: isNum(t.markValuation) ? t.markValuation : null,
        impliedValuation: isNum(t.impliedValuation) ? t.impliedValuation : null,
        supply: isNum(t.supply) ? t.supply : null,
      },
      premium,
      premium_flag: premium == null ? 'UNKNOWN' : premium >= 0.1 ? 'RICH vs mark' : premium <= -0.1 ? 'CHEAP vs mark' : null,
      checks: {},
    };

    // Jupiter price cross-check (Jupiter usdPrice is already expressed in UI units,
    // i.e. after any Token-2022 ScaledUiAmount multiplier)
    if (!jup.ok) {
      row.checks.jupiter_price = { status: 'UNKNOWN', error: jup.error, fetched_at: jupFetchedAt };
    } else {
      const e = jup.data?.[mint];
      if (!e || !isNum(e.usdPrice)) {
        row.checks.jupiter_price = { status: 'UNKNOWN', error: 'Jupiter omitted: no reliable price', fetched_at: jupFetchedAt };
      } else if (tokenPrice == null) {
        row.checks.jupiter_price = { status: 'UNKNOWN', error: 'PreStocks tokenPrice missing', jupiter: e.usdPrice, fetched_at: jupFetchedAt };
      } else {
        const d = relDiff(tokenPrice, e.usdPrice);
        row.checks.jupiter_price = {
          status: Math.abs(d) <= MATCH_TOLERANCE ? 'MATCH' : 'DIFF',
          prestocks: tokenPrice,
          jupiter: e.usdPrice,
          diff: d,
          jupiter_block_id: e.blockId ?? null,
          scaled_ui_config: e.scaledUiConfig
            ? {
                multiplier: e.scaledUiConfig.multiplier ?? null,
                newMultiplier: e.scaledUiConfig.newMultiplier ?? null,
                newMultiplierEffectiveAt: e.scaledUiConfig.newMultiplierEffectiveAt ?? null,
              }
            : null,
          fetched_at: jupFetchedAt,
        };
      }
    }

    // Supply vs getTokenSupply
    const supFetchedAt = now();
    try {
      const { result, rpc: used } = await rpc('getTokenSupply', [mint, { commitment: 'confirmed' }]);
      const onchain = Number(result?.value?.uiAmountString);
      if (!Number.isFinite(onchain)) throw new Error('getTokenSupply returned no uiAmountString');
      const ps = row.prestocks.supply;
      const d = relDiff(ps, onchain);
      row.checks.supply = {
        status: d == null ? 'UNKNOWN' : Math.abs(d) <= SUPPLY_TOLERANCE ? 'MATCH' : 'DIFF',
        prestocks: ps,
        onchain,
        slot: result?.context?.slot ?? null,
        rpc: used,
        fetched_at: supFetchedAt,
        ...(d == null ? { error: 'PreStocks supply missing' } : {}),
      };
    } catch (e) {
      row.checks.supply = { status: 'UNKNOWN', error: errMsg(e), fetched_at: supFetchedAt };
    }

    // Mint exists via getAccountInfo
    const accFetchedAt = now();
    try {
      const { result, rpc: used } = await rpc('getAccountInfo', [mint, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
      const v = result?.value;
      if (!v) {
        row.checks.mint_exists = { status: 'NOT FOUND', fetched_at: accFetchedAt, rpc: used };
      } else {
        row.checks.mint_exists = {
          status: v.data?.parsed?.type === 'mint' ? 'EXISTS' : 'NOT A MINT',
          owner_program: v.owner,
          account_type: v.data?.parsed?.type ?? null,
          slot: result?.context?.slot ?? null,
          rpc: used,
          fetched_at: accFetchedAt,
        };
      }
    } catch (e) {
      row.checks.mint_exists = { status: 'UNKNOWN', error: errMsg(e), fetched_at: accFetchedAt };
    }

    tokens.push(row);
    await new Promise((r) => setTimeout(r, 150)); // be gentle with the public RPC
  }

  const snapshot = {
    fetched_at: psFetchedAt,
    completed_at: now(),
    sources: {
      prestocks: PRESTOCKS_API,
      jupiter: JUPITER_PRICE,
      solana_rpc: RPCS,
    },
    last_attempt: { at: psFetchedAt, ok: true },
    tokens,
  };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(snapshot, null, 2) + '\n');

  for (const r of tokens) {
    const p = r.premium == null ? 'UNKNOWN' : `${(r.premium * 100).toFixed(2)}%`;
    console.log(
      `${r.symbol}\tpremium ${p}\t${r.premium_flag ?? ''}\tjup ${r.checks.jupiter_price.status}\tsupply ${r.checks.supply.status}\tmint ${r.checks.mint_exists.status}`,
    );
  }
  console.log('fetched_at', psFetchedAt);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
