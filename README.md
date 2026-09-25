# Stocklana — Peg Watch + PreStocks

**Live:** https://alarm2024.github.io/Stocklana/ (tabs: **xStocks** and **PreStocks**)

## xStocks tab — Peg Watch

**Is a tokenized stock on Solana priced like the real stock?**

Peg Watch compares **on-chain xStock prices** (Jupiter Price API) against **Pyth equity reference prices** (`Equity.US.*/USD`) for five tokens: **TSLAx, AAPLx, NVDAx, GOOGLx, SPYx**.

Built for **[Stocklana](https://hackathons.solana.com)** — submitted under the **Pyth Network bounty** (best use of Pyth market data: underlying equity vs on-chain tokenized exposure).

> **AI-assisted:** analysis text, README, and demo script in this repo were written with AI assistance.

## What it measures

| Column | Source |
|--------|--------|
| On-chain $ | [Jupiter Price API v3](https://dev.jup.ag/docs/price) (`api.jup.ag/price/v3`, keyless) |
| On-chain age | Estimated from Jupiter `blockId` vs current Solana slot (~0.4s/slot) |
| Reference $ | [Pyth Network](https://docs.pyth.network/) `Equity.US.*/USD` push-oracle price-update accounts on Solana (public RPC). Both shard 0 and shard 1 PDAs are read and the freshest valid account (owned by the Pyth receiver program, matching feed id) is used — the shard 0 accounts stopped updating on 2026-09-11. |
| Ref age | `publishTime` from Pyth on-chain account |
| Premium / discount | `(on_chain − reference) / reference × 10 000` basis points |
| US market | Pyth Hermes `market_hours` metadata (no key) with local NYSE schedule fallback |
| xStocks quote | xStocks (Backed) public API `GET /public/assets/{symbol}/price-data` → `quote`; compared with Jupiter and with Pyth — **MATCH** within 1%, else **DIFF** with both values |
| Multiplier | `GET /public/assets/{symbol}/multiplier?network=Solana` → `currentMultiplier`, cross-checked against the mint's Token-2022 `scaledUiAmountConfig` (on-chain MATCH/DIFF). Shown with fair value per raw token = underlying × multiplier |
| HALTED | `GET /public/assets/{symbol}` → `isTradingHalted`; when true the row shows **HALTED** and premium flags are suppressed |
| Proof of reserves | `GET /public/proof-of-reserves/{symbol}` → `sharesHeld`, `circulatingSupply`, `holdings[]`, `timestamp` — shown **as published by Backed/xStocks** |
| Flags | See below |

### Flags

- **OK** — within thresholds
- **WIDE (N bps)** — \|premium/discount\| > **100 bps** (1%)
- **STALE** — reference older than **300 seconds** while US market is **open**
- **REF STALE (Nh old)** — reference older than **96 hours** at any time (the feed account is not being updated)
- **UNKNOWN** — a fetch failed; the reason is shown under the flag (never shown as 0 or blank)
- **AFTER-HOURS GAP** — wide peg during **closed** hours (expected; labeled, not alarmed)

### Multiplier math

xStocks on Solana are Token-2022 mints with a `ScaledUiAmount` multiplier (dividends are reinvested, so the multiplier grows).
Per [xStocks docs](https://docs.xstocks.fi/developers/multipliers), **scaled (UI) amount = raw amount × multiplier**, and one scaled
token represents one underlying share. Jupiter's `usdPrice` is per **scaled** token (verified: Jupiter's `usdPricePrescaled` =
`usdPrice × multiplier`), so the premium compares `usdPrice` with the share price directly. The equivalent raw-token view is shown
in the Multiplier column: Jupiter price per raw token = `usdPrice × multiplier` vs fair value per raw token = `underlying × multiplier`
— the ratio is identical. Multiplying the UI price by the multiplier *and* comparing it with the plain share price would double count.

### xStocks (Backed) API — public endpoints used

Base `https://api.backed.fi/api/v2/public` (same data at `https://api.xstocks.fi/api/v2/public`). No key, nothing under `/client` or `/trades`.
The API sends no CORS headers, so `scripts/fetch-xstocks.mjs` runs in the scheduled GitHub Action (same workflow as PreStocks) and writes
[`docs/data/xstocks.json`](docs/data/xstocks.json) with `fetched_at`; the CLI calls the API live.

## Mint verification

All five mints were verified against the official xStocks / Backed public API (`GET https://api.backed.fi/api/v2/public/assets/{symbol}` → Solana deployment address):

| Token | Mint | Verified via |
|-------|------|--------------|
| TSLAx | `XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB` | [backed.fi TSLAx](https://api.backed.fi/api/v2/public/assets/TSLAx) |
| AAPLx | `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp` | [backed.fi AAPLx](https://api.backed.fi/api/v2/public/assets/AAPLx) |
| NVDAx | `Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh` | [backed.fi NVDAx](https://api.backed.fi/api/v2/public/assets/NVDAx) |
| GOOGLx | `XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN` | [backed.fi GOOGLx](https://api.backed.fi/api/v2/public/assets/GOOGLx) |
| SPYx | `XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W` | [backed.fi SPYx](https://api.backed.fi/api/v2/public/assets/SPYx) |

## Quick start

### Web (GitHub Pages)

1. Open https://alarm2024.github.io/Stocklana/ (GitHub Pages from `main` `/docs`), or serve locally: `python3 -m http.server -d docs`.
2. Click **Refresh** (xStocks) or switch to the **PreStocks** tab.

### CLI

```bash
node cli.js
# or
npm run peg-watch
```

Requires **Node.js 18+**. No dependencies, no install step beyond cloning the repo.

## PreStocks tab

Pre-IPO tokens issued by **[PreStocks](https://prestocks.com)** on Solana — **PreStocks tokens only** (no other pre-IPO issuers).

| Column | Source |
|--------|--------|
| Token price, mark price, implied / mark valuation, supply | PreStocks public API `GET https://prestocks.com/api/prestocks` (fields `symbol`, `contract_address`, `tokenPrice`, `markPrice`, `impliedValuation`, `markValuation`, `supply`). Mark price is shown **as published by the PreStocks API**. |
| Premium / discount | `tokenPrice / markPrice − 1`; **≥ +10% → RICH vs mark**, **≤ −10% → CHEAP vs mark** |
| Implied vs mark valuation | `impliedValuation` vs `markValuation`, in $B |
| Jupiter price check | PreStocks `tokenPrice` vs [Jupiter Price API v3](https://dev.jup.ag/docs/price) `usdPrice` for the same mint — **MATCH** within 1%, else **DIFF** with both values |
| Supply check | PreStocks `supply` vs Solana RPC `getTokenSupply` (UI amount) — MATCH / DIFF |
| Mint | Solana RPC `getAccountInfo` — account exists and is a token mint |

Every number shows its fetch time; any failure shows **UNKNOWN** plus the reason.

**Why a snapshot file:** `prestocks.com/api/prestocks` sends no CORS headers, so browsers cannot call it directly.
The GitHub Action [`.github/workflows/prestocks-snapshot.yml`](.github/workflows/prestocks-snapshot.yml) runs every ~30 minutes (and on
`workflow_dispatch`), executes `node scripts/fetch-prestocks.mjs` (PreStocks API + all on-chain checks), and commits
[`docs/data/prestocks.json`](docs/data/prestocks.json) with `fetched_at`. The page reads that one file and shows the data age.
If a refresh fails, the previous snapshot is kept and the failed attempt (time + error) is shown on the page.

```bash
node scripts/fetch-prestocks.mjs   # refresh docs/data/prestocks.json locally
```

### PreStocks limits

- **Not investment advice.** Informational, read-only; no wallet connect, no trading.
- **Mark is not fair value.** The mark price is simply the value published by the PreStocks API.
- **A premium is not an arbitrage.** Tokens may not be redeemable at mark; minting/redemption has its own eligibility and process.
- **Structure and methodology are PreStocks'.** This project does not describe or verify how the mark price is determined.
- **Snapshot, not real time.** Data can be up to ~30 minutes old (plus GitHub Actions schedule delays); the page shows the age.

## Limits (what Peg Watch does **not** measure)

- **Not a trade signal** — read-only monitor; no wallet connect, no swaps, no execution.
- **Not proof of redemption** — does not check xStock issuer reserves, NAV, or mint/redeem queues.
- **Not full market microstructure** — Jupiter returns one heuristic USD price, not order-book mid or TWAP across all venues.
- **Corporate actions: multiplier only** — the current issuer multiplier is shown and cross-checked on-chain; pending multiplier changes and corporate-action calendars are not modeled. If the multiplier endpoint fails the column shows UNKNOWN.
- **xStocks quote is the issuer's indicative price** (`price-data`), not an executable price; issuer data is a ~30-minute snapshot (age shown).
- **Proof of reserves is shown as published by Backed/xStocks** — not audited or independently verified here; no collateral ratio is derived.
- **Not all xStocks** — only five liquid names with verified mints and Pyth equity feeds.
- **Not Hermes price-update API** — Pyth’s Hermes `/v2/updates/price/latest` now requires an API key (2026 upgrade). Peg Watch reads the same Pyth prices from **on-chain push-oracle accounts** via public Solana RPC instead (keyless). Hermes is still used for **market-hours metadata** (no key).
- **Not holiday-perfect** — US market schedule uses Pyth metadata when available; local fallback is Mon–Fri 09:30–16:00 ET only (no holiday calendar).
- **Not latency-critical** — browser RPC + Jupiter fetches are fine for a dashboard, not for HFT or liquidation bots.
- **Not legal/financial advice** — informational only.

## Project layout

```
docs/           Static web app (GitHub Pages, served from main /docs)
  index.html
  js/           Shared fetch + peg logic (also used by CLI); prestocks.js renders the PreStocks tab
  data/         prestocks.json snapshot (written by the GitHub Action)
scripts/fetch-prestocks.mjs   PreStocks API + on-chain checks -> docs/data/prestocks.json
.github/workflows/prestocks-snapshot.yml   ~30-minute schedule + workflow_dispatch
cli.js          Terminal table
DEMO_SCRIPT.md  2-minute hackathon video script
```

## Hackathon track

**Pyth Network bounty** — compares Pyth `Equity.US.*/USD` reference feeds to on-chain xStock prices from Jupiter (with the issuer's own quote as a third reference), exactly the “underlying market vs on-chain asset” wedge described in the bounty brief. Also relevant to Stocklana **Infrastructure** (price feeds / analytics).

## License

MIT — see [LICENSE](LICENSE).
