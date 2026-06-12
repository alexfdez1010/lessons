# Lessons Roadmap — quant finance · crypto · DeFi

Ordered, difficulty-ramped curriculum. The **daily autonomous agent**
(`scripts/daily-lesson.sh`, runs 06:00 / 18:00 Europe/Madrid) builds the **next unchecked
item top-to-bottom**, then ticks it `[x]` and, when the queue runs low, appends
the next harder topics to keep the ramp going.

**Rules for the agent**
- Build strictly within: quantitative finance, crypto, DeFi.
- Go in order. Never skip ahead to a harder topic while easier ones are unbuilt,
  and never build something easier than the last completed item.
- One lesson (or one topic's lesson) per run, en + es twin, per CLAUDE.md.
- After building: mark it `[x]`, note the date.
- Once an item is built and ticked, **delete it from this file** — the catalog
  (`src/content/topics/`) is the record of what exists; this file only lists
  what's left to build.
- When fewer than **3** unchecked items remain, append the next harder topics
  (each one notch up) so the pipeline never empties. Also, follow an horizontal approach
- Difficulty legend: ⬤ beginner · ⬤⬤ intermediate · ⬤⬤⬤ advanced · ⬤⬤⬤⬤ expert.

_Stages −1 through 6 (39 topics, `money-and-value` → the Stage-6 ladder
bridges) are all built and live in the catalog — see `src/content/topics/en/`._

---

## Stage 7 — Markets breadth & practitioner desks (⬤⬤⬤ → ⬤⬤⬤⬤)
_Horizontal expansion into asset classes and desk skills the catalog doesn't
cover yet, then back to expert quant depth._

- [x] **fx-and-currency-markets** ⬤⬤⬤ — ✅ 2026-06-11 — the largest market on earth:
  currency pairs & quoting conventions, spot vs forward FX, covered & uncovered
  interest parity, carry trades, central banks & intervention, pegs and currency
  crises, FX in a portfolio (hedged vs unhedged). _(deps: `economics-for-finance`,
  `futures-and-forwards`; interest-parity + carry-trade-unwind islands)_
- [x] **commodities-and-real-assets** ⬤⬤⬤ — ✅ 2026-06-11 — markets with storage costs:
  commodity futures in practice, storage & convenience yield, seasonality,
  roll yield & commodity indices, gold as a monetary asset, oil market
  structure, real assets vs inflation. _(deps: `futures-and-forwards`;
  roll-yield + seasonality islands)_
- [x] **swaps-and-rate-derivatives** ⬤⬤⬤⬤ — ✅ 2026-06-12 — the biggest derivatives market:
  interest-rate swaps from first principles, swap pricing as bond differences,
  swap spreads, SOFR & the death of LIBOR, caps/floors/swaptions at a glance,
  FRAs, asset swaps, using swaps to hedge a rate book. _(deps:
  `fixed-income-analytics`, `futures-and-forwards`; swap-cashflow +
  swap-curve islands)_
- [ ] **volatility-trading** ⬤⬤⬤⬤ — vol as an asset class: realized vs
  implied recap, variance swaps & vol swaps, the VIX and its term structure,
  volatility risk premium, straddles/strangles as vol bets, dispersion
  trading, tail hedging in practice. _(deps: `greeks-and-hedging`,
  `time-series-finance`; vix-term-structure + vol-premium islands)_
- [ ] **credit-derivatives-and-securitization** ⬤⬤⬤⬤ — trading default risk:
  CDS mechanics & spreads, hazard-rate pricing intuition, CDS indices,
  securitization (MBS/ABS), tranching & waterfalls, correlation and why 2008
  happened, CLOs today. _(deps: `fixed-income-analytics`; tranche-waterfall +
  cds-cashflow islands)_
- [ ] **algorithmic-trading-and-execution** ⬤⬤⬤⬤ — how orders get worked:
  execution algos (TWAP/VWAP/POV/IS), implementation shortfall, market-impact
  models (square-root law), backtesting pitfalls (overfitting, survivorship,
  look-ahead), alpha decay, transaction-cost analysis, HFT strategies at a
  glance. _(deps: `market-microstructure`, `time-series-finance`;
  impact-curve + execution-schedule islands)_
