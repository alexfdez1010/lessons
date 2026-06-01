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
- When fewer than **3** unchecked items remain, append the next harder topics
  (each one notch up) so the pipeline never empties. Also, follow an horizontal approach
- Difficulty legend: ⬤ beginner · ⬤⬤ intermediate · ⬤⬤⬤ advanced · ⬤⬤⬤⬤ expert.

---

## Stage −1 — Absolute basics (⬤ beginner) — THE GROUND FLOOR
_Build these **first** (exception to the "never easier than last completed"
rule): they are the prerequisites every current beginner course silently
assumes. `money-and-value` is the root of the whole catalog._
- [ ] **money-and-value** — what money is and why it has value; cash &
  currency; what a payment/transaction is; income vs expense; saving vs
  borrowing; what a bank account & ledger is. _(root; prereq for
  `money-time-value` and `crypto-basics`)_
- [ ] **investing-basics** — what an asset is; saving vs investing; risk vs
  return intuition; stocks, bonds & funds at a glance; what "a return" means.
  _(deps: `money-and-value`; bridges `interest-and-yield` → `investment-metrics`
  so the beginner→advanced jump isn't a cliff)_

## Stage 0 — Foundations (⬤ beginner) — DONE
- [x] **investment-metrics** topic — ROI & CAGR, volatility & drawdown, Sharpe &
  Sortino, alpha & beta, reading a fund factsheet _(pre-existing)_
- [x] **zcash** topic — what private money means, why Bitcoin isn't private,
  three roads to privacy, ZK proofs, inside Zcash, anonymous tx in practice,
  what is Zcash _(pre-existing)_

## Stage 1 — Core building blocks (⬤ beginner)
- [x] **money-time-value** — present value, future value, discounting, compounding _(2026-05-31)_
- [x] **crypto-basics** — what a blockchain is, keys & wallets, tx & fees, UTXO vs account _(2026-05-31)_
- [x] **interest-and-yield** — simple vs compound interest, APR vs APY, nominal vs real _(2026-06-01)_

## Stage 2 — Markets & instruments (⬤⬤ intermediate)
- [ ] **bonds-and-rates** — yield curve, duration, convexity intuition
- [ ] **stablecoins** — fiat-backed vs crypto-backed vs algorithmic, peg mechanics, depeg risk
- [ ] **defi-amms** — constant-product AMMs, liquidity pools, slippage, impermanent loss

## Stage 3 — Risk & derivatives (⬤⬤⬤ advanced)
- [ ] **portfolio-theory** — diversification, efficient frontier, correlation, CAPM
- [ ] **options-basics** — calls/puts, payoff diagrams, intrinsic vs time value
- [ ] **defi-lending** — over-collateralization, health factor, liquidations, interest-rate models

## Stage 4 — Quant & advanced DeFi (⬤⬤⬤⬤ expert)
- [ ] **options-pricing** — Black–Scholes intuition, the Greeks, implied volatility
- [ ] **value-at-risk** — VaR & CVaR, historical vs parametric vs Monte Carlo
- [ ] **mev-and-ordering** — mempool, front/back-running, sandwich attacks, PBS
