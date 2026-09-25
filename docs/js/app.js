import { runPegWatch } from './peg-watch.js';
import { THRESHOLDS } from './config.js';

const tbody = document.getElementById('rows');
const statusEl = document.getElementById('status');
const metaEl = document.getElementById('meta');
const refreshBtn = document.getElementById('refresh');

function flagClass(flags) {
  if (flags === 'OK') return 'ok';
  if (flags.includes('STALE') || flags.includes('WIDE')) return 'warn';
  if (flags.includes('AFTER-HOURS')) return 'muted';
  return '';
}

function render(result) {
  tbody.innerHTML = '';
  for (const r of result.rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${r.symbol}</strong><br><span class="sub">${r.underlying}</span></td>
      <td class="num">${r.onChainUsd != null ? '$' + r.onChainUsd.toFixed(2) : 'UNKNOWN'}</td>
      <td class="num">${r.onChainAge}</td>
      <td class="num">${r.refUsd != null ? '$' + r.refUsd.toFixed(2) : 'UNKNOWN'}</td>
      <td class="num">${r.refAge}</td>
      <td class="num ${r.premiumBps != null && Math.abs(r.premiumBps) > THRESHOLDS.premiumBps ? 'warn' : ''}">${r.premiumBpsLabel}</td>
      <td><span class="pill ${r.market === 'OPEN' ? 'open' : 'closed'}">${r.market}</span></td>
      <td><span class="flag ${flagClass(r.flags)}">${r.flags}</span></td>
    `;
    if (r.errors.length) {
      tr.title = r.errors.join('; ');
    }
    tbody.appendChild(tr);
  }

  metaEl.textContent = `Updated ${new Date(result.fetchedAt).toLocaleString()} · US market ${result.marketLabel} · slot ${result.slot ?? 'UNKNOWN'}`;
}

async function refresh() {
  statusEl.textContent = 'Fetching prices…';
  refreshBtn.disabled = true;
  try {
    const result = await runPegWatch();
    render(result);
    statusEl.textContent = '';
  } catch (err) {
    statusEl.textContent = `Error: ${err.message || err}`;
  } finally {
    refreshBtn.disabled = false;
  }
}

refreshBtn.addEventListener('click', refresh);
refresh();
