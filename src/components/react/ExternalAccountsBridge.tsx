import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface BopInputs {
  exports: number;
  imports: number;
  earnedIncome: number;
  transfers: number;
  capital: number;
  assets: number;
  liabilities: number;
}
const supported = (value: number) => Number.isSafeInteger(value) && Math.abs(value) <= 1000;
export function calculateBopAccounts(input: BopInputs) {
  if (Object.values(input).length !== 7 || Object.values(input).some(value => !supported(value)) || input.exports < 0 || input.imports < 0) {
    throw new Error('BopAccountBridge: provide all seven finite integer flows within −1,000 to 1,000, with nonnegative exports and imports.');
  }
  const trade = input.exports - input.imports;
  const current = trade + input.earnedIncome + input.transfers;
  const resources = current + input.capital;
  const financial = input.assets - input.liabilities;
  const discrepancy = financial - resources;
  return { trade, current, resources, financial, discrepancy, netInward: -financial };
}
interface Bar { label: string; value: number }
function SignedBars({ rows, negativeLabel, positiveLabel, chartLabel, locale }: { rows: Bar[]; negativeLabel: string; positiveLabel: string; chartLabel: string; locale: string }) {
  const maximum = Math.max(1, ...rows.map(row => Math.abs(row.value)));
  const format = (value: number) => new Intl.NumberFormat(locale, { signDisplay: 'exceptZero' }).format(value);
  return <div className="mt-4 min-w-0" role="group" aria-label={chartLabel}>
    <div className="mb-3 flex justify-between gap-4 text-xs text-ink-600"><span>{negativeLabel}</span><span className="text-right">{positiveLabel}</span></div>
    <dl className="space-y-4">{rows.map(row => <div key={row.label} className="min-w-0">
      <div className="mb-1 flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm"><dt className="text-ink-700">{row.label}</dt><dd className="font-mono font-semibold text-ink-900">{format(row.value)}</dd></div>
      <div className="relative h-5 rounded-sm bg-surface" aria-hidden="true"><span className="absolute inset-y-0 left-1/2 w-px bg-ink-400" /><span className={cx('absolute inset-y-1 rounded-sm', row.value < 0 ? 'bg-accent-600' : 'bg-brand-600')} style={{ left: row.value < 0 ? `${50 - Math.abs(row.value) / maximum * 50}%` : '50%', width: `${Math.abs(row.value) / maximum * 50}%` }} /></div>
    </div>)}</dl>
  </div>;
}
export interface BopAccountBridgeProps extends Partial<BopInputs> {
  view?: 'current' | 'financial' | 'reconciliation';
  title?: string;
  unitsLabel?: string;
  exportsLabel?: string;
  importsLabel?: string;
  earnedLabel?: string;
  transfersLabel?: string;
  capitalLabel?: string;
  assetsLabel?: string;
  liabilitiesLabel?: string;
  tradeLabel?: string;
  currentLabel?: string;
  resourcesLabel?: string;
  minusLiabilitiesLabel?: string;
  financialLabel?: string;
  discrepancyLabel?: string;
  netInwardLabel?: string;
  negativeLabel?: string;
  positiveLabel?: string;
  chartLabel?: string;
  balancedLabel?: string;
  unbalancedLabel?: string;
  identityLabel?: string;
  caption?: string;
  locale?: string;
  className?: string;
}
export function BopAccountBridge({ exports: exportsFlow = 120, imports = 150, earnedIncome = -4, transfers = 4, capital = 2, assets = 12, liabilities = 40, view = 'reconciliation', title = 'Reconcile the external accounts', unitsLabel = 'Invented flows in millions, for one economy and one year.', exportsLabel = 'Exports of goods and services', importsLabel = 'Imports of goods and services', earnedLabel = 'Net earned income', transfersLabel = 'Net current transfers', capitalLabel = 'Capital account balance', assetsLabel = 'Net acquisition of external financial assets, A', liabilitiesLabel = 'Net incurrence of external liabilities, L', tradeLabel = 'Trade balance', currentLabel = 'Current account balance, CA', resourcesLabel = 'Current plus capital balance, CA + KA', minusLiabilitiesLabel = 'Subtract net incurrence of liabilities, −L', financialLabel = 'Financial account balance, FA = A − L', discrepancyLabel = 'Statistical discrepancy, E = FA − (CA + KA)', netInwardLabel = 'Opposite-sign net inward financing, L − A', negativeLabel = 'Negative value', positiveLabel = 'Positive value', chartLabel = 'Signed account balances on a common scale, with zero at the centre.', balancedLabel = 'The two observed measures agree in this example.', unbalancedLabel = 'The observed measures differ. The residual is shown explicitly; no input is silently changed.', identityLabel = 'CA + KA + E = FA: {current} + {capital} + {error} = {financial}', caption = 'The financial account uses acquisition of assets minus incurrence of liabilities. Positive assets and positive liabilities are increases due to transactions; either may be negative when disposals or repayments dominate. The inputs are independent observations. Changing one alone may create a statistical discrepancy; this is an accounting illustration, not a causal forecast or an automatic financing mechanism.', locale = 'en-US', className }: BopAccountBridgeProps) {
  const initial = { exports: exportsFlow, imports, earnedIncome, transfers, capital, assets, liabilities };
  calculateBopAccounts(initial);
  if (!['current', 'financial', 'reconciliation'].includes(view)) throw new Error('BopAccountBridge: choose current, financial or reconciliation view.');
  const id = useId();
  const [input, setInput] = useState(initial);
  const result = calculateBopAccounts(input);
  const format = (value: number) => new Intl.NumberFormat(locale, { signDisplay: 'exceptZero' }).format(value);
  const all = [
    { key: 'exports' as const, label: exportsLabel, min: 0, max: 300 },
    { key: 'imports' as const, label: importsLabel, min: 0, max: 300 },
    { key: 'earnedIncome' as const, label: earnedLabel, min: -100, max: 100 },
    { key: 'transfers' as const, label: transfersLabel, min: -100, max: 100 },
    { key: 'capital' as const, label: capitalLabel, min: -100, max: 100 },
    { key: 'assets' as const, label: assetsLabel, min: -200, max: 200 },
    { key: 'liabilities' as const, label: liabilitiesLabel, min: -200, max: 200 },
  ];
  const controls = all.filter(control => view === 'reconciliation' || (view === 'current' ? ['exports', 'imports', 'earnedIncome', 'transfers'].includes(control.key) : ['assets', 'liabilities'].includes(control.key)));
  const rows = view === 'current' ? [{ label: tradeLabel, value: result.trade }, { label: earnedLabel, value: input.earnedIncome }, { label: transfersLabel, value: input.transfers }, { label: currentLabel, value: result.current }] : view === 'financial' ? [{ label: assetsLabel, value: input.assets }, { label: minusLiabilitiesLabel, value: -input.liabilities }, { label: financialLabel, value: result.financial }] : [{ label: resourcesLabel, value: result.resources }, { label: discrepancyLabel, value: result.discrepancy }, { label: financialLabel, value: result.financial }];
  return <figure className={cx('not-prose my-6 min-w-0 rounded-card bg-surface-sunken/50 p-5', className)}>
    <figcaption className="font-display font-semibold text-ink-900">{title}</figcaption><p className="mt-3 text-sm text-ink-700">{unitsLabel}</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">{controls.map(control => <div key={control.key} className="min-w-0"><label htmlFor={`${id}-${control.key}`} className="block text-sm text-ink-700">{control.label}<output htmlFor={`${id}-${control.key}`} className="mt-1 block font-mono font-semibold">{format(input[control.key])}</output></label><input id={`${id}-${control.key}`} type="range" min={Math.min(control.min, initial[control.key])} max={Math.max(control.max, initial[control.key])} step={1} value={input[control.key]} aria-valuetext={format(input[control.key])} onChange={event => setInput(previous => ({ ...previous, [control.key]: Number(event.target.value) }))} className="mt-1 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></div>)}</div>
    <div aria-live="polite" aria-atomic="true"><SignedBars rows={rows} negativeLabel={negativeLabel} positiveLabel={positiveLabel} chartLabel={chartLabel} locale={locale} />{view === 'reconciliation' && <><p className="mt-4 rounded-card bg-surface p-3 font-mono text-sm text-ink-900">{identityLabel.replaceAll('{current}', format(result.current)).replaceAll('{capital}', format(input.capital)).replaceAll('{error}', format(result.discrepancy)).replaceAll('{financial}', format(result.financial))}</p><p className="mt-3 text-sm text-ink-700">{result.discrepancy === 0 ? balancedLabel : unbalancedLabel}</p></>}{view === 'financial' && <p className="mt-4 text-sm text-ink-700">{netInwardLabel}: <span className="font-mono font-semibold">{format(result.netInward)}</span></p>}</div>
    <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
  </figure>;
}
export interface ExternalPositionInputs { opening: number; transactions: number; valuation: number; other: number }
export function calculateExternalPosition(input: ExternalPositionInputs) {
  if (Object.values(input).length !== 4 || Object.values(input).some(value => !supported(value))) throw new Error('ExternalPositionBridge: provide four finite integer amounts within −1,000 to 1,000 in the same valuation currency.');
  return { closing: input.opening + input.transactions + input.valuation + input.other, change: input.transactions + input.valuation + input.other };
}
export interface ExternalPositionBridgeProps extends Partial<ExternalPositionInputs> { title?: string; unitsLabel?: string; openingLabel?: string; transactionsLabel?: string; valuationLabel?: string; otherLabel?: string; closingLabel?: string; changeLabel?: string; negativeLabel?: string; positiveLabel?: string; chartLabel?: string; caption?: string; locale?: string; className?: string }
export function ExternalPositionBridge({ opening = -100, transactions = -28, valuation = 10, other = -2, title = 'A flow is only part of the change in a position', unitsLabel = 'Invented net external positions and changes, in millions of the same currency.', openingLabel = 'Opening net international investment position', transactionsLabel = 'Financial account transactions, FA', valuationLabel = 'Net exchange-rate and other price effects', otherLabel = 'Other net volume changes', closingLabel = 'Closing net international investment position', changeLabel = 'Total change in the net position', negativeLabel = 'Negative value', positiveLabel = 'Positive value', chartLabel = 'Opening and closing net positions, and the three signed components of their change, on one scale.', caption = 'The net position is external financial assets minus external liabilities, not total national wealth or external debt alone. Transactions, valuation effects and other volume changes are separate. Changing asset prices or exchange rates can alter the closing position without a balance-of-payments transaction. This bridge does not identify a cause or predict a currency move.', locale = 'en-US', className }: ExternalPositionBridgeProps) {
  const initial = { opening, transactions, valuation, other };
  calculateExternalPosition(initial);
  const id = useId(), [input, setInput] = useState(initial), result = calculateExternalPosition(input);
  const format = (value: number) => new Intl.NumberFormat(locale, { signDisplay: 'exceptZero' }).format(value);
  const controls = [{ key: 'opening' as const, label: openingLabel, min: -300, max: 300 }, { key: 'transactions' as const, label: transactionsLabel, min: -100, max: 100 }, { key: 'valuation' as const, label: valuationLabel, min: -100, max: 100 }, { key: 'other' as const, label: otherLabel, min: -50, max: 50 }];
  const rows = [...controls.map(control => ({ label: control.label, value: input[control.key] })), { label: closingLabel, value: result.closing }];
  return <figure className={cx('not-prose my-6 min-w-0 rounded-card bg-surface-sunken/50 p-5', className)}><figcaption className="font-display font-semibold text-ink-900">{title}</figcaption><p className="mt-3 text-sm text-ink-700">{unitsLabel}</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{controls.map(control => <div key={control.key} className="min-w-0"><label htmlFor={`${id}-${control.key}`} className="block text-sm text-ink-700">{control.label}<output htmlFor={`${id}-${control.key}`} className="mt-1 block font-mono font-semibold">{format(input[control.key])}</output></label><input id={`${id}-${control.key}`} type="range" min={Math.min(control.min, initial[control.key])} max={Math.max(control.max, initial[control.key])} step={1} value={input[control.key]} aria-valuetext={format(input[control.key])} onChange={event => setInput(previous => ({ ...previous, [control.key]: Number(event.target.value) }))} className="mt-1 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></div>)}</div><div aria-live="polite" aria-atomic="true"><SignedBars rows={rows} negativeLabel={negativeLabel} positiveLabel={positiveLabel} chartLabel={chartLabel} locale={locale} /><p className="mt-4 text-sm text-ink-700">{changeLabel}: <span className="font-mono font-semibold">{format(result.change)}</span></p></div><p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p></figure>;
}
