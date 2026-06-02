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
- [x] **money-and-value** — what money is and why it has value; cash &
  currency; what a payment/transaction is; income vs expense; saving vs
  borrowing; what a bank account & ledger is. _(root; prereq for
  `money-time-value` and `crypto-basics`)_ _(2026-06-01)_
- [x] **investing-basics** — what an asset is; saving vs investing; risk vs
  return intuition; stocks, bonds & funds at a glance; what "a return" means.
  _(deps: `money-and-value`; bridges `interest-and-yield` → `investment-metrics`
  so the beginner→advanced jump isn't a cliff)_ _(2026-06-02)_

## Stage 0 — Foundations (⬤ beginner) — DONE
- [x] **investment-metrics** topic — ROI & CAGR, volatility & drawdown, Sharpe &
  Sortino, alpha & beta, reading a fund factsheet _(pre-existing)_
- [x] **zcash** topic — what private money means, why Bitcoin isn't private,
  three roads to privacy, ZK proofs, inside Zcash, anonymous tx in practice,
  what is Zcash _(pre-existing)_
- [ ] **bitcoin** topic — what Bitcoin is & why it exists, the ledger & mining,
  proof-of-work, 21M supply & halvings, keys/addresses/wallets, sending a tx &
  fees, nodes & full verification, Lightning at a glance. _(same level as
  `zcash`; deps: `crypto-basics`)_
- [ ] **ethereum** topic — what Ethereum is & how it differs from Bitcoin, the
  world computer & EVM, accounts vs UTXO, gas & fees, smart contracts & tokens
  (ERC-20/721), proof-of-stake & staking, L2 rollups at a glance. _(same level
  as `zcash`; deps: `crypto-basics`)_

## Stage 1 — Core building blocks (⬤ beginner)
- [x] **money-time-value** — present value, future value, discounting, compounding _(2026-05-31)_
- [x] **crypto-basics** — what a blockchain is, keys & wallets, tx & fees, UTXO vs account _(2026-05-31)_
- [x] **interest-and-yield** — simple vs compound interest, APR vs APY, nominal vs real _(2026-06-01)_

## Stage 2 — Markets & instruments (⬤⬤ intermediate)
- [x] **bonds-and-rates** — yield curve, duration, convexity intuition _(2026-06-02)_
- [ ] **loans-and-mortgages** ⭐ HIGH PRIORITY — borrowing from the customer's
  side: how a loan/mortgage works, principal & interest, amortization schedules,
  fixed vs variable rate, APR vs APY in practice, term & monthly payment
  trade-offs, total cost of credit, down payment / LTV, fees & closing costs,
  early repayment, refinancing, default & foreclosure basics. _(deps:
  `interest-and-yield`; everyday personal-finance application of compounding —
  build before `stablecoins`)_
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

## Stage 5 — Quant deep dives (⬤⬤⬤⬤ expert) — specific, math-heavy
_Each is a standalone expert lesson going to real-practitioner depth: full
derivations, multiple worked numeric examples, and a chart/simulation island per
quantitative relationship. Build after the learner has `investment-metrics`,
`portfolio-theory` and `value-at-risk`._

- [ ] **monte-carlo-finance** — Monte Carlo simulation for finance: the law of
  large numbers, sampling from return distributions, geometric Brownian motion
  paths, simulating portfolio/retirement outcomes, pricing path-dependent
  options, convergence & standard error, variance-reduction (antithetic
  variates, control variates), pitfalls (garbage-in distributions, correlation,
  fat tails). _(deps: `value-at-risk`; sim-path + convergence islands)_
- [ ] **kelly-and-cagr** — bet sizing & geometric growth: arithmetic vs geometric
  mean, why CAGR (not average return) is what compounds, volatility drag /
  variance penalty, the Kelly criterion (f\* = edge/odds), full vs fractional
  Kelly, Kelly for continuous returns (f\* = μ/σ²), drawdown vs growth trade-off,
  multi-asset Kelly, ruin & over-betting. _(deps: `investment-metrics`,
  `portfolio-theory`; growth-curve + bet-sizing islands)_
- [ ] **bayesian-finance** — Bayesian statistics & probability for finance: prior
  → likelihood → posterior, Bayes' rule worked on market events, conjugate
  priors, Bayesian updating of return/volatility estimates, shrinkage &
  Black–Litterman intuition, credible intervals vs confidence intervals, base
  rates & the prosecutor's fallacy in trading signals, MCMC at a glance. _(deps:
  `investment-metrics`; prior/posterior animation island)_
- [ ] **stochastic-processes** — random processes for asset prices: random walks,
  martingales, Markov chains, Brownian motion & Itô's lemma intuition,
  mean-reversion (Ornstein–Uhlenbeck), jump-diffusion, what a stochastic
  differential equation says. _(deps: `monte-carlo-finance`)_
- [ ] **time-series-finance** — modeling returns over time: stationarity,
  autocorrelation, AR/MA/ARIMA, volatility clustering, GARCH, EWMA, backtesting
  pitfalls (look-ahead, overfitting, multiple testing). _(deps: `bayesian-finance`)_
- [ ] **factor-models** — multi-factor investing: CAPM → Fama–French 3/5-factor,
  momentum, cross-sectional regression, factor risk decomposition, alpha vs
  factor exposure, smart beta. _(deps: `portfolio-theory`)_
- [ ] **risk-of-ruin** — survival & position sizing: risk of ruin formula,
  drawdown distributions, expectancy, sequencing risk, Monte Carlo ruin curves,
  stop-loss math. _(deps: `kelly-and-cagr`, `monte-carlo-finance`)_
- [ ] **portfolio-optimization** — from theory to weights: mean-variance
  optimization mechanics, the covariance matrix, estimation error & instability,
  shrinkage estimators, risk parity, the maximum-Sharpe & minimum-variance
  portfolios, constraints & transaction costs. _(deps: `portfolio-theory`,
  `factor-models`)_
- [ ] **greeks-and-hedging** — managing an options book: delta/gamma/vega/theta/rho
  in depth, delta-neutral hedging, gamma scalping, the volatility surface, vega
  risk, P&L attribution. _(deps: `options-pricing`)_
- [ ] **extreme-value-and-tails** — modeling the tail: fat tails vs Gaussian,
  power laws, Extreme Value Theory, expected shortfall beyond VaR, copulas &
  tail dependence, stress testing. _(deps: `value-at-risk`, `monte-carlo-finance`)_
- [ ] **polymarket-prediction-markets** — betting on real-world outcomes:
  what a prediction market is, how Polymarket works end-to-end (USDC on Polygon,
  outcome share tokens that pay $1 if right / $0 if wrong), price = implied
  probability, the order book / CLOB & how shares are minted/merged from a
  $1 pair, buying YES vs shorting via NO, market resolution & the UMA optimistic
  oracle (proposal, dispute, settlement), fees & gas, liquidity/spread/slippage,
  arbitrage (YES+NO < $1), calibration & the favorite–longshot bias, edge vs
  the crowd, Kelly-sized bets on a binary, and the real risks (oracle disputes,
  illiquidity, regulatory/geofencing, ambiguous resolution). _(deps:
  `bayesian-finance`, `kelly-and-cagr`; payoff + price=probability + order-book
  islands)_
