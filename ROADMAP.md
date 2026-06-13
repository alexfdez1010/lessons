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
- [x] **volatility-trading** ⬤⬤⬤⬤ — ✅ 2026-06-12 — vol as an asset class: realized vs
  implied recap, variance swaps & vol swaps, the VIX and its term structure,
  volatility risk premium, straddles/strangles as vol bets, dispersion
  trading, tail hedging in practice. _(deps: `greeks-and-hedging`,
  `time-series-finance`; vix-term-structure + vol-premium islands)_
- [x] **credit-derivatives-and-securitization** ⬤⬤⬤⬤ — trading default risk:
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
- [ ] **exotic-options-and-structured-products** ⬤⬤⬤⬤ — beyond vanillas:
  digital/binary options, barrier options (knock-in/out) and their hedging
  headaches, lookbacks & Asians, autocallables and cliquets, how a structured
  note is decomposed into a bond + option strip, payoff engineering and the
  hidden costs investors pay. _(deps: `options-pricing`, `greeks-and-hedging`,
  `volatility-trading`; barrier-payoff + autocall-ladder islands)_
- [ ] **counterparty-risk-and-xva** ⬤⬤⬤⬤ — the cost of who you trade with:
  counterparty credit exposure (EE/PFE), netting sets and collateral, the XVA
  family (CVA/DVA/FVA/MVA/KVA), wrong-way risk, central clearing vs bilateral,
  initial vs variation margin and the post-2008 plumbing. _(deps:
  `swaps-and-rate-derivatives`, `credit-derivatives-and-securitization`;
  exposure-profile + xva-waterfall islands)_
- [ ] **systematic-and-statistical-arbitrage** ⬤⬤⬤⬤ — mining relative value:
  pairs trading & cointegration, mean-reversion vs momentum signals, building
  a market-/factor-neutral book, signal combination & decay, capacity and
  crowding, the 2007 quant quake. _(deps: `time-series-finance`,
  `factor-models`, `algorithmic-trading-and-execution`; spread-zscore +
  signal-decay islands)_
- [ ] **defi-options-and-onchain-volatility** ⬤⬤⬤⬤ — volatility goes on-chain:
  on-chain options protocols, DeFi option vaults (covered-call / put-selling
  strategies) and their structural short-vol risk, on-chain implied vol &
  oracles, perp funding as a vol/skew signal, settlement and liquidity
  frictions vs TradFi desks. _(deps: `volatility-trading`,
  `defi-derivatives-perps`; dov-payoff + onchain-vol islands)_
- [ ] **history-of-finance** ⬤⬤ — where financial products came from (the
  story `history-of-money` doesn't tell): ancient lending & interest and the
  Code of Hammurabi, Italian merchant banks + double-entry bookkeeping +
  bills of exchange, the first government bonds (Venetian *prestiti*), the
  Amsterdam joint-stock company & the world's first stock exchange (VOC,
  1602), tulip mania as the first derivatives bubble, Dojima rice & the first
  futures market, Lloyd's & the birth of insurance, central banks (Bank of
  England 1694), mutual funds → index funds → ETFs, and the rise of modern
  derivatives & securitization. Focus on *why each product was invented* and
  *what problem it solved*. _(deps: `history-of-money`,
  `stock-markets-and-funds`; product-timeline + joint-stock-share islands)_
