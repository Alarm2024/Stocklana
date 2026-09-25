/**
 * US equity regular session: Mon–Fri 09:30–16:00 America/New_York.
 * Does not model every holiday — Pyth Hermes market_hours preferred when available.
 */

const NY = 'America/New_York';

function nyParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: NY,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    weekday: get('weekday'),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  };
}

export function isUsMarketOpenLocal(now = new Date()) {
  const { weekday, hour, minute } = nyParts(now);
  if (['Sat', 'Sun'].includes(weekday)) return false;
  const mins = hour * 60 + minute;
  const open = 9 * 60 + 30;
  const close = 16 * 60;
  return mins >= open && mins < close;
}

export function marketStatusLabel(isOpen, pythHours) {
  if (pythHours?.is_open != null) {
    return pythHours.is_open ? 'OPEN' : 'CLOSED';
  }
  return isUsMarketOpenLocal() ? 'OPEN' : 'CLOSED';
}

export function formatAgeSeconds(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return 'UNKNOWN';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
