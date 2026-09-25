import { runPegWatch } from './peg-watch.js';
import { THRESHOLDS } from './config.js';

const tbody = document.getElementById('rows');
const statusEl = document.getElementById('status');
const metaEl = document.getElementById('meta');
const refreshBtn = document.getElementById('refresh');
const issuerMetaEl = document.getElementById('issuer-meta');
const porBody = document.getElementById('por-rows');

const utc = (iso) => (iso ? new Date(iso).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'UNKNOWN');
const unk = (reason) => `<span class="unknown">UNKNOWN</span>${reason ? `<br><span class="sub err">${escapeHtml(reason)}</span>` : ''}`;
const fetched = (iso) => `<br><span class="sub">fetched ${escapeHtml(utc(iso))}</span>`;

function cmpCell(c, a, aLabel, b, bLabel, at) {
  if (!c || c.status === 'UNKNOWN') return unk(a == null ? `${aLabel} missing` : `${bLabel} missing`);
  const pct = `${c.diff >= 0 ? '+' : ''}${(c.diff * 100).toFixed(2)}%`;
  const cls = c.status === 'MATCH' ? 'match' : 'diff';
  return `<span class="${cls}">${c.status}</span> ${pct}<br><span class="sub">${aLabel} $${a.toFixed(2)} · ${bLabel} $${b.toFixed(2)}</span>${fetched(at)}`;
}

function multCell(r) {
  if (r.multiplier == null) return unk(r.issuerErrors.find((e) => e.includes('multiplier')) || 'multiplier unavailable');
  const chk = r.multiplierCheck;
  const chkTxt = chk
    ? chk.status === 'UNKNOWN'
      ? `<br>${unk(`on-chain check: ${chk.error || 'unknown'}`)}`
      : `<br><span class="${chk.status === 'MATCH' ? 'match' : 'diff'}">on-chain ${chk.status}</span>${chk.status === 'DIFF' ? ` <span class="sub">(on-chain ${chk.onchain})</span>` : ''}`
    : '';
  const fair = r.fairRawUsd != null ? `<br><span class="sub">fair value / raw token = $${r.refUsd.toFixed(2)} × ${r.multiplier.toFixed(6)} = $${r.fairRawUsd.toFixed(2)}${r.jupiterRawUsd != null ? ` · Jupiter / raw token $${r.jupiterRawUsd.toFixed(2)}` : ''}</span>` : '';
  return `×${r.multiplier.toFixed(6)}${r.multiplierReason ? ` <span class="sub">(${escapeHtml(r.multiplierReason)})</span>` : ''}${chkTxt}${fair}${fetched(r.multiplierFetchedAt)}`;
}

function renderPor(result) {
  porBody.innerHTML = '';
  for (const r of result.rows) {
    const p = r.proofOfReserves;
    const tr = document.createElement('tr');
    if (!p || !p.ok) {
      tr.innerHTML = `<td><strong>${r.symbol}</strong></td><td colspan="5">${unk(p?.error || 'not in snapshot')}</td>`;
    } else {
      const fmt = (v) => (v == null || !Number.isFinite(Number(v)) ? 'UNKNOWN' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 4 }));
      const custody = (p.holdings || []).map((h) => `${escapeHtml(h.provider)}: ${fmt(h.quantity)} ${escapeHtml(h.symbol)}`).join('<br>') || 'UNKNOWN';
      tr.innerHTML = `<td><strong>${r.symbol}</strong></td><td class="num">${fmt(p.sharesHeld)}</td><td class="num">${fmt(p.circulatingSupply)}</td><td>${custody}</td><td>${escapeHtml(utc(p.timestamp))}</td><td>${escapeHtml(utc(p.fetched_at))}</td>`;
    }
    porBody.appendChild(tr);
  }
}

async function loadIssuerSnapshot() {
  try {
    const res = await fetch(`data/xstocks.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`data/xstocks.json HTTP ${res.status}`);
    return { issuer: await res.json(), issuerError: null };
  } catch (e) {
    return { issuer: null, issuerError: String(e.message || e) };
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function flagClass(flags) {
  if (flags === 'OK') return 'ok';
  if (flags.includes('HALTED')) return 'warn';
  if (flags.includes('STALE') || flags.includes('WIDE') || flags.includes('UNKNOWN')) return 'warn';
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
      <td class="num">${r.quote != null ? '$' + r.quote.toFixed(2) + fetched(r.quoteFetchedAt) : unk(r.issuerErrors.find((e) => e.includes('quote')) || r.issuerErrors[0])}</td>
      <td class="num">${cmpCell(r.quoteVsJupiter, r.quote, 'xStocks', r.onChainUsd, 'Jupiter', r.quoteFetchedAt)}</td>
      <td class="num">${cmpCell(r.quoteVsPyth, r.quote, 'xStocks', r.refUsd, 'Pyth', r.quoteFetchedAt)}</td>
      <td class="num">${multCell(r)}</td>
      <td><span class="pill ${r.market === 'OPEN' ? 'open' : 'closed'}">${r.market}</span></td>
      <td><span class="flag ${flagClass(r.flags)}">${r.flags}</span>${r.halted === true ? `<br><span class="sub">issuer isTradingHalted=true${fetched(r.haltedFetchedAt)}</span>` : r.halted === false ? '<br><span class="sub">not halted</span>' : `<br><span class="sub err">halt status UNKNOWN</span>`}${r.errors.length ? `<br><span class="sub err">${escapeHtml(r.errors.join('; '))}</span>` : ''}</td>
    `;
    if (r.errors.length) {
      tr.title = r.errors.join('; ');
    }
    tbody.appendChild(tr);
  }

  renderPor(result);
  issuerMetaEl.innerHTML = result.issuerFetchedAt
    ? `xStocks issuer data (quote, multiplier, halt, PoR) snapshot fetched ${escapeHtml(utc(result.issuerFetchedAt))} — <strong>data age ${Math.max(0, Math.round((Date.now() - new Date(result.issuerFetchedAt)) / 60000))} min</strong>`
    : unk('xStocks issuer snapshot not loaded');
  metaEl.textContent = `Jupiter + Pyth prices fetched live ${new Date(result.fetchedAt).toLocaleString()} (${result.fetchedAt}) · US market ${result.marketLabel} · slot ${result.slot ?? 'UNKNOWN'}`;
}

async function refresh() {
  statusEl.textContent = 'Fetching prices…';
  refreshBtn.disabled = true;
  try {
    const { issuer, issuerError } = await loadIssuerSnapshot();
    const result = await runPegWatch({ issuer, issuerError });
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
