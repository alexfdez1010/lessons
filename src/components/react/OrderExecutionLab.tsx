import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface VisibleOrderLevel { price: number; quantity: number }
export type OrderSide = 'buy' | 'sell';
export type OrderInstruction = 'market' | 'limit';
export type ImmediateTimeInForce = 'day' | 'ioc' | 'fok';
const sum = (values: number[]) => {
  let total = 0, correction = 0;
  for (const value of values) {
    const next = total + value;
    correction += Math.abs(total) >= Math.abs(value) ? (total - next) + value : (value - next) + total;
    total = next;
  }
  return total + correction;
};
const bounded = (v: number, min: number, max: number) => Number.isFinite(v) && v >= min && v <= max;
const quantityGuard = (q: number) => Number.isInteger(q) && q > 0 && q <= 1e6;
export function validateVisibleBook(bids: VisibleOrderLevel[], asks: VisibleOrderLevel[]) {
  for (const [levels, ascending] of [[bids, false], [asks, true]] as const) {
    if (!Array.isArray(levels) || levels.length > 100 || levels.some((p, i) => !p || !bounded(p.price, 1e-6, 1e6) || !quantityGuard(p.quantity) || i > 0 && (ascending ? p.price <= levels[i - 1].price : p.price >= levels[i - 1].price))) throw new Error('OrderExecutionLab: use at most 100 positive-size levels, strictly descending bids and ascending asks, with finite supported prices.');
  }
  if (bids.length && asks.length && bids[0].price >= asks[0].price) throw new Error('OrderExecutionLab: this single-book continuous-matching model requires an uncrossed positive spread when both sides are present.');
}
export const illustrativeOrderBids: VisibleOrderLevel[] = [{ price: 99.9, quantity: 400 }, { price: 99.8, quantity: 500 }, { price: 99.6, quantity: 600 }];
export const illustrativeOrderAsks: VisibleOrderLevel[] = [{ price: 100.1, quantity: 300 }, { price: 100.2, quantity: 500 }, { price: 100.4, quantity: 600 }];
export interface VisibleExecutionInputs {
  side: OrderSide; orderType: OrderInstruction; quantity: number; limitPrice: number; timeInForce: ImmediateTimeInForce;
  fee: number; available: boolean; bids: VisibleOrderLevel[]; asks: VisibleOrderLevel[];
}
/** One fixed visible book, no hidden liquidity, new quotes, routing or price improvement. */
export function calculateVisibleExecution(input: VisibleExecutionInputs) {
  const { side, orderType, quantity, limitPrice, timeInForce, fee, available, bids, asks } = input;
  validateVisibleBook(bids, asks);
  if (!['buy', 'sell'].includes(side) || !['market', 'limit'].includes(orderType) || !['day', 'ioc', 'fok'].includes(timeInForce) || !quantityGuard(quantity) || !bounded(limitPrice, 1e-6, 1e6) || !bounded(fee, 0, 1e6) || typeof available !== 'boolean') throw new Error('OrderExecutionLab: provide a supported side, instruction, time-in-force, whole-share quantity, price, fee and matching-availability flag.');
  const levels = side === 'buy' ? asks : bids, bestPrice = levels[0]?.price ?? null;
  let fills: VisibleOrderLevel[] = [];
  if (available) {
    let left = quantity;
    for (const level of levels) {
      if (!left) break;
      if (orderType === 'limit' && (side === 'buy' ? level.price > limitPrice : level.price < limitPrice)) break;
      const used = Math.min(left, level.quantity);
      fills.push({ price: level.price, quantity: used }); left -= used;
    }
    if (timeInForce === 'fok' && left > 0) fills = [];
  }
  const filled = fills.reduce((a, p) => a + p.quantity, 0), remaining = quantity - filled, principal = sum(fills.map(p => p.price * p.quantity)), chargedFee = filled ? fee : 0;
  const average = filled ? principal / filled : null, cashFlow = filled ? side === 'buy' ? -principal - chargedFee : principal - chargedFee : 0;
  const allInAverage = filled ? side === 'buy' ? (principal + chargedFee) / filled : (principal - chargedFee) / filled : null;
  const cancelled = available && timeInForce !== 'day' ? remaining : 0;
  const resting = available && timeInForce === 'day' && orderType === 'limit' ? remaining : 0;
  const pending = !available ? remaining : 0, outsideSnapshot = available && timeInForce === 'day' && orderType === 'market' ? remaining : 0;
  const quoteCost = filled && bestPrice !== null ? sum(fills.map(p => p.quantity * (side === 'buy' ? p.price - bestPrice : bestPrice - p.price))) : null;
  const midpoint = bids.length && asks.length ? (bids[0].price + asks[0].price) / 2 : null;
  const midpointCost = filled && midpoint !== null ? sum(fills.map(p => p.quantity * (side === 'buy' ? p.price - midpoint : midpoint - p.price))) : null;
  return { fills, filled, remaining, principal, chargedFee, average, allInAverage, cashFlow, cancelled, resting, pending, outsideSnapshot, bestPrice, midpoint, quoteCost, midpointCost, midpointCostWithFee: midpointCost === null ? null : midpointCost + chargedFee };
}
export function calculateSpreadRoundTrip(bid: number, ask: number, quantity: number, feePerLeg: number) {
  if (!bounded(bid, 1e-6, 1e6) || !bounded(ask, bid, 1e6) || !quantityGuard(quantity) || !bounded(feePerLeg, 0, 1e6)) throw new Error('OrderExecutionLab: spread arithmetic requires supported positive bid/ask, ask no lower than bid, a whole-share quantity and nonnegative per-leg fee.');
  const spread = ask - bid, midpoint = bid + spread / 2, purchaseOutlay = quantity * ask + feePerLeg, netSale = quantity * bid - feePerLeg;
  const pnl = -quantity * spread - 2 * feePerLeg;
  return { spread, midpoint, purchaseOutlay, netSale, pnl, returnOnOutlay: pnl / purchaseOutlay, entryMidCost: quantity * spread / 2 + feePerLeg, exitMidCost: quantity * spread / 2 + feePerLeg };
}
/** A declared single-price FIFO experiment, with no competing better price or cancellations. */
export function calculateQueueFill(orderQuantity: number, sharesAhead: number, incomingEligibleSells: number) {
  if (!quantityGuard(orderQuantity) || !Number.isInteger(sharesAhead) || sharesAhead < 0 || sharesAhead > 1e6 || !Number.isInteger(incomingEligibleSells) || incomingEligibleSells < 0 || incomingEligibleSells > 2e6) throw new Error('OrderExecutionLab: queue quantities must be supported nonnegative whole shares, with a positive submitted quantity.');
  const usedAhead = Math.min(sharesAhead, incomingEligibleSells), availableForOrder = Math.max(incomingEligibleSells - sharesAhead, 0), filled = Math.min(orderQuantity, availableForOrder);
  return { usedAhead, filled, remaining: orderQuantity - filled, aheadRemaining: sharesAhead - usedAhead, incomingBeyondOrder: Math.max(availableForOrder - filled, 0) };
}
export interface ConditionalStopInputs extends VisibleExecutionInputs {
  stopPrice: number; reference: 'last' | 'sideQuote'; lastPrice: number; monitoringEligible: boolean; previouslyTriggered: boolean;
}
/** Previously triggered state is latched; a later reference rebound cannot make it dormant. */
export function calculateConditionalStop(input: ConditionalStopInputs) {
  validateVisibleBook(input.bids, input.asks);
  if (!bounded(input.stopPrice, 1e-6, 1e6) || !bounded(input.lastPrice, 1e-6, 1e6) || !['last', 'sideQuote'].includes(input.reference) || typeof input.monitoringEligible !== 'boolean' || typeof input.previouslyTriggered !== 'boolean') throw new Error('OrderExecutionLab: supply a supported stop price, observed reference, monitoring eligibility and prior activation state.');
  // Validate the execution instruction even when it is still dormant.
  const dormantValidation = calculateVisibleExecution({ ...input, available: false });
  const referenceValue = input.reference === 'last' ? input.lastPrice : input.side === 'sell' ? input.bids[0]?.price ?? null : input.asks[0]?.price ?? null;
  const conditionMet = referenceValue !== null && (input.side === 'sell' ? referenceValue <= input.stopPrice : referenceValue >= input.stopPrice);
  const activatedNow = !input.previouslyTriggered && input.monitoringEligible && conditionMet;
  const active = input.previouslyTriggered || activatedNow;
  const execution = active ? calculateVisibleExecution(input) : null;
  return { referenceValue, conditionMet, activatedNow, active, execution, dormantQuantity: active ? 0 : dormantValidation.remaining };
}

const labelsDefault = {
  scope: 'Invented fixed depth snapshot, whole shares and USD per share. Available quantities are consumed in price order; no new or amended levels arrive. Only the shown opposing levels are accessible; there is no hidden liquidity, rerouting, price improvement, tax, FX or funding cost. A real broker or venue can follow different eligibility, priority and order-handling rules.',
  spreadScope: 'Fixed two-sided quote with enough shares for both full legs, no intervening price move and no price improvement. Each leg has the selected flat fee. The midpoint is a chosen comparison, not an executable quote.',
  queueScope: 'A separate single-price FIFO queue at USD 100.05. Earlier same-price shares are served first. There are no better competing bids, cancellations, hidden priority or new orders ahead; this is a declared model, not every venue’s allocation rule.',
  stopScope: 'A conditional instruction accepted earlier is observed at this snapshot. The chosen reference and monitoring eligibility determine new activation. Prior activation remains latched. An active order can match only when eligible matching is available. The position starts long for a sell exit or short for a buy exit, with USD 100 entry price; initial trade costs and funding are excluded.',
  side: 'Order side', buy: 'Buy', sell: 'Sell', instruction: 'Price instruction', market: 'Market', limit: 'Limit', quantity: 'Requested whole shares', limitPrice: 'Security execution limit, used only for a limit instruction, USD per share', notApplied: 'No limit applies to this market instruction', fee: 'Flat fee charged once only if any shares fill, USD', availability: 'Eligible matching is available in this snapshot',
  tif: 'Immediate remainder instruction', day: 'DAY: eligible remainder may remain', ioc: 'IOC: cancel the immediate unfilled remainder', fok: 'FOK: fill everything immediately or cancel all',
  spreadWidth: 'Quoted spread, USD per share', spreadBid: 'Fixed bid, USD per share', spreadAsk: 'Calculated ask, USD per share', midpoint: 'Quote midpoint, USD per share', spread: 'Quoted spread, USD per share', purchase: 'Cash paid for the complete buy leg', sale: 'Cash received after the complete sell leg', pnl: 'Round-trip P&L after both fees', cashReturn: 'Round-trip P&L divided by purchase outlay', entryCost: 'Buy-leg cost versus the unchanged midpoint, including its fee', exitCost: 'Sell-leg cost versus the unchanged midpoint, including its fee',
  ahead: 'Same-price shares ahead of this order', incoming: 'Incoming eligible sell shares', usedAhead: 'Incoming shares consumed by the earlier queue', aheadRemaining: 'Earlier same-price shares remaining', beyond: 'Incoming shares beyond this order', queuePrice: 'Declared queue price, USD per share',
  stopType: 'Instruction after activation', stopMarket: 'Stop-market', stopLimit: 'Stop-limit', stopPrice: 'Stop trigger, USD per share', stopLimitPrice: 'Limit after activation, USD per share', reference: 'Reference used for new activation', last: 'Last-sale reference', sideQuote: 'Bid for a sell stop; ask for a buy stop', scenario: 'Observed snapshot', stale: 'Last sale 96; bid 94 and ask 94.20', downGap: 'Down-gap snapshot: last 88; bid 88 and ask 88.20', upGap: 'Up-gap snapshot: last 108; bid 108 and ask 108.20', rebound: 'Recovery snapshot: last 99; bid 99 and ask 99.20', eligible: 'New-trigger monitoring is eligible in this snapshot', prior: 'Activation occurred earlier and the order is still unfilled',
  referenceValue: 'Chosen observed reference, USD per share', condition: 'The current reference meets the trigger condition', active: 'Stop instruction reached activated state before matching', yes: 'Yes', no: 'No', dormant: 'Dormant under the stated monitoring rule', activated: 'Newly activated under the stated monitoring rule', latched: 'Earlier activation is retained; the new quote does not undo that activation',
  filled: 'Shares filled in this snapshot', remaining: 'Requested shares not filled', principal: 'Security principal before the flat fee', chargedFee: 'Fee actually charged for this snapshot', average: 'Quantity-weighted security execution price', allIn: 'Per-filled-share cash paid or received after the fee', cashFlow: 'Signed cash flow: buy negative, sell positive', cancelled: 'Unfilled shares cancelled by IOC or FOK', resting: 'Limit shares left resting under the model DAY instruction', pending: 'Shares awaiting an available matching process', outside: 'Market-order remainder whose further handling is outside this snapshot', quoteCost: 'Adverse execution amount versus the initial best opposing quote', midpointCost: 'Execution amount versus the initial midpoint, before the fee', totalCost: 'Execution amount versus the midpoint plus the fee', unavailable: 'No defined average: no shares filled', absent: 'No opposing quote in the supplied book', closedPnl: 'P&L on the shares closed, relative to the stated USD 100 entry', openMarkPnl: 'Marked P&L of the still-open position at the last sale; not liquidation proceeds',
  noMatching: 'No eligible matching is available here. No shares have filled; the unprocessed request is not an execution guarantee or an assumed cancellation.', outsideMessage: 'The shown book is exhausted. This model does not determine whether a real market-order remainder is routed, queued, cancelled or rejected; inspect the actual order status and provider rules.',
  bookChart: 'Opposing visible levels: full bar length is offered quantity and the highlighted amount is this order’s fill. Prices and quantities remain in the complete table.', queueChart: 'Incoming volume first consumes earlier same-price shares, then this order, then any excess. The bars and table show quantities, not execution probabilities.', spreadChart: 'The two bars compare full-leg cash amounts. Their difference is the round-trip P&L shown above; the spread is not charged a second full time on each leg.', stopChart: 'Observe the specified reference, apply the accepted conditional rule, then match the resulting active instruction. A trigger price is not a fill price or a maximum-loss amount.',
  availableShares: 'Visible shares', usedShares: 'Filled from this level', notFilledShares: 'Still visible at this level', price: 'Level price, USD per share', row: 'Level or stage', level: 'Visible level', shares: 'Shares', cash: 'Signed cash amount, USD', levelPrincipal: 'Executed security principal before fee, USD', earlierStage: 'Earlier queue', ownStage: 'This order', beyondStage: 'Incoming excess', buyLeg: 'Full buy leg', sellLeg: 'Full sell leg', triggerStage: 'Observe reference and conditional activation', matchStage: 'Match only the resulting active order', residualStage: 'Inspect remaining position and instruction',
  table: 'Complete prices, quantities and cash arithmetic; focus and use arrow keys to scroll horizontally', caption: 'Retain the order terms, quote time and size, applicable session, trigger reference, fees and final confirmed status with the result. This fixed experiment does not promise a live fill.',
};
export type OrderExecutionLabels = typeof labelsDefault;
export interface OrderExecutionLabProps {
  view?: 'spread' | 'book' | 'queue' | 'stop'; side?: OrderSide; orderType?: OrderInstruction; quantity?: number; limitPrice?: number; fee?: number; timeInForce?: ImmediateTimeInForce; available?: boolean;
  bid?: number; spreadWidth?: number; sharesAhead?: number; incomingShares?: number;
  stopPrice?: number; stopLimitPrice?: number; reference?: 'last' | 'sideQuote'; scenario?: 'stale' | 'downGap' | 'upGap' | 'rebound'; monitoringEligible?: boolean; previouslyTriggered?: boolean;
  title?: string; caption?: string; locale?: string; labels?: OrderExecutionLabels; className?: string;
}
const nativeGrid = (v: number, min: number, max: number, step: number, name: string) => {
  if (!bounded(v, min, max) || Math.abs((v - min) / step - Math.round((v - min) / step)) > 1e-8) throw new Error(`OrderExecutionLab: ${name} must match its native range and step.`);
};
export function OrderExecutionLab({ view = 'book', side = 'buy', orderType = 'market', quantity = 500, limitPrice = 100.15, fee = 0, timeInForce = 'day', available = true, bid = 99.95, spreadWidth = .1, sharesAhead = 200, incomingShares = 150, stopPrice = 95, stopLimitPrice = 94, reference = 'last', scenario = 'downGap', monitoringEligible = true, previouslyTriggered = false, title = 'Follow the instruction through quantities and cash', caption, locale = 'en-US', labels = labelsDefault, className }: OrderExecutionLabProps) {
  if (!['spread', 'book', 'queue', 'stop'].includes(view) || !['buy', 'sell'].includes(side) || !['market', 'limit'].includes(orderType) || !['day', 'ioc', 'fok'].includes(timeInForce) || !['last', 'sideQuote'].includes(reference) || !['stale', 'downGap', 'upGap', 'rebound'].includes(scenario) || [available, monitoringEligible, previouslyTriggered].some(v => typeof v !== 'boolean') || !bounded(bid, 1, 1000)) throw new Error('OrderExecutionLab: provide supported view, side, instructions, reference, scenario, bid and boolean availability states.');
  nativeGrid(quantity, 100, 2000, 100, 'whole-share quantity'); nativeGrid(limitPrice, 99.5, 100.5, .05, 'book limit'); nativeGrid(fee, 0, 20, 1, 'flat fee'); nativeGrid(spreadWidth, 0, 1, .01, 'spread width'); nativeGrid(sharesAhead, 0, 1000, 50, 'shares ahead'); nativeGrid(incomingShares, 0, 3000, 50, 'incoming shares'); nativeGrid(stopPrice, 90, 110, 1, 'stop price'); nativeGrid(stopLimitPrice, 85, 115, 1, 'stop-limit price');
  if (!labels || Object.keys(labelsDefault).some(k => typeof labels[k as keyof OrderExecutionLabels] !== 'string' || !labels[k as keyof OrderExecutionLabels].trim())) throw new Error('OrderExecutionLab: provide all nonempty localized visible and accessibility labels.');
  const id = useId(), l = labels;
  const [chosenSide, setSide] = useState(side), [kind, setKind] = useState(orderType), [q, setQ] = useState(quantity), [limit, setLimit] = useState(limitPrice), [charge, setCharge] = useState(fee), [tif, setTif] = useState(timeInForce), [canMatch, setCanMatch] = useState(available), [width, setWidth] = useState(spreadWidth), [ahead, setAhead] = useState(sharesAhead), [incoming, setIncoming] = useState(incomingShares), [trigger, setTrigger] = useState(stopPrice), [stopLimit, setStopLimit] = useState(stopLimitPrice), [ref, setRef] = useState(reference), [snapshot, setSnapshot] = useState(scenario), [canMonitor, setCanMonitor] = useState(monitoringEligible), [wasActive, setWasActive] = useState(previouslyTriggered);
  const snapshotValues = { stale: [96, 94, 94.2], downGap: [88, 88, 88.2], upGap: [108, 108, 108.2], rebound: [99, 99, 99.2] }[snapshot];
  const stopBids = [{ price: snapshotValues[1], quantity: 500 }, { price: snapshotValues[1] - .2, quantity: 1000 }], stopAsks = [{ price: snapshotValues[2], quantity: 500 }, { price: snapshotValues[2] + .2, quantity: 1000 }];
  const inputs = { side: chosenSide, orderType: kind, quantity: q, limitPrice: view === 'stop' ? stopLimit : limit, fee: charge, timeInForce: tif, available: canMatch, bids: view === 'stop' ? stopBids : illustrativeOrderBids, asks: view === 'stop' ? stopAsks : illustrativeOrderAsks };
  const book = calculateVisibleExecution(inputs), spread = calculateSpreadRoundTrip(bid, bid + width, q, charge), queue = calculateQueueFill(q, ahead, incoming), stop = calculateConditionalStop({ ...inputs, stopPrice: trigger, reference: ref, lastPrice: snapshotValues[0], monitoringEligible: canMonitor, previouslyTriggered: wasActive });
  const execution = view === 'stop' ? stop.execution : book;
  const number = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(Math.abs(n) < 5e-7 ? 0 : n);
  const money = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(Math.abs(n) < 5e-7 ? 0 : n);
  const percent = (n: number) => new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(Math.abs(n) < 5e-9 ? 0 : n);
  const priceValue = (n: number | null) => n === null ? l.unavailable : money(n);
  const closedPnl = execution?.filled ? sum(execution.fills.map(p => p.quantity * (chosenSide === 'sell' ? p.price - 100 : 100 - p.price))) - execution.chargedFee : 0;
  const openShares = q - (execution?.filled ?? 0), openMark = openShares * (chosenSide === 'sell' ? snapshotValues[0] - 100 : 100 - snapshotValues[0]);
  const resultRows: [string, string, string][] = view === 'spread' ? [['bid', l.spreadBid, money(bid)], ['ask', l.spreadAsk, money(bid + width)], ['spread', l.spread, money(spread.spread)], ['midpoint', l.midpoint, money(spread.midpoint)], ['purchase', l.purchase, money(spread.purchaseOutlay)], ['sale', l.sale, money(spread.netSale)], ['pnl', l.pnl, money(spread.pnl)], ['return', l.cashReturn, percent(spread.returnOnOutlay)], ['entryCost', l.entryCost, money(spread.entryMidCost)], ['exitCost', l.exitCost, money(spread.exitMidCost)]] : view === 'queue' ? [['queuePrice', l.queuePrice, money(100.05)], ['usedAhead', l.usedAhead, number(queue.usedAhead)], ['aheadRemaining', l.aheadRemaining, number(queue.aheadRemaining)], ['filled', l.filled, number(queue.filled)], ['remaining', l.remaining, number(queue.remaining)], ['beyond', l.beyond, number(queue.incomingBeyondOrder)]] : [...(view === 'stop' ? [['referenceValue', l.referenceValue, stop.referenceValue === null ? l.absent : money(stop.referenceValue)], ['condition', l.condition, stop.conditionMet ? l.yes : l.no], ['active', l.active, stop.active ? l.yes : l.no]] as [string, string, string][] : []), ['filled', l.filled, number(execution?.filled ?? 0)], ['remaining', l.remaining, number(q - (execution?.filled ?? 0))], ['average', l.average, priceValue(execution?.average ?? null)], ['principal', l.principal, money(execution?.principal ?? 0)], ['fee', l.chargedFee, money(execution?.chargedFee ?? 0)], ['allIn', l.allIn, priceValue(execution?.allInAverage ?? null)], ['cashFlow', l.cashFlow, money(execution?.cashFlow ?? 0)], ['cancelled', l.cancelled, number(execution?.cancelled ?? 0)], ['resting', l.resting, number(execution?.resting ?? 0)], ['pending', l.pending, number(execution?.pending ?? 0)], ['outside', l.outside, number(execution?.outsideSnapshot ?? 0)], ...(view === 'book' ? [['quoteCost', l.quoteCost, execution?.quoteCost === null ? l.unavailable : money(execution!.quoteCost!)], ['midpointCost', l.midpointCost, execution?.midpointCost === null ? l.unavailable : money(execution!.midpointCost!)], ['totalCost', l.totalCost, execution?.midpointCostWithFee === null ? l.unavailable : money(execution!.midpointCostWithFee!)]] as [string, string, string][] : [['closedPnl', l.closedPnl, money(closedPnl)], ['openPnl', l.openMarkPnl, money(openMark)]] as [string, string, string][])];
  const selectClass = 'mt-2 min-h-10 w-full rounded-sm border border-ink-300 bg-surface p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
  const selector = (key: string, label: string, current: string, change: (v: string) => void, options: [string, string][]) => <label className="block min-w-0 text-sm text-ink-800" htmlFor={`${id}-${key}`}>{label}<select id={`${id}-${key}`} aria-label={label} value={current} onChange={e => change(e.currentTarget.value)} className={selectClass}>{options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label>;
  const range = (key: string, label: string, current: number, change: (n: number) => void, min: number, max: number, step: number, disabled = false) => <label className="block min-w-0 text-sm text-ink-800" htmlFor={`${id}-${key}`}><span className="flex flex-wrap justify-between gap-2"><span>{label}</span><output htmlFor={`${id}-${key}`} className="font-mono">{disabled ? l.notApplied : number(current)}</output></span><input id={`${id}-${key}`} aria-label={label} aria-valuetext={disabled ? l.notApplied : number(current)} disabled={disabled} type="range" value={current} min={min} max={max} step={step} onChange={e => change(Number(e.currentTarget.value))} className="mt-1 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></label>;
  const check = (key: string, label: string, current: boolean, change: (v: boolean) => void) => <label htmlFor={`${id}-${key}`} className="flex min-h-8 items-start gap-2 text-sm text-ink-800"><input id={`${id}-${key}`} type="checkbox" checked={current} onChange={e => change(e.currentTarget.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600" />{label}</label>;
  const levels = chosenSide === 'buy' ? inputs.asks : inputs.bids, filledAt = (price: number) => execution?.fills.find(p => p.price === price)?.quantity ?? 0;
  const bars = view === 'spread' ? [{ label: l.buyLeg, value: spread.purchaseOutlay }, { label: l.sellLeg, value: spread.netSale }] : view === 'queue' ? [{ label: l.earlierStage, value: queue.usedAhead }, { label: l.ownStage, value: queue.filled }, { label: l.beyondStage, value: queue.incomingBeyondOrder }] : levels.map(p => ({ label: money(p.price), value: p.quantity, filled: filledAt(p.price) }));
  const barMaximum = Math.max(1, ...bars.map(b => Math.abs(b.value))), percentWidth = (v: number) => `${Number((100 * Math.abs(v) / barMaximum).toFixed(3))}%`;
  const tableHeaders = view === 'spread' ? [l.row, l.shares, l.cash] : view === 'queue' ? [l.row, l.shares] : [l.row, l.price, l.availableShares, l.usedShares, l.notFilledShares, l.levelPrincipal];
  const tableRows = view === 'spread' ? [[l.buyLeg, number(q), money(-spread.purchaseOutlay)], [l.sellLeg, number(q), money(spread.netSale)], [l.pnl, '', money(spread.pnl)]] : view === 'queue' ? [[l.earlierStage, number(queue.usedAhead)], [l.ownStage, number(queue.filled)], [l.beyondStage, number(queue.incomingBeyondOrder)], [l.remaining, number(queue.remaining)]] : levels.map((p, i) => [number(i + 1), money(p.price), number(p.quantity), number(filledAt(p.price)), number(p.quantity - filledAt(p.price)), money(filledAt(p.price) * p.price)]);
  return <figure data-order-view={view} className={cx('not-prose my-8 min-w-0 rounded-card border border-ink-200 bg-surface p-4 shadow-soft sm:p-6', className)}>
    <figcaption className="font-display text-lg font-semibold text-ink-900">{title}</figcaption>
    <p className="mt-3 text-sm leading-relaxed text-ink-700">{view === 'spread' ? l.spreadScope : view === 'queue' ? l.queueScope : l.scope}</p>
    {view === 'stop' && <p className="mt-3 text-sm leading-relaxed text-ink-700">{l.stopScope}</p>}
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {range('quantity', l.quantity, q, setQ, 100, 2000, 100)}
      {view === 'spread' && range('spread', l.spreadWidth, width, setWidth, 0, 1, .01)}
      {view !== 'queue' && range('fee', l.fee, charge, setCharge, 0, 20, 1)}
      {['book', 'stop'].includes(view) && selector('side', l.side, chosenSide, v => setSide(v as OrderSide), [['buy', l.buy], ['sell', l.sell]])}
      {view === 'book' && <>{selector('kind', l.instruction, kind, v => setKind(v as OrderInstruction), [['market', l.market], ['limit', l.limit]])}{range('limit', l.limitPrice, limit, setLimit, 99.5, 100.5, .05, kind === 'market')}</>}
      {['book', 'stop'].includes(view) && selector('tif', l.tif, tif, v => setTif(v as ImmediateTimeInForce), [['day', l.day], ['ioc', l.ioc], ['fok', l.fok]])}
      {view === 'queue' && <>{range('ahead', l.ahead, ahead, setAhead, 0, 1000, 50)}{range('incoming', l.incoming, incoming, setIncoming, 0, 3000, 50)}</>}
      {view === 'stop' && <>{selector('stop-kind', l.stopType, kind, v => setKind(v as OrderInstruction), [['market', l.stopMarket], ['limit', l.stopLimit]])}{range('trigger', l.stopPrice, trigger, setTrigger, 90, 110, 1)}{range('stop-limit', l.stopLimitPrice, stopLimit, setStopLimit, 85, 115, 1, kind === 'market')}{selector('reference', l.reference, ref, v => setRef(v as typeof reference), [['last', l.last], ['sideQuote', l.sideQuote]])}{selector('scenario', l.scenario, snapshot, v => setSnapshot(v as typeof scenario), [['stale', l.stale], ['downGap', l.downGap], ['upGap', l.upGap], ['rebound', l.rebound]])}{check('monitor', l.eligible, canMonitor, setCanMonitor)}{check('prior', l.prior, wasActive, setWasActive)}</>}
      {['book', 'stop'].includes(view) && check('matching', l.availability, canMatch, setCanMatch)}
    </div>
    <dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3 rounded-card bg-surface-sunken p-3 text-sm text-ink-900">{resultRows.map(([key, label, display]) => <div key={key} className="flex flex-wrap justify-between gap-2"><dt>{label}</dt><dd data-stat={key} className={cx('m-0', [l.unavailable, l.absent].includes(display) ? '' : 'font-mono')}>{display}</dd></div>)}</dl>
    {view === 'stop' && <p role="status" className="mt-3 text-sm leading-relaxed text-ink-800">{wasActive ? l.latched : stop.active ? l.activated : l.dormant}</p>}
    {['book', 'stop'].includes(view) && !canMatch && <p role="status" className="mt-3 rounded-card border border-accent-300 p-3 text-sm leading-relaxed text-ink-800">{l.noMatching}</p>}
    {!!execution?.outsideSnapshot && ['book', 'stop'].includes(view) && <p className="mt-3 text-sm leading-relaxed text-ink-800">{l.outsideMessage}</p>}
    <p className="mt-4 text-sm leading-relaxed text-ink-700">{view === 'spread' ? l.spreadChart : view === 'queue' ? l.queueChart : view === 'stop' ? l.stopChart : l.bookChart}</p>
    {view === 'stop' && <ol className="mt-3 grid list-none gap-2 p-0 text-sm sm:grid-cols-3">{[l.triggerStage, l.matchStage, l.residualStage].map((label, i) => <li key={label} className="rounded-card border border-ink-200 p-3"><span className="font-mono text-brand-700">{i + 1}. </span>{label}</li>)}</ol>}
    <div className="mt-3 space-y-3">{bars.map((bar, i) => <div key={bar.label}><div className="flex flex-wrap justify-between gap-2 text-sm text-ink-800"><span>{bar.label}</span><span className="font-mono">{view === 'spread' ? money(bar.value) : number(bar.value)}{'filled' in bar ? ` · ${l.usedShares}: ${number(bar.filled ?? 0)}` : ''}</span></div><div aria-hidden="true" className="mt-1 h-5 rounded-sm bg-surface-sunken"><div className="relative h-full rounded-sm bg-brand-300" style={{ width: percentWidth(bar.value) }}>{'filled' in bar && <div className="h-full rounded-sm bg-brand-600" style={{ width: `${Number((bar.value ? 100 * (bar.filled ?? 0) / bar.value : 0).toFixed(3))}%` }} />}</div></div></div>)}</div>
    <div className="mt-3"><table tabIndex={0} aria-label={l.table} className="block w-full max-w-full overflow-x-auto border-collapse text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><thead><tr>{tableHeaders.map(h => <th key={h} scope="col" className="border-b border-ink-300 p-3 text-left font-semibold text-ink-900">{h}</th>)}</tr></thead><tbody>{tableRows.map((row, i) => <tr key={i}>{row.map((display, j) => j === 0 ? <th key={j} scope="row" className="border-b border-ink-100 p-3 text-left font-medium">{display}</th> : <td key={j} className="whitespace-nowrap border-b border-ink-100 p-3 font-mono">{display}</td>)}</tr>)}</tbody></table></div>
    <p className="mt-2 text-sm leading-relaxed text-ink-700">{l.table}</p>
    <p className="mt-4 text-sm leading-relaxed text-ink-700">{caption ?? l.caption}</p>
  </figure>;
}
