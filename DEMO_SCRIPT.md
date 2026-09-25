# Peg Watch — 2-minute demo script

**Track:** Pyth Network bounty (Stocklana hackathon)

---

## [0:00–0:15] Hook

> "Tokenized stocks on Solana trade 24/7, but the underlying US equities don't. So the first question is simple: **is TSLAx actually priced like TSLA?**
>
> Peg Watch answers that in one table — no wallet, no keys, read-only."

*[Show `docs/index.html` or GitHub Pages URL. Click Refresh if needed.]*

---

## [0:15–0:45] What it measures

> "For five xStocks — TSLAx, AAPLx, NVDAx, GOOGLx, SPYx — we pull two public prices:
>
> - **On-chain:** Jupiter Price API, keyed by the official Solana mint from the xStocks Backed API.
> - **Reference:** Pyth `Equity.US.*/USD` feeds, read from Pyth push-oracle accounts on Solana via public RPC.
>
> The **premium or discount** is the gap in basis points. We show **how old each price is**, and whether the **US cash market is open**."

*[Point at columns: on-chain $, ref $, bps, market status, flags.]*

---

## [0:45–1:15] Smart flags (after hours)

> "After the NYSE close, the Pyth equity reference stops updating — that's expected. We label it **AFTER-HOURS GAP**, not a red alert.
>
> During market hours, if the reference is older than five minutes, we flag **STALE**. If on-chain diverges more than 100 bps, we flag **WIDE**.
>
> No invented numbers — if a feed fails, you see **UNKNOWN**."

*[If market is closed, highlight an AFTER-HOURS GAP row. If open, show OK vs WIDE.]*

---

## [1:15–1:40] CLI + repo

> "Same data in the terminal — one command:"

```bash
node cli.js
```

> "Static site, client-side fetch only. MIT license. Mint addresses verified against `api.backed.fi`. README has a Limits section for what we explicitly do **not** claim."

*[Run CLI briefly; show matching table.]*

---

## [1:40–2:00] Close

> "Peg Watch is infrastructure for the tokenized-stock stack: a quick sanity check before you trade, build a vault, or wire a lending market. Built for Stocklana's Pyth bounty — comparing real equity reference data to on-chain xStock prices on Solana."

*[End on the web table with all five tokens visible.]*
