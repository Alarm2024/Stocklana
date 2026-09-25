# Peg Watch

**Is a tokenized stock on Solana priced like the real stock?**

Peg Watch compares **on-chain xStock prices** (Jupiter Price API) against **Pyth equity reference prices** (`Equity.US.*/USD`) for five tokens: **TSLAx, AAPLx, NVDAx, GOOGLx, SPYx**.

Built for **[Stocklana](https://hackathons.solana.com)** — submitted under the **Pyth Network bounty** (best use of Pyth market data: underlying equity vs on-chain tokenized exposure).

> AI-assisted: analysis text, README, and demo script in this repo were written with AI assistance.

## What it measures

| Column | Source |
|--------|--------|
| On-chain $ | [Jupiter Price API v3](https://dev.jup.ag/docs/price) (`api.jup.ag/price/v3`, keyless) |
| On-chain age | Estimated from Jupiter `blockId` vs current Solana slot (~0.4s/slot) |
| Reference $ | [Pyth Network](https://docs.pyth.network/) `Equity.US.*/USD` push-oracle accounts on Solana (public RPC) |
| Ref age | `publishTime` from Pyth on-chain account |
| Premium / discount | `(on_chain − reference) / reference × 10 000` basis points |
| US market | Pyth Hermes `market_hours` metadata (no key) with local NYSE schedule fallback |
| Flags | See below |

### Flags

- **OK** — within thresholds
- **WIDE (N bps)** — \|premium/discount\| > **100 bps** (1%)
- **STALE** — reference older than **300 seconds** while US market is **open**
- **AFTER-HOURS GAP** — wide peg during **closed** hours (expected; labeled, not alarmed)

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

1. Enable GitHub Pages: **Settings → Pages → Deploy from branch → `/docs` folder**.
2. Open the published URL (or open `docs/index.html` locally with a static server).
3. Click **Refresh**.

### CLI

```bash
node cli.js
# or
npm run peg-watch
```

Requires **Node.js 18+**. No install step beyond cloning the repo.

## Limits (what Peg Watch does **not** measure)

- **Not a trade signal** — read-only monitor; no wallet connect, no swaps, no execution.
- **Not proof of redemption** — does not check xStock issuer reserves, NAV, or mint/redeem queues.
- **Not full market microstructure** — Jupiter returns one heuristic USD price, not order-book mid or TWAP across all venues.
- **Not corporate actions** — splits, dividends, and issuer adjustment multipliers are not modeled (Jupiter exposes some `scaledUiConfig` metadata but Peg Watch does not apply it).
- **Not all xStocks** — only five liquid names with verified mints and Pyth equity feeds.
- **Not Hermes price-update API** — Pyth’s Hermes `/v2/updates/price/latest` now requires an API key (2026 upgrade). Peg Watch reads the same Pyth prices from **on-chain push-oracle accounts** via public Solana RPC instead (keyless). Hermes is still used for **market-hours metadata** (no key).
- **Not holiday-perfect** — US market schedule uses Pyth metadata when available; local fallback is Mon–Fri 09:30–16:00 ET only (no holiday calendar).
- **Not latency-critical** — browser RPC + Jupiter fetches are fine for a dashboard, not for HFT or liquidation bots.
- **Not legal/financial advice** — informational only.

## Project layout

```
docs/           Static web app (GitHub Pages)
  index.html
  js/           Shared fetch + peg logic (also used by CLI)
cli.js          Terminal table
DEMO_SCRIPT.md  2-minute hackathon video script
```

## Hackathon track

**Pyth Network bounty** — compares Pyth `Equity.US.*/USD` reference feeds to on-chain xStock prices from Jupiter, exactly the “underlying market vs on-chain asset” wedge described in the bounty brief. Also relevant to Stocklana **Infrastructure** (price feeds / analytics).

## License

MIT — see [LICENSE](LICENSE).
