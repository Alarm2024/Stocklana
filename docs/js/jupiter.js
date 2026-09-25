import { ENDPOINTS, THRESHOLDS } from './config.js';

export async function fetchJupiterPrices(mints) {
  const ids = mints.join(',');
  try {
    const res = await fetch(`${ENDPOINTS.jupiterPrice}?ids=${ids}`);
    if (!res.ok) {
      return { ok: false, error: `Jupiter HTTP ${res.status}`, prices: {} };
    }
    const data = await res.json();
    return { ok: true, prices: data || {} };
  } catch (err) {
    return { ok: false, error: `Jupiter fetch failed: ${err.message || err}`, prices: {} };
  }
}

/**
 * Estimate Jupiter price age from blockId vs current slot.
 * Jupiter v3 does not expose a publish timestamp directly.
 */
export function jupiterPriceAgeSeconds(jupiterEntry, currentSlot) {
  if (!jupiterEntry || jupiterEntry.blockId == null || currentSlot == null) {
    return null;
  }
  const slotsBehind = Math.max(0, currentSlot - jupiterEntry.blockId);
  return Math.round(slotsBehind * THRESHOLDS.slotSeconds);
}

export function extractJupiterUsd(jupiterEntry) {
  if (!jupiterEntry || typeof jupiterEntry.usdPrice !== 'number') {
    return null;
  }
  return jupiterEntry.usdPrice;
}
