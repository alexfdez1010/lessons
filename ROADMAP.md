# Lessons Roadmap — quant finance · crypto · DeFi

Ordered, difficulty-ramped curriculum. The **daily autonomous agent**
(`scripts/daily-lesson.sh`, runs 00:00 / 06:00 / 20:00 Europe/Madrid) builds the **next unchecked
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

_Stages −1 through 5 (34 topics, `money-and-value` → the Stage-5 quant deep
dives) are all built and live in the catalog — see `src/content/topics/en/`._

---

## Stage 6 — Ladder bridges (⬤⬤ → ⬤⬤⬤⬤) — fill the transition gaps
_These plug the holes between difficulty tiers: today the catalog jumps from
"what a stock is" (`investing-basics`, beginner) straight to Sharpe ratios
(`investment-metrics`, advanced), and two expert courses (`mev-and-ordering`,
`polymarket-prediction-markets`) assume order-book knowledge nothing teaches._

- [ ] **futures-and-forwards** ⬤⬤ — linear derivatives before options: what a
  forward is, payoff symmetry, futures vs forwards, margin & mark-to-market,
  basis, contango & backwardation, hedgers vs speculators, cost-of-carry
  pricing, rolling contracts. _(deps: `investing-basics`, `interest-and-yield`;
  natural stepping stone into `options-basics`; payoff + carry + margin-call
  islands)_
- [ ] **company-financials-and-valuation** ⬤⬤⬤ — reading and pricing a
  business: balance sheet, income statement, cash-flow statement, how the three
  link, margins & ratios (ROE, debt/equity), earnings & EPS, multiples (P/E,
  EV/EBITDA, P/B), DCF valuation step by step, growth vs value, common
  accounting red flags. _(deps: `stock-markets-and-funds`, `money-time-value`;
  fills the fundamental-analysis pillar `factor-models` silently assumes —
  value factor, book-to-market; three-statement-link + DCF-sensitivity islands)_
- [ ] **market-microstructure** ⬤⬤⬤ — how prices actually form: the limit
  order book, bid–ask spread & why it exists, market vs limit orders revisited,
  makers vs takers, liquidity & depth, slippage & price impact, tick sizes,
  market makers & inventory risk, adverse selection, fragmentation & dark
  pools at a glance. _(deps: `stock-markets-and-funds`; prerequisite knowledge
  for `mev-and-ordering` and `polymarket-prediction-markets` (CLOB); live
  order-book + spread-decomposition islands)_
- [ ] **fixed-income-analytics** ⬤⬤⬤⬤ — bonds at practitioner depth: bond
  pricing math, duration (Macaulay, modified, DV01), convexity, the yield curve
  quantitatively (bootstrapping, spot vs forward rates), term-structure models
  at a glance (Vasicek, CIR), credit spreads & default risk, immunization &
  hedging a rate book. _(deps: `bonds-and-rates`, `statistics-for-finance`;
  expert continuation of `bonds-and-rates`, bridges into
  `stochastic-processes`; duration-lever + yield-curve-bootstrap islands)_
- [ ] **defi-derivatives-perps** ⬤⬤⬤⬤ — derivatives on-chain: perpetual
  futures & why they dominate crypto, the funding-rate mechanism, leverage &
  liquidation engines, insurance funds & ADL, perp DEX designs (order-book vs
  vAMM vs oracle-based), on-chain options & power perps, basis trades & cash
  and carry. _(deps: `defi-amms`, `futures-and-forwards`, `options-pricing`;
  connects the derivatives branch to the DeFi branch; funding-rate +
  liquidation-cascade islands)_
