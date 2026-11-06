import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A hypothetical securities loan with no intervening collateral top-up. */
export interface LendingCollateralInputs {
  /** Initial market value of the lent securities, strictly positive. */
  initialLoan: number;
  /** Initial realizable collateral value, zero or positive. */
  initialCollateral: number;
  /** Return on the lent securities, from -90% to 100%. */
  loanReturn: number;
  /** Return on the collateral, from -100% to 100%. */
  collateralReturn: number;
}

export interface LendingCollateralResult {
  replacementCost: number;
  collateralRealizable: number;
  initialCoverage: number;
  currentCoverage: number;
  shortfall: number;
  surplus: number;
}

/** Values a conditional default scenario, not its probability or fee income. */
export function calculateLendingCollateral({
  initialLoan, initialCollateral, loanReturn, collateralReturn,
}: LendingCollateralInputs): LendingCollateralResult {
  if (!Number.isFinite(initialLoan) || initialLoan <= 0 || initialLoan > 1e12 ||
      !Number.isFinite(initialCollateral) || initialCollateral < 0 || initialCollateral > 1e12) {
    throw new Error('SecuritiesLendingCollateral: initialLoan must be positive and initialCollateral nonnegative; both must be finite and at most one trillion.');
  }
  if (!Number.isFinite(loanReturn) || loanReturn < -0.9 || loanReturn > 1 ||
      !Number.isFinite(collateralReturn) || collateralReturn < -1 || collateralReturn > 1) {
    throw new Error('SecuritiesLendingCollateral: loanReturn must be from -90% to 100% and collateralReturn from -100% to 100%.');
  }
  const replacementCost = initialLoan * (1 + loanReturn);
  const collateralRealizable = initialCollateral * (1 + collateralReturn);
  const initialCoverage = initialCollateral / initialLoan;
  const currentCoverage = collateralRealizable / replacementCost;
  const difference = replacementCost - collateralRealizable;
  const result = {
    replacementCost, collateralRealizable, initialCoverage, currentCoverage,
    shortfall: Math.max(difference, 0), surplus: Math.max(-difference, 0),
  };
  if (replacementCost <= 0 || !Object.values(result).every(Number.isFinite)) {
    throw new Error('SecuritiesLendingCollateral: derived values must be finite, with positive replacementCost.');
  }
  return result;
}

export interface SecuritiesLendingCollateralProps extends Partial<LendingCollateralInputs> {
  title?: string;
  loanReturnLabel?: string;
  collateralReturnLabel?: string;
  replacementLabel?: string;
  collateralLabel?: string;
  initialCoverageLabel?: string;
  currentCoverageLabel?: string;
  shortfallLabel?: string;
  surplusLabel?: string;
  /** Explains that the result is conditional on default and excludes other recovery. */
  scopeLabel?: string;
  /** Accessible graphic name, with {replacement}, {collateral}, {shortfall} tokens. */
  chartLabel?: string;
  tableLabel?: string;
  measureLabel?: string;
  initialLabel?: string;
  currentLabel?: string;
  coverageLabel?: string;
  currency?: string;
  locale?: string;
  className?: string;
}

/** Compare replacement cost with collateral after independently chosen price moves.
 * The two bars share a scale; no default probability or lending fee is calculated.
 * Exact values render without hydration. Only bar transforms transition, and the
 * reduced-motion utility removes that transition without changing any results.
 */
export function SecuritiesLendingCollateral({
  initialLoan = 50, initialCollateral = 51, loanReturn = 0.1, collateralReturn = -0.2,
  title = 'Collateral can fall while replacement cost rises',
  loanReturnLabel = 'Price change of the lent securities',
  collateralReturnLabel = 'Price change of the noncash collateral',
  replacementLabel = 'Cost to replace the lent securities',
  collateralLabel = 'Realizable collateral value',
  initialCoverageLabel = 'Initial collateral coverage',
  currentCoverageLabel = 'Coverage at the selected prices',
  shortfallLabel = 'Replacement shortfall if the borrower defaults now',
  surplusLabel = 'Collateral above replacement cost',
  scopeLabel = 'Hypothetical default at the selected prices, with no margin top-up, other recovery or transaction costs. Any excess collateral is not lending income.',
  chartLabel = 'At the selected prices, replacement costs {replacement}, collateral realizes {collateral}, and the conditional replacement shortfall is {shortfall}. The bars share one money scale.',
  tableLabel = 'Initial and selected-price values of the securities loan and collateral',
  measureLabel = 'Measure', initialLabel = 'Initially', currentLabel = 'At selected prices',
  coverageLabel = 'Collateral divided by replacement cost',
  currency = 'USD', locale = 'en-US', className,
}: SecuritiesLendingCollateralProps) {
  // Both authored and derived numerical data fail during SSR if malformed.
  calculateLendingCollateral({ initialLoan, initialCollateral, loanReturn, collateralReturn });
  const id = useId();
  const [selectedLoanReturn, setSelectedLoanReturn] = useState(loanReturn);
  const [selectedCollateralReturn, setSelectedCollateralReturn] = useState(collateralReturn);
  const result = calculateLendingCollateral({
    initialLoan, initialCollateral, loanReturn: selectedLoanReturn, collateralReturn: selectedCollateralReturn,
  });
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 });
  const scale = Math.max(result.replacementCost, result.collateralRealizable);
  const description = chartLabel.replaceAll('{replacement}', money.format(result.replacementCost))
    .replaceAll('{collateral}', money.format(result.collateralRealizable))
    .replaceAll('{shortfall}', money.format(result.shortfall));

  return (
    <section className={cx('not-prose my-6 rounded-card bg-surface p-4 shadow-soft sm:p-6', className)}>
      <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3>
      <p className="mt-2 text-sm text-ink-600">{scopeLabel}</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label htmlFor={id + '-loan'} className="text-sm font-medium text-ink-700">
          {loanReturnLabel}: {percent.format(selectedLoanReturn)}
          <input id={id + '-loan'} type="range" min="-90" max="100" step="1" value={selectedLoanReturn * 100}
            onChange={(event) => setSelectedLoanReturn(Number(event.target.value) / 100)}
            className="mt-2 block w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" />
        </label>
        <label htmlFor={id + '-collateral'} className="text-sm font-medium text-ink-700">
          {collateralReturnLabel}: {percent.format(selectedCollateralReturn)}
          <input id={id + '-collateral'} type="range" min="-100" max="100" step="1" value={selectedCollateralReturn * 100}
            onChange={(event) => setSelectedCollateralReturn(Number(event.target.value) / 100)}
            className="mt-2 block w-full accent-accent-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" />
        </label>
      </div>

      <div role="img" aria-label={description} className="mt-6 space-y-4">
        {[
          { label: replacementLabel, amount: result.replacementCost, color: 'bg-brand-600' },
          { label: collateralLabel, amount: result.collateralRealizable, color: 'bg-accent-600' },
        ].map((row, index) => <div key={index}>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-ink-800">
            <span>{row.label}</span><span className="font-mono tabular-nums">{money.format(row.amount)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-pill bg-ink-100" aria-hidden="true">
            <div className={cx('h-full origin-left transition-transform duration-200 motion-reduce:transition-none', row.color)}
              style={{ transform: 'scaleX(' + row.amount / scale + ')' }} />
          </div>
        </div>)}
        <div className="flex justify-between font-mono text-xs text-ink-600" aria-hidden="true">
          <span>{money.format(0)}</span><span>{money.format(scale)}</span>
        </div>
      </div>

      <dl aria-live="polite" aria-atomic="true" className="mt-5 grid gap-4 rounded-card bg-surface-sunken p-4 text-sm text-ink-800 sm:grid-cols-2">
        <div><dt>{initialCoverageLabel}</dt><dd className="mt-1 font-mono font-semibold">{percent.format(result.initialCoverage)}</dd></div>
        <div><dt>{currentCoverageLabel}</dt><dd className="mt-1 font-mono font-semibold">{percent.format(result.currentCoverage)}</dd></div>
        <div><dt>{shortfallLabel}</dt><dd className="mt-1 font-mono font-semibold">{money.format(result.shortfall)}</dd></div>
        <div><dt>{surplusLabel}</dt><dd className="mt-1 font-mono font-semibold">{money.format(result.surplus)}</dd></div>
      </dl>

      <div className="mt-5">
        <table tabIndex={0} aria-label={tableLabel} className="block w-full max-w-full overflow-x-auto text-left text-sm text-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
          <thead><tr><th scope="col" className="px-3 py-2">{measureLabel}</th><th scope="col" className="px-3 py-2">{initialLabel}</th><th scope="col" className="px-3 py-2">{currentLabel}</th></tr></thead>
          <tbody>
            <tr><th scope="row" className="px-3 py-2 font-medium">{replacementLabel}</th><td className="px-3 py-2 font-mono">{money.format(initialLoan)}</td><td className="px-3 py-2 font-mono">{money.format(result.replacementCost)}</td></tr>
            <tr><th scope="row" className="px-3 py-2 font-medium">{collateralLabel}</th><td className="px-3 py-2 font-mono">{money.format(initialCollateral)}</td><td className="px-3 py-2 font-mono">{money.format(result.collateralRealizable)}</td></tr>
            <tr><th scope="row" className="px-3 py-2 font-medium">{coverageLabel}</th><td className="px-3 py-2 font-mono">{percent.format(result.initialCoverage)}</td><td className="px-3 py-2 font-mono">{percent.format(result.currentCoverage)}</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default SecuritiesLendingCollateral;
