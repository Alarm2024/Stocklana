import { ENDPOINTS } from './config.js';

const PYTH_PUSH_ORACLE = 'pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT';

function toUint8(data) {
  if (data instanceof Uint8Array) return data;
  return new Uint8Array(data);
}

function readInt64LE(buf, offset) {
  const view = new DataView(buf.buffer, buf.byteOffset + offset, 8);
  return Number(view.getBigInt64(0, true));
}

function readUInt64LE(buf, offset) {
  const view = new DataView(buf.buffer, buf.byteOffset + offset, 8);
  return Number(view.getBigUint64(0, true));
}

function readInt32LE(buf, offset) {
  const view = new DataView(buf.buffer, buf.byteOffset + offset, 4);
  return view.getInt32(0, true);
}

function indexOfSubarray(haystack, needle) {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function hexToBytes(hex) {
  const clean = hex.replace(/^0x/, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * Parse a Pyth push-oracle PriceUpdateV2 account (~134 bytes).
 */
export function parsePythPushAccount(data, expectedFeedIdHex) {
  const buf = toUint8(data);
  if (buf.length < 126) {
    return { ok: false, error: 'account too short' };
  }

  const feedBytes = hexToBytes(expectedFeedIdHex);
  const feedOffset = indexOfSubarray(buf, feedBytes);
  if (feedOffset < 0) {
    return { ok: false, error: 'feed id not found in account' };
  }

  const price = readInt64LE(buf, feedOffset + 32);
  const conf = readUInt64LE(buf, feedOffset + 40);
  const expo = readInt32LE(buf, feedOffset + 48);
  const publishTime = readInt64LE(buf, feedOffset + 52);

  if (!Number.isFinite(price) || publishTime <= 0) {
    return { ok: false, error: 'invalid price fields' };
  }

  const usd = price * 10 ** expo;
  return {
    ok: true,
    priceUsd: usd,
    confUsd: conf * 10 ** expo,
    expo,
    publishTime,
    source: 'pyth-on-chain',
  };
}

async function rpcCall(rpcUrl, method, params) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'RPC error');
  return json.result;
}

export async function fetchCurrentSlot(rpcUrls = ENDPOINTS.solanaRpc) {
  for (const url of rpcUrls) {
    try {
      const slot = await rpcCall(url, 'getSlot', [{ commitment: 'confirmed' }]);
      return { slot, rpc: url };
    } catch {
      /* try next */
    }
  }
  return { slot: null, rpc: null };
}

export async function fetchPythOnChain(stock, rpcUrls = ENDPOINTS.solanaRpc) {
  for (const url of rpcUrls) {
    try {
      const result = await rpcCall(url, 'getAccountInfo', [
        stock.pythOnChainAccount,
        { encoding: 'base64', commitment: 'confirmed' },
      ]);
      const value = result?.value;
      if (!value?.data?.[0]) {
        return { ok: false, error: 'account not found', rpc: url };
      }
      const data = base64ToBytes(value.data[0]);
      const parsed = parsePythPushAccount(data, stock.pythFeedId);
      return { ...parsed, rpc: url };
    } catch (err) {
      if (url === rpcUrls[rpcUrls.length - 1]) {
        return { ok: false, error: String(err.message || err) };
      }
    }
  }
  return { ok: false, error: 'all RPC endpoints failed' };
}

/** Hermes metadata endpoint (no API key) exposes market-hours per feed. */
export async function fetchPythMarketHours(stocks) {
  const map = new Map();
  await Promise.all(
    stocks.map(async (stock) => {
      try {
        const q = encodeURIComponent(stock.pythSymbol);
        const res = await fetch(`${ENDPOINTS.pythHermesMeta}?query=${q}`);
        if (!res.ok) return;
        const feeds = await res.json();
        const match = feeds.find((f) => f.attributes?.symbol === stock.pythSymbol);
        if (match?.market_hours) {
          map.set(stock.symbol, match.market_hours);
        }
      } catch {
        /* fall back to local schedule */
      }
    }),
  );
  return map;
}

export { PYTH_PUSH_ORACLE };
