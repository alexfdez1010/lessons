import { useId, useState } from 'react';

export type ImpactCostMode = 'measurement' | 'scale' | 'horizon' | 'decay' | 'slicing' | 'rate' | 'capacity';
const modes: ImpactCostMode[] = ['measurement', 'scale', 'horizon', 'decay', 'slicing', 'rate', 'capacity'];
function positive(values: number[]) {
  if (!values.every(x => Number.isFinite(x) && x > 0 && x <= 1e12)) throw Error('Impact model inputs must be positive finite values no greater than 1e12.');
}
/** A stipulated cumulative fill-impact path; not an empirical guarantee or an observed causal estimate. */
export function squareRootImpact(quantity: number, volume = 1e6, sigma = .02, coefficient = 1) {
  positive([volume, sigma, coefficient]);
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1e12) throw Error('Impact quantity must be finite and nonnegative, no greater than 1e12.');
  return coefficient * sigma * Math.sqrt(quantity / volume);
}
export function cumulativeImpactCost(quantity: number, volume = 1e6, price = 100, sigma = .02, coefficient = 1) {
  positive([price]);
  const result = price * quantity * (2 / 3) * squareRootImpact(quantity, volume, sigma, coefficient);
  if (!Number.isFinite(result)) throw Error('Impact cash cost exceeds the finite numerical domain.');
  return result;
}
export function impactSegmentCost(start: number, end: number, volume = 1e6, price = 100) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) throw Error('Impact segment needs ordered nonnegative cumulative quantities.');
  return cumulativeImpactCost(end, volume, price) - cumulativeImpactCost(start, volume, price);
}
export function signedExecutionCost(side: 'buy' | 'sell', price: number, average: number, terminal: number, quantity: number) {
  if (!['buy', 'sell'].includes(side)) throw Error('Execution side must be buy or sell.');
  positive([price, average, terminal, quantity]);
  const sign = side === 'buy' ? 1 : -1;
  return { averageReturn: sign * (average - price) / price, completionReturn: sign * (terminal - price) / price, cash: sign * quantity * (average - price) };
}
/** Stipulated response curve: its persistent component is an assumption, not inferred causation. */
export function illustrativeImpactDecay(minutes: number, residual: number, halfLife: number) {
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1e6 || !Number.isFinite(residual) || residual < 0 || residual > 60) throw Error('Decay needs a nonnegative time and a residual between 0 and 60 basis points.');
  positive([halfLife]);
  return residual + (60 - residual) * 2 ** (-minutes / halfLife);
}
export function rateImpactCost(quantity: number, minutes: number, eta = .001) {
  positive([quantity, minutes, eta]);
  const rate = quantity / minutes;
  return { rate, concession: eta * rate, cash: eta * rate * rate * minutes };
}
export function impactCapacity(edgeBps: number, otherBps: number, sigma = .02, coefficient = 1) {
  if (![edgeBps, otherBps].every(x => Number.isFinite(x) && x >= 0 && x <= 1000)) throw Error('Capacity edge and other cost must be finite nonnegative basis points, no greater than 1000.');
  positive([sigma, coefficient]);
  const available = Math.max(0, (edgeBps - otherBps) / 1e4), kappa = (2 / 3) * coefficient * sigma;
  return { breakEvenFraction: (available / kappa) ** 2, profitFraction: (2 * available / (3 * kappa)) ** 2 };
}

const defaults = {
  title: 'State the impact measurement and the model',
  side: 'Trade direction', buy: 'Buy', sell: 'Sell', averageControl: 'Signed average fill slippage (basis points)', endControl: 'Signed completion price move (basis points)',
  order: 'Parent order as a percentage of daily volume', window: 'Market volume during execution as a percentage of daily volume', persistent: 'Assumed persistent response (basis points)', elapsed: 'Minutes since completion', halfLife: 'Assumed transient half-life (minutes)', batches: 'Equal batches or accounting labels', delay: 'Assumed waiting charge per extra batch (basis points)', duration: 'Actual trading duration (minutes)', edge: 'Assumed gross edge per traded unit (basis points)', other: 'Other one-way costs (basis points)',
  quantity: 'Quantity', value: 'Value', table: 'Exact rounded model values', chart: 'The selected illustrative relationship; exact rounded values are in the following table.',
  arrival: 'Arrival benchmark (USD per share)', average: 'Average fill price (USD per share)', completion: 'Completion reference price (USD per share)', averageBps: 'Signed average execution cost (basis points)', completionBps: 'Signed completion move (basis points)', cash: 'Execution cost (USD)', shares: 'Order quantity (shares)', peak: 'Completion impact under the square-root path (basis points)', mean: 'Average fill impact under that path (basis points)', participation: 'Participation in market volume during execution (%)', marketVolume: 'Market volume during execution (shares)', dailyVolume: 'Daily volume denominator (shares)', response: 'Assumed response at the selected time (basis points)', residual: 'Assumed limiting response (basis points)', decayed: 'Response already decayed (basis points)', connected: 'Same cumulative path: average impact (basis points)', reset: 'Full reset between batches: average impact (basis points)', charged: 'Reset impact plus assumed waiting charge (basis points)', chargedCash: 'Reset impact plus waiting charge (USD)', rate: 'Trading rate (shares per minute)', concession: 'Temporary price concession (USD per share)', rateCash: 'Temporary execution cost (USD)', labelDuration: 'Duration per accounting interval (minutes)', labelShares: 'Shares per accounting interval', breakEven: 'Average-cost break-even size (% of daily volume)', profitSize: 'Expected-dollar-profit optimum (% of daily volume)', net: 'Selected expected net edge (basis points)', netCash: 'Selected expected net profit (USD)',
  xOrder: 'Cumulative or selected order size (% of daily volume)', yBps: 'Signed move or cost (basis points)', xTime: 'Minutes after completion', yResponse: 'Assumed response (basis points)', xDuration: 'Actual trading duration (minutes)', yCash: 'Execution cost (USD)', peakLegend: 'Completion impact path', meanLegend: 'Average fill impact', netLegend: 'Expected net edge', decayLegend: 'Assumed post-trade response', rateLegend: 'Fixed quantity: cost falls as actual duration increases',
  caption: 'Invented example. Daily volume 1,000,000 shares, arrival price 100 USD and daily return volatility 2%. For scale, slicing and capacity, the separately stipulated fill-impact path is I(q)=0.02 sqrt(q/V), so average impact is two thirds of completion impact. That path is not implied by an empirical endpoint fit. No spread, fees, drift or credit effects unless explicitly included. No predicted execution or guaranteed profitability.'
};
export type ImpactCostLabels = typeof defaults;
export interface ImpactCostLabProps { mode?: ImpactCostMode; orderPercent?: number; locale?: string; labels?: Partial<ImpactCostLabels>; }
const rangeClass = 'block h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
const selectClass = 'mt-2 block w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
const tableClass = 'block w-full max-w-full overflow-x-auto text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
const cellClass = 'px-3 py-2 text-left align-top';
// Round presentation coordinates only, for stable SVG and CSS serialization across render engines.
const draw = (value: number) => Math.round(value * 1000) / 1000;

function Plot({ curves, maxX, minX = 0, selectedX, minY, maxY, xLabel, yLabel, chart, n }: { curves: { label: string; color: string; values: [number, number][] }[]; maxX: number; minX?: number; selectedX?: number; minY: number; maxY: number; xLabel: string; yLabel: string; chart: string; n: (x: number) => string }) {
  const x = (v: number) => draw(20 + 560 * (v - minX) / (maxX - minX)), y = (v: number) => draw(208 - 196 * (v - minY) / (maxY - minY));
  return <div className="my-4"><p className="mb-2 text-sm font-medium">{yLabel}</p><div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2"><div className="relative h-56 text-right font-mono text-sm">{[maxY,minY].map(v=><span key={v} className="absolute right-0 -translate-y-1/2" style={{top:draw(y(v)/2.2)+'%'}}>{n(v)}</span>)}</div><div><svg viewBox="0 0 600 220" className="h-56 w-full" preserveAspectRatio="none" role="img" aria-label={chart}>{selectedX !== undefined && <line x1={x(selectedX)} x2={x(selectedX)} y1={12} y2={208} stroke="var(--color-ink-400)" strokeDasharray="3 4"/>}{minY < 0 && <line x1={20} x2={580} y1={y(0)} y2={y(0)} stroke="var(--color-ink-400)" strokeDasharray="4 4"/>}{curves.map(c => <path key={c.label} d={c.values.map(([a,b],i) => `${i ? 'L' : 'M'} ${x(a)} ${y(b)}`).join(' ')} fill="none" stroke={c.color} strokeWidth={3} vectorEffect="non-scaling-stroke"/>)}</svg><div className="relative h-6 font-mono text-sm">{[minX, (minX + maxX) / 2, maxX].map(v => <span key={v} className="absolute -translate-x-1/2" style={{ left: draw(x(v) / 6) + '%' }}>{n(v)}</span>)}</div></div></div><p className="text-center text-sm">{xLabel}</p><div className="mt-3 grid gap-2 text-sm">{curves.map(c => <span key={c.label}><span className="mr-2 inline-block h-1 w-6 align-middle" style={{ backgroundColor: c.color }}/>{c.label}</span>)}</div></div>;
}

export function ImpactCostLab({ mode = 'scale', orderPercent = 10, locale = 'en-US', labels = {} }: ImpactCostLabProps) {
  if (!modes.includes(mode) || !Number.isFinite(orderPercent) || orderPercent < .25 || orderPercent > 30 || orderPercent * 4 % 1 !== 0 || (mode !== 'capacity' && !Number.isInteger(orderPercent))) throw Error('ImpactCostLab needs a declared mode and order percentage 1–30 in whole units, or 0.25–30 in quarter units for capacity.');
  if (mode === 'horizon' && orderPercent > 20) throw Error('The horizon example initially has total market volume equal to 20% of daily volume; its order cannot exceed that volume.');
  if (Object.values(labels).some(v => typeof v !== 'string' || !v.trim())) throw Error('ImpactCostLab labels must be nonempty localized strings.');
  const id = useId(), [order, setOrder] = useState(orderPercent), [side, setSide] = useState<'buy'|'sell'>('buy'), [fill, setFill] = useState(40), [end, setEnd] = useState(60), [window, setWindow] = useState(20), [persistent, setPersistent] = useState(20), [minutes, setMinutes] = useState(60), [half, setHalf] = useState(30), [batches, setBatches] = useState(4), [delay, setDelay] = useState(10), [duration, setDuration] = useState(2), [edge, setEdge] = useState(30), [other, setOther] = useState(5);
  const l = { ...defaults, ...labels }, n = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(v), quantity = order * 1e4, impact = squareRootImpact(quantity), averageImpact = (2 / 3) * impact, cash = cumulativeImpactCost(quantity), rows: [string, number][] = [];
  const control = (key: string, title: string, value: number, min: number, max: number, step: number, set: (v: number) => void) => <label key={key} htmlFor={id+key} className="mt-3 block text-sm">{title}: <span className="font-mono">{n(value)}</span><input id={id+key} type="range" min={min} max={max} step={step} value={value} onChange={e => set(+e.target.value)} className={rangeClass}/></label>;
  const choice = (key: string, title: string, value: number, values: number[], set: (v: number) => void) => <label key={key} htmlFor={id+key} className="mt-3 block text-sm">{title}<select id={id+key} value={value} onChange={e => set(+e.target.value)} className={selectClass}>{values.map(v => <option key={v} value={v}>{n(v)}</option>)}</select></label>;
  let controls: React.ReactNode, plot: React.ReactNode;
  const curve = (fn: (v: number) => number, maxX: number, count = 120): [number, number][] => Array.from({ length: count+1 }, (_,i) => { const v = maxX*i/count; return [v,fn(v)]; });
  if (mode === 'measurement') {
    const sign = side === 'buy' ? 1 : -1, average = 100 * (1 + sign * fill / 1e4), terminal = 100 * (1 + sign * end / 1e4), z = signedExecutionCost(side, 100, average, terminal, 100000);
    controls = <><label htmlFor={id+'side'} className="mt-3 block text-sm">{l.side}<select id={id+'side'} className={selectClass} value={side} onChange={e => setSide(e.target.value as 'buy'|'sell')}><option value="buy">{l.buy}</option><option value="sell">{l.sell}</option></select></label>{control('fill',l.averageControl,fill,-100,100,5,setFill)}{control('end',l.endControl,end,-100,120,5,setEnd)}</>;
    rows.push([l.arrival,100],[l.average,average],[l.completion,terminal],[l.averageBps,z.averageReturn*1e4],[l.completionBps,z.completionReturn*1e4],[l.cash,z.cash]);
  } else if (mode === 'scale') {
    controls = control('order',l.order,order,1,30,1,setOrder); rows.push([l.shares,quantity],[l.peak,impact*1e4],[l.mean,averageImpact*1e4],[l.cash,cash]);
    plot = <Plot curves={[{label:l.peakLegend,color:'var(--color-brand-600)',values:curve(x => squareRootImpact(x*1e4)*1e4,30)},{label:l.meanLegend,color:'var(--color-accent-600)',values:curve(x => (2/3)*squareRootImpact(x*1e4)*1e4,30)}]} maxX={30} selectedX={order} minY={0} maxY={120} xLabel={l.xOrder} yLabel={l.yBps} chart={l.chart} n={n}/>;
  } else if (mode === 'horizon') {
    controls = <>{control('order',l.order,order,1,Math.min(30,window),1,setOrder)}{control('window',l.window,window,Math.ceil(order/10)*10,100,10,setWindow)}</>;
    rows.push([l.shares,quantity],[l.dailyVolume,1e6],[l.marketVolume,window*1e4],[l.participation,100*quantity/(window*1e4)]);
  } else if (mode === 'decay') {
    controls = <>{control('persistent',l.persistent,persistent,0,60,5,setPersistent)}{control('minutes',l.elapsed,minutes,0,240,15,setMinutes)}{choice('half',l.halfLife,half,[15,30,60],setHalf)}</>;
    const response = illustrativeImpactDecay(minutes,persistent,half); rows.push([l.response,response],[l.residual,persistent],[l.decayed,60-response]);
    plot = <Plot curves={[{label:l.decayLegend,color:'var(--color-brand-600)',values:curve(t => illustrativeImpactDecay(t,persistent,half),240)}]} maxX={240} selectedX={minutes} minY={0} maxY={60} xLabel={l.xTime} yLabel={l.yResponse} chart={l.chart} n={n}/>;
  } else if (mode === 'slicing') {
    controls = <>{choice('batches',l.batches,batches,[1,2,4,10],setBatches)}{control('delay',l.delay,delay,0,20,1,setDelay)}</>;
    const meanBps = (2/3)*squareRootImpact(100000)*1e4, reset = meanBps/Math.sqrt(batches), charged = reset + (batches-1)*delay;
    rows.push([l.connected,meanBps],[l.reset,reset],[l.charged,charged],[l.chargedCash,100*100000*charged/1e4]);
  } else if (mode === 'rate') {
    controls = <>{control('duration',l.duration,duration,1,10,1,setDuration)}{choice('labels',l.batches,batches,[1,2,4,10],setBatches)}</>;
    const z = rateImpactCost(100,duration);rows.push([l.rate,z.rate],[l.concession,z.concession],[l.rateCash,z.cash],[l.labelDuration,duration/batches],[l.labelShares,100/batches]);
    plot = <Plot curves={[{label:l.rateLegend,color:'var(--color-brand-600)',values:Array.from({length:121},(_,i) => {const t=1+9*i/120;return [t,rateImpactCost(100,t).cash] as [number,number];})}]} maxX={10} minX={1} selectedX={duration} minY={0} maxY={10} xLabel={l.xDuration} yLabel={l.yCash} chart={l.chart} n={n}/>;
  } else {
    controls = <>{control('edge',l.edge,edge,0,60,1,setEdge)}{control('other',l.other,other,0,20,1,setOther)}{control('order',l.order,order,.25,30,.25,setOrder)}</>;
    const z = impactCapacity(edge,other), net = edge-other-averageImpact*1e4;
    rows.push([l.breakEven,z.breakEvenFraction*100],[l.profitSize,z.profitFraction*100],[l.net,net],[l.netCash,100*quantity*net/1e4]);
    plot = <Plot curves={[{label:l.netLegend,color:'var(--color-brand-600)',values:curve(x => edge-other-(2/3)*squareRootImpact(x*1e4)*1e4,30)}]} maxX={30} selectedX={order} minY={Math.floor((edge-other-(2/3)*squareRootImpact(300000)*1e4)/10)*10} maxY={Math.max(10,edge-other)} xLabel={l.xOrder} yLabel={l.yBps} chart={l.chart} n={n}/>;
  }
  const bars = ['measurement','horizon','slicing'].includes(mode);
  const chartRows = mode === 'measurement' ? rows.slice(3,5) : mode === 'horizon' ? [[l.order,order],[l.participation,100*quantity/(window*1e4)]] as [string,number][] : rows.slice(0,3);
  const maxBar = Math.max(1,...chartRows.map(x => Math.abs(x[1])));
  return <figure className="not-prose my-6 rounded-card bg-surface p-4 shadow-soft"><figcaption className="font-display text-lg font-semibold">{l.title}</figcaption>{controls}<dl className="my-4 grid gap-2 text-sm sm:grid-cols-2" aria-live="polite">{rows.map(([label,value]) => <div key={label} className="rounded-card bg-surface-sunken p-3"><dt>{label}</dt><dd className="mt-1 font-mono">{n(value)}</dd></div>)}</dl>{plot}{bars && <div role="img" aria-label={l.chart} className="my-4">{chartRows.map(([label,value]) => <div key={label} className="my-3"><p className="mb-1 text-sm">{label}: <span className="font-mono">{n(value)}</span></p><div className="h-4 bg-surface-sunken"><div className={'h-4 '+(value<0?'bg-accent-600':'bg-brand-600')} style={{width:draw(100*Math.abs(value)/maxBar)+'%'}}/></div></div>)}</div>}<table tabIndex={0} aria-label={l.table} className={tableClass}><thead><tr><th className={cellClass}>{l.quantity}</th><th className={cellClass}>{l.value}</th></tr></thead><tbody>{rows.map(([label,value]) => <tr key={label}><th scope="row" className={cellClass}>{label}</th><td className={cellClass}>{n(value)}</td></tr>)}</tbody></table><p className="mt-3 text-sm leading-relaxed text-ink-700">{l.caption}</p></figure>;
}
