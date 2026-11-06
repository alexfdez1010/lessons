import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface AuctionLimitOrder { price: number; quantity: number; }
export interface CallAuctionInputs {
  prices: number[];
  buyOrders: AuctionLimitOrder[];
  sellOrders: AuctionLimitOrder[];
  marketBuy: number;
  marketSell: number;
  referencePrice: number;
}
export interface AuctionCandidate {
  priceCents: number;
  demand: number;
  supply: number;
  matched: number;
  imbalance: number;
}
export const DEFAULT_AUCTION_PRICES = [10, 10.1, 10.2, 10.3];
export const DEFAULT_AUCTION_BUYS = [{price:10.3,quantity:30},{price:10.2,quantity:50},{price:10.1,quantity:40},{price:10,quantity:20}];
export const DEFAULT_AUCTION_SELLS = [{price:10,quantity:40},{price:10.1,quantity:50},{price:10.2,quantity:40},{price:10.3,quantity:30}];
const cents = (value: number) => Math.round(value * 100);
const validMoney = (value: number) => Number.isFinite(value) && value > 0 && value <= 1_000_000 && Math.abs(value * 100 - cents(value)) < 1e-6;
const validQuantity = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000;

function validate(inputs: CallAuctionInputs) {
  const {prices,buyOrders,sellOrders,marketBuy,marketSell,referencePrice}=inputs;
  if (!Array.isArray(prices) || prices.length < 2 || prices.length > 12 || prices.some((price) => !validMoney(price))) throw new Error('CallAuctionClearing: prices requires 2–12 positive cent-precision candidates.');
  const tick = cents(prices[1]) - cents(prices[0]);
  if (tick <= 0 || prices.some((price,index) => index > 0 && cents(price)-cents(prices[index-1]) !== tick)) throw new Error('CallAuctionClearing: candidates must be an increasing equally spaced tick grid.');
  for (const orders of [buyOrders,sellOrders]) if (!Array.isArray(orders) || orders.length > 100 || orders.some((order) => !order || !validMoney(order.price) || !validQuantity(order.quantity) || (cents(order.price)-cents(prices[0]))%tick !== 0)) throw new Error('CallAuctionClearing: limit orders need valid tick-aligned prices and nonnegative integer quantities.');
  if (!validQuantity(marketBuy) || !validQuantity(marketSell) || !validMoney(referencePrice) || referencePrice < prices[0] || referencePrice > prices[prices.length-1]) throw new Error('CallAuctionClearing: market quantities must be nonnegative integers and the cent-precision reference must lie within the candidate range.');
}

/** Invented hierarchy: max matched, min absolute imbalance, nearest reference, lower price. No venue is reproduced. */
export function calculateCallAuction(inputs: CallAuctionInputs): {candidates:AuctionCandidate[];selected:AuctionCandidate|null} {
  validate(inputs);
  const candidates=inputs.prices.map((price) => {
    const priceCents=cents(price);
    const demand=inputs.marketBuy+inputs.buyOrders.filter((order)=>cents(order.price)>=priceCents).reduce((sum,order)=>sum+order.quantity,0);
    const supply=inputs.marketSell+inputs.sellOrders.filter((order)=>cents(order.price)<=priceCents).reduce((sum,order)=>sum+order.quantity,0);
    return {priceCents,demand,supply,matched:Math.min(demand,supply),imbalance:demand-supply};
  });
  if (Math.max(...candidates.map(row=>row.matched))===0) return {candidates,selected:null};
  const reference=cents(inputs.referencePrice);
  const ranked=[...candidates].sort((a,b)=>b.matched-a.matched||Math.abs(a.imbalance)-Math.abs(b.imbalance)||Math.abs(a.priceCents-reference)-Math.abs(b.priceCents-reference)||a.priceCents-b.priceCents);
  return {candidates,selected:ranked[0]};
}

export interface CallAuctionClearingProps extends Partial<CallAuctionInputs> {
  title?: string;
  marketBuyLabel?: string;
  marketSellLabel?: string;
  referenceLabel?: string;
  demandLabel?: string;
  supplyLabel?: string;
  matchedLabel?: string;
  priceLabel?: string;
  imbalanceLabel?: string;
  buyExcessLabel?: string;
  sellExcessLabel?: string;
  balancedLabel?: string;
  noCrossLabel?: string;
  noPriceImbalanceLabel?: string;
  selectedLabel?: string;
  shareLabel?: string;
  sharesLabel?: string;
  chartLabel?: string;
  candidateTableLabel?: string;
  candidateHeaders?: string[];
  ordersLabel?: string;
  noOrdersLabel?: string;
  orderHeaders?: string[];
  buyLabel?: string;
  sellLabel?: string;
  rulesLabel?: string;
  caption?: string;
  locale?: string;
  currency?: string;
  className?: string;
}

/** Native controls update a common-scale bar comparison; no timed or automatic motion. */
export function CallAuctionClearing({
  prices=DEFAULT_AUCTION_PRICES,buyOrders=DEFAULT_AUCTION_BUYS,sellOrders=DEFAULT_AUCTION_SELLS,marketBuy=60,marketSell=10,referencePrice=10.14,
  title='A single-price call auction snapshot',marketBuyLabel='Auction market-buy quantity',marketSellLabel='Auction market-sell quantity',referenceLabel='Reference price for ties',demandLabel='Eligible buys',supplyLabel='Eligible sells',matchedLabel='Matched quantity',priceLabel='Selected auction price',imbalanceLabel='Signed imbalance at selected price',buyExcessLabel='Buy excess',sellExcessLabel='Sell excess',balancedLabel='Balanced',noCrossLabel='No cross: no execution price',noPriceImbalanceLabel='No selected-price imbalance',selectedLabel='Selected',shareLabel='share',sharesLabel='shares',chartLabel='Eligible demand, eligible supply and matched quantity at each allowed candidate price, all on one common quantity scale.',candidateTableLabel='Candidate calculations',candidateHeaders=['Candidate price','Eligible buys','Eligible sells','Matched once','Buys minus sells'],ordersLabel='Fixed limit orders',noOrdersLabel='No fixed limit orders in this snapshot',orderHeaders=['Side','Limit price','Quantity'],buyLabel='Buy',sellLabel='Sell',rulesLabel='Illustrative hierarchy: maximize matched shares, then minimize absolute imbalance, then choose the price closest to the reference, then the lower price.',caption='This invented auction admits only the displayed candidate tick grid. Market orders are eligible at all candidates; a buy limit admits prices at or below its limit and a sell limit admits prices at or above it. No collars, hidden orders, allocation priority or venue deadlines are modelled. Controls represent permitted changes before uncrossing. If no shares can match, no execution price is assigned.',locale='en-US',currency='EUR',className,
}:CallAuctionClearingProps) {
  validate({prices,buyOrders,sellOrders,marketBuy,marketSell,referencePrice});
  for(const [labels,length] of [[candidateHeaders,5],[orderHeaders,3]] as const) if(!Array.isArray(labels)||labels.length!==length||labels.some(label=>typeof label!=='string'||!label.trim()))throw new Error('CallAuctionClearing: table headings must have five and three non-empty labels.');
  const id=useId();
  const [inputs,setInputs]=useState({marketBuy,marketSell,referencePrice});
  const result=calculateCallAuction({prices,buyOrders,sellOrders,...inputs});
  const money=(value:number)=>new Intl.NumberFormat(locale,{style:'currency',currency,useGrouping:true}).format(value);
  const number=new Intl.NumberFormat(locale);
  const units=(value:number)=>Math.abs(value)===1?shareLabel:sharesLabel;
  const signed=new Intl.NumberFormat(locale,{signDisplay:'exceptZero'});
  const max=Math.max(1,...result.candidates.flatMap(row=>[row.demand,row.supply]));
  const selected=result.selected;
  const quantities=[{key:'marketBuy' as const,label:marketBuyLabel},{key:'marketSell' as const,label:marketSellLabel}];
  const tableClass='block w-full max-w-full overflow-x-auto text-left text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
  return <figure className={cx('not-prose my-6 min-w-0 rounded-card bg-surface-sunken/50 p-5',className)}>
    <figcaption className="font-display font-semibold text-ink-900">{title}</figcaption>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {quantities.map(control=><div key={control.key} className="min-w-0"><label htmlFor={`${id}-${control.key}`} className="flex flex-wrap justify-between gap-2 text-sm text-ink-700"><span>{control.label}</span><output htmlFor={`${id}-${control.key}`} className="font-mono font-semibold text-ink-900">{number.format(inputs[control.key])}</output></label><input id={`${id}-${control.key}`} type="range" min={0} max={Math.max(200,marketBuy,marketSell)} step={1} value={inputs[control.key]} onChange={event=>setInputs(old=>({...old,[control.key]:Number(event.target.value)}))} aria-valuetext={`${number.format(inputs[control.key])} ${units(inputs[control.key])}`} className="mt-1 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></div>)}
      <div className="min-w-0 sm:col-span-2"><label htmlFor={`${id}-reference`} className="flex flex-wrap justify-between gap-2 text-sm text-ink-700"><span>{referenceLabel}</span><output htmlFor={`${id}-reference`} className="font-mono font-semibold text-ink-900">{money(inputs.referencePrice)}</output></label><input id={`${id}-reference`} type="range" min={prices[0]} max={prices[prices.length-1]} step={0.01} value={inputs.referencePrice} onChange={event=>setInputs(old=>({...old,referencePrice:Number(event.target.value)}))} aria-valuetext={money(inputs.referencePrice)} className="mt-1 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></div>
    </div>
    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3" aria-live="polite" aria-atomic="true">
      <div className="min-w-0"><dt className="text-ink-600">{priceLabel}</dt><dd className="font-mono font-semibold text-ink-900">{selected?money(selected.priceCents/100):noCrossLabel}</dd></div>
      <div className="min-w-0"><dt className="text-ink-600">{matchedLabel}</dt><dd className="font-mono font-semibold text-ink-900">{number.format(selected?.matched??0)} {units(selected?.matched??0)}</dd></div>
      <div className="min-w-0"><dt className="text-ink-600">{imbalanceLabel}</dt><dd className="font-mono font-semibold text-ink-900">{selected?`${signed.format(selected.imbalance)} ${units(selected.imbalance)} · ${selected.imbalance>0?buyExcessLabel:selected.imbalance<0?sellExcessLabel:balancedLabel}`:noPriceImbalanceLabel}</dd></div>
    </dl>
    <ol className="mt-5 grid list-none gap-4 p-0 sm:grid-cols-2" aria-label={chartLabel}>
      {result.candidates.map(row=><li key={row.priceCents} className={cx('min-w-0 rounded-card p-3',selected?.priceCents===row.priceCents?'bg-brand-100/60':'bg-surface')}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-semibold text-ink-900"><span>{money(row.priceCents/100)}</span>{selected?.priceCents===row.priceCents&&<span className="text-xs text-brand-700">{selectedLabel}</span>}</div>
        <dl className="mt-3 space-y-3">{[{label:demandLabel,value:row.demand,color:'var(--color-brand-600)'},{label:supplyLabel,value:row.supply,color:'var(--color-accent-600)'},{label:matchedLabel,value:row.matched,color:'var(--color-ink-800)'}].map(bar=><div key={bar.label}><div className="flex flex-wrap items-baseline justify-between gap-1 text-xs"><dt className="text-ink-700">{bar.label}</dt><dd className="font-mono font-semibold text-ink-900">{number.format(bar.value)}</dd></div><div className="mt-1 h-2 w-full rounded-pill bg-ink-100" aria-hidden="true"><div className="h-full rounded-pill" style={{width:`${bar.value/max*100}%`,backgroundColor:bar.color}} /></div></div>)}</dl>
      </li>)}
    </ol>
    <p className="mt-4 text-sm leading-relaxed text-ink-700">{rulesLabel}</p>
    <details className="mt-3 text-sm"><summary className="w-fit cursor-pointer rounded-sm font-semibold text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">{candidateTableLabel}</summary><div className="mt-3 min-w-0"><table tabIndex={0} aria-label={candidateTableLabel} className={tableClass}><thead><tr>{candidateHeaders.map(label=><th key={label} scope="col" className="whitespace-nowrap px-2 py-2 font-semibold text-ink-700">{label}</th>)}</tr></thead><tbody>{result.candidates.map(row=><tr key={row.priceCents}><th scope="row" className="whitespace-nowrap px-2 py-2 font-medium text-ink-900">{money(row.priceCents/100)}{selected?.priceCents===row.priceCents&&<span className="sr-only"> {selectedLabel}</span>}</th>{[row.demand,row.supply,row.matched,row.imbalance].map((value,index)=><td key={index} className="whitespace-nowrap px-2 py-2 font-mono text-ink-800">{index===3?signed.format(value):number.format(value)}</td>)}</tr>)}</tbody></table></div></details>
    <details className="mt-3 text-sm"><summary className="w-fit cursor-pointer rounded-sm font-semibold text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">{ordersLabel}</summary><div className="mt-3 min-w-0"><table tabIndex={0} aria-label={ordersLabel} className={tableClass}><thead><tr>{orderHeaders.map(label=><th key={label} scope="col" className="whitespace-nowrap px-2 py-2 font-semibold text-ink-700">{label}</th>)}</tr></thead><tbody>{buyOrders.length+sellOrders.length===0?<tr><td colSpan={3} className="px-2 py-2 text-ink-700">{noOrdersLabel}</td></tr>:[{side:buyLabel,orders:buyOrders},{side:sellLabel,orders:sellOrders}].flatMap(({side,orders})=>orders.map((order,index)=><tr key={`${side}-${index}`}><th scope="row" className="whitespace-nowrap px-2 py-2 font-medium text-ink-900">{side}</th><td className="whitespace-nowrap px-2 py-2 font-mono text-ink-800">{money(order.price)}</td><td className="whitespace-nowrap px-2 py-2 font-mono text-ink-800">{number.format(order.quantity)}</td></tr>))}</tbody></table></div></details>
    <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
  </figure>;
}
export default CallAuctionClearing;
