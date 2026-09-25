import { STOCKS, THRESHOLDS } from './config.js';
import { fetchJupiterPrices, jupiterPriceAgeSeconds, extractJupiterUsd } from './jupiter.js';
import { fetchPythOnChain, fetchPythMarketHours, fetchCurrentSlot } from './pyth.js';
import { isUsMarketOpenLocal, marketStatusLabel, formatAgeSeconds } from './market.js';

function bpsDiff(onChain, reference) {
  if (onChain == null || reference == null || reference === 0) return null;
  return Math.round(((onChain - reference) / reference) * 10000);
}

function formatBps(bps) {
  if (bps == null || !Number.isFinite(bps)) return 'UNKNOWN';
  const sign = bps > 0 ? '+' : '';
  return `${sign}${bps}`;
}

function formatUsd(v) {
  if (v == null || !Number.isFinite(v)) return 'UNKNOWN';
  return v.toFixed(2);
}

function computeFlags(row, marketOpen) {
  const flags = [];
  const absBps = row.premiumBps == null ? null : Math.abs(row.premiumBps);

  if (absBps != null && absBps > THRESHOLDS.premiumBps) {
    flags.push(`WIDE (${absBps} bps)`);
  }

  if (row.refAgeSec != null && marketOpen && row.refAgeSec > THRESHOLDS.staleSeconds) {
    flags.push('STALE');
  }

  if (!marketOpen && absBps != null && absBps > THRESHOLDS.premiumBps) {
    flags.push('AFTER-HOURS GAP');
  }

  return flags.length ? flags.join(', ') : 'OK';
}

/**
 * @returns {Promise<{ rows: object[], fetchedAt: string, marketOpen: boolean, marketLabel: string, slot: number|null }>}
 */
export async function runPegWatch({ stocks = STOCKS } = {}) {
  const fetchedAt = new Date();
  const mints = stocks.map((s) => s.mint);

  const [jupiter, slotInfo, marketHoursMap] = await Promise.all([
    fetchJupiterPrices(mints),
    fetchCurrentSlot(),
    fetchPythMarketHours(stocks),
  ]);

  const pythResults = await Promise.all(stocks.map((s) => fetchPythOnChain(s)));

  const localOpen = isUsMarketOpenLocal(fetchedAt);
  const anyPythOpen = [...marketHoursMap.values()].some((h) => h.is_open);
  const marketOpen = marketHoursMap.size > 0 ? anyPythOpen : localOpen;
  const marketLabel = marketStatusLabel(marketOpen, [...marketHoursMap.values()][0]);

  const nowSec = Math.floor(fetchedAt.getTime() / 1000);

  const rows = stocks.map((stock, i) => {
    const jEntry = jupiter.ok ? jupiter.prices[stock.mint] : null;
    const onChainUsd = extractJupiterUsd(jEntry);
    const onChainAgeSec = jupiterPriceAgeSeconds(jEntry, slotInfo.slot);

    const pyth = pythResults[i];
    const refUsd = pyth.ok ? pyth.priceUsd : null;
    const refAgeSec = pyth.ok ? Math.max(0, nowSec - pyth.publishTime) : null;

    const premiumBps = bpsDiff(onChainUsd, refUsd);
    const stockMarketHours = marketHoursMap.get(stock.symbol);
    const stockMarketOpen =
      stockMarketHours?.is_open != null ? stockMarketHours.is_open : localOpen;

    const row = {
      symbol: stock.symbol,
      underlying: stock.underlying,
      mint: stock.mint,
      onChainUsd,
      onChainAgeSec,
      onChainAge: formatAgeSeconds(onChainAgeSec),
      refUsd,
      refAgeSec,
      refAge: formatAgeSeconds(refAgeSec),
      premiumBps,
      premiumBpsLabel: formatBps(premiumBps),
      market: marketStatusLabel(stockMarketOpen, stockMarketHours),
      flags: '',
      errors: [],
    };

    if (!jupiter.ok) row.errors.push(`Jupiter: ${jupiter.error}`);
    if (jEntry == null && jupiter.ok) row.errors.push('Jupiter: no price for mint');
    if (!pyth.ok) row.errors.push(`Pyth: ${pyth.error}`);

    row.flags = computeFlags(row, stockMarketOpen);
    return row;
  });

  return {
    rows,
    fetchedAt: fetchedAt.toISOString(),
    marketOpen,
    marketLabel,
    slot: slotInfo.slot,
  };
}

export function formatTable(result) {
  const header = [
    'Symbol',
    'On-chain $',
    'On-chain age',
    'Ref $ (Pyth)',
    'Ref age',
    'Premium bps',
    'US market',
    'Flags',
  ];

  const lines = [header.join('\t')];
  for (const r of result.rows) {
    lines.push(
      [
        r.symbol,
        formatUsd(r.onChainUsd),
        r.onChainAge,
        formatUsd(r.refUsd),
        r.refAge,
        r.premiumBpsLabel,
        r.market,
        r.flags,
      ].join('\t'),
    );
  }
  lines.push('');
  lines.push(`Fetched: ${result.fetchedAt}`);
  lines.push(`US market (aggregate): ${result.marketLabel}`);
  return lines.join('\n');
}
