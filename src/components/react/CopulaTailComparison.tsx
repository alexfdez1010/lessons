import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CopulaTailRow { rho:number; nu:number; q:number; gaussian:number; student:number; limit:number; }
/** Precomputed conditional-integral grid; generated with SciPy1.18.1 using two variable transforms.
 * Reproduce with scripts/compute-copula-tail-reference.py.
 * Estimated quadrature errors are diagnostics, not certified mathematical bounds. */
const REFERENCE: readonly CopulaTailRow[] = [{"rho":0,"nu":3,"q":0.1,"gaussian":0.10000000000000007,"student":0.182250087328443,"limit":0.11611652351681556},{"rho":0,"nu":3,"q":0.05,"gaussian":0.04999999999999997,"student":0.1529553892981468,"limit":0.11611652351681556},{"rho":0,"nu":3,"q":0.01,"gaussian":0.009999999999999998,"student":0.12718154065585976,"limit":0.11611652351681556},{"rho":0,"nu":3,"q":0.005,"gaussian":0.004999999999999998,"student":0.12292191803863235,"limit":0.11611652351681556},{"rho":0,"nu":3,"q":0.001,"gaussian":0.0009999999999999998,"student":0.11838311736475846,"limit":0.11611652351681556},{"rho":0,"nu":4,"q":0.1,"gaussian":0.10000000000000007,"student":0.16264795539952215,"limit":0.07558681842161238},{"rho":0,"nu":4,"q":0.05,"gaussian":0.04999999999999997,"student":0.12768966134916263,"limit":0.07558681842161238},{"rho":0,"nu":4,"q":0.01,"gaussian":0.009999999999999998,"student":0.09457846338320117,"limit":0.07558681842161238},{"rho":0,"nu":4,"q":0.005,"gaussian":0.004999999999999998,"student":0.08841918778062016,"limit":0.07558681842161238},{"rho":0,"nu":4,"q":0.001,"gaussian":0.0009999999999999998,"student":0.08099721097249296,"limit":0.07558681842161238},{"rho":0,"nu":10,"q":0.1,"gaussian":0.10000000000000007,"student":0.1253989502064239,"limit":0.006872303308921113},{"rho":0,"nu":10,"q":0.05,"gaussian":0.04999999999999997,"student":0.0803442287277598,"limit":0.006872303308921113},{"rho":0,"nu":10,"q":0.01,"gaussian":0.009999999999999998,"student":0.03728700397030321,"limit":0.006872303308921113},{"rho":0,"nu":10,"q":0.005,"gaussian":0.004999999999999998,"student":0.029190622719245943,"limit":0.006872303308921113},{"rho":0,"nu":10,"q":0.001,"gaussian":0.0009999999999999998,"student":0.018961883276486978,"limit":0.006872303308921113},{"rho":0.25,"nu":3,"q":0.1,"gaussian":0.19333521918903876,"student":0.2787291773104577,"limit":0.19626117814926966},{"rho":0.25,"nu":3,"q":0.05,"gaussian":0.12285729408883439,"student":0.2437724963215013,"limit":0.19626117814926966},{"rho":0.25,"nu":3,"q":0.01,"gaussian":0.04375151261024981,"student":0.21100847935800035,"limit":0.19626117814926966},{"rho":0.25,"nu":3,"q":0.005,"gaussian":0.028205552960476242,"student":0.20538371012510268,"limit":0.19626117814926966},{"rho":0.25,"nu":3,"q":0.001,"gaussian":0.01026329406627987,"student":0.19931856091231337,"limit":0.19626117814926966},{"rho":0.25,"nu":4,"q":0.1,"gaussian":0.19333521918903876,"student":0.2587963289694545,"limit":0.14381080871160384},{"rho":0.25,"nu":4,"q":0.05,"gaussian":0.12285729408883439,"student":0.21595522377858464,"limit":0.14381080871160384},{"rho":0.25,"nu":4,"q":0.01,"gaussian":0.04375151261024981,"student":0.17154154191877283,"limit":0.14381080871160384},{"rho":0.25,"nu":4,"q":0.005,"gaussian":0.028205552960476242,"student":0.16275596387864014,"limit":0.14381080871160384},{"rho":0.25,"nu":4,"q":0.001,"gaussian":0.01026329406627987,"student":0.15191013318125637,"limit":0.14381080871160384},{"rho":0.25,"nu":10,"q":0.1,"gaussian":0.19333521918903876,"student":0.22028128826327417,"limit":0.026094682241525783},{"rho":0.25,"nu":10,"q":0.05,"gaussian":0.12285729408883439,"student":0.16115526982589162,"limit":0.026094682241525783},{"rho":0.25,"nu":10,"q":0.01,"gaussian":0.04375151261024981,"student":0.09303068831931058,"limit":0.026094682241525783},{"rho":0.25,"nu":10,"q":0.005,"gaussian":0.028205552960476242,"student":0.0778162416055121,"limit":0.026094682241525783},{"rho":0.25,"nu":10,"q":0.001,"gaussian":0.01026329406627987,"student":0.05655835962434299,"limit":0.026094682241525783},{"rho":0.5,"nu":3,"q":0.1,"gaussian":0.32401523218344297,"student":0.4023967931801478,"limit":0.3124999999999998},{"rho":0.5,"nu":3,"q":0.05,"gaussian":0.2437885753434995,"student":0.36585946265932123,"limit":0.3124999999999998},{"rho":0.5,"nu":3,"q":0.01,"gaussian":0.12939244182647636,"student":0.329582047853139,"limit":0.3124999999999998},{"rho":0.5,"nu":3,"q":0.005,"gaussian":0.09925916839542911,"student":0.32312631827609867,"limit":0.3124999999999998},{"rho":0.5,"nu":3,"q":0.001,"gaussian":0.054259168194558886,"student":0.3160834107611041,"limit":0.3124999999999998},{"rho":0.5,"nu":4,"q":0.1,"gaussian":0.32401523218344297,"student":0.38422367988290645,"limit":0.25316999510032256},{"rho":0.5,"nu":4,"q":0.05,"gaussian":0.2437885753434995,"student":0.33873921049428823,"limit":0.25316999510032256},{"rho":0.5,"nu":4,"q":0.01,"gaussian":0.12939244182647636,"student":0.28767843485153743,"limit":0.25316999510032256},{"rho":0.5,"nu":4,"q":0.005,"gaussian":0.09925916839542911,"student":0.2769940125201099,"limit":0.25316999510032256},{"rho":0.5,"nu":4,"q":0.001,"gaussian":0.054259168194558886,"student":0.2634931705929499,"limit":0.25316999510032256},{"rho":0.5,"nu":10,"q":0.1,"gaussian":0.32401523218344297,"student":0.3489142708969069,"limit":0.08186423116569436},{"rho":0.5,"nu":10,"q":0.05,"gaussian":0.2437885753434995,"student":0.28381477971483166,"limit":0.08186423116569436},{"rho":0.5,"nu":10,"q":0.01,"gaussian":0.12939244182647636,"student":0.19676066576571608,"limit":0.08186423116569436},{"rho":0.5,"nu":10,"q":0.005,"gaussian":0.09925916839542911,"student":0.17443477961590945,"limit":0.08186423116569436},{"rho":0.5,"nu":10,"q":0.001,"gaussian":0.054259168194558886,"student":0.1403718958393239,"limit":0.08186423116569436},{"rho":0.75,"nu":3,"q":0.1,"gaussian":0.5124285247369056,"student":0.5724024973011302,"limit":0.49176700102216886},{"rho":0.75,"nu":3,"q":0.05,"gaussian":0.440194973299389,"student":0.5409210529216857,"limit":0.49176700102216886},{"rho":0.75,"nu":3,"q":0.01,"gaussian":0.31706512187863617,"student":0.5079674351164869,"limit":0.49176700102216886},{"rho":0.75,"nu":3,"q":0.005,"gaussian":0.2772490946032886,"student":0.5019002878756623,"limit":0.49176700102216886},{"rho":0.75,"nu":3,"q":0.001,"gaussian":0.20526086679185185,"student":0.49520502999550253,"limit":0.49176700102216886},{"rho":0.75,"nu":4,"q":0.1,"gaussian":0.5124285247369056,"student":0.5584998012037574,"limit":0.4365880610203816},{"rho":0.75,"nu":4,"q":0.05,"gaussian":0.440194973299389,"student":0.5189467965715685,"limit":0.4365880610203816},{"rho":0.75,"nu":4,"q":0.01,"gaussian":0.31706512187863617,"student":0.471283361113476,"limit":0.4365880610203816},{"rho":0.75,"nu":4,"q":0.005,"gaussian":0.2772490946032886,"student":0.46078112972911045,"limit":0.4365880610203816},{"rho":0.75,"nu":4,"q":0.001,"gaussian":0.20526086679185185,"student":0.44720903173238585,"limit":0.4365880610203816},{"rho":0.75,"nu":10,"q":0.1,"gaussian":0.5124285247369056,"student":0.5314838229454001,"limit":0.23598813188664172},{"rho":0.75,"nu":10,"q":0.05,"gaussian":0.440194973299389,"student":0.4737733219831326,"limit":0.23598813188664172},{"rho":0.75,"nu":10,"q":0.01,"gaussian":0.31706512187863617,"student":0.3865899348844343,"limit":0.23598813188664172},{"rho":0.75,"nu":10,"q":0.005,"gaussian":0.2772490946032886,"student":0.3615340689806302,"limit":0.23598813188664172},{"rho":0.75,"nu":10,"q":0.001,"gaussian":0.20526086679185185,"student":0.32021984963149974,"limit":0.23598813188664172}];
export const COPULA_RHOS = [0, 0.25, 0.5, 0.75] as const;
export const COPULA_NUS = [3, 4, 10] as const;
export const COPULA_QUANTILES = [0.1, 0.05, 0.01, 0.005, 0.001] as const;
/** Discrete reference lookup, with no interpolation or extrapolation. */
export function calculateCopulaTail(rho:number,nu:number,q:number):CopulaTailRow {
  if (!COPULA_RHOS.some(v=>v===rho)) throw new Error('CopulaTailComparison: rho must be 0, 0.25, 0.5 or 0.75.');
  if (!COPULA_NUS.some(v=>v===nu)) throw new Error('CopulaTailComparison: nu must be 3, 4 or 10.');
  if (!COPULA_QUANTILES.some(v=>v===q)) throw new Error('CopulaTailComparison: q must be one of the supported quantiles.');
  return { ...REFERENCE.find(row=>row.rho===rho&&row.nu===nu&&row.q===q)! };
}
export interface CopulaTailComparisonProps {
  /** Supported initial reference-grid values. */
  rho?:number;
  nu?:number;
  q?:number;
  title?:string;
  locale?:string;
  rhoLabel?:string;
  nuLabel?:string;
  qLabel?:string;
  gaussianLabel?:string;
  studentLabel?:string;
  conditionalLabel?:string;
  gaussianLimitLabel?:string;
  studentLimitLabel?:string;
  jointLabel?:string;
  xAxisLabel?:string;
  yAxisLabel?:string;
  /** Chart alternative text template accepts {rho}, {nu}, {q}, {gaussian}, {student}, {limit}. */
  chartLabel?:string;
  /** Explains that computed finite values are not asymptotic event predictions. */
  statusMessage?:string;
  detailsLabel?:string;
  tableRegionLabel?:string;
  caption?:string;
  className?:string;
}
export function CopulaTailComparison({
  rho=.5,nu=4,q=.01,title='Finite tail probabilities and their limiting values',locale='en-US',
  rhoLabel='Latent correlation parameter',nuLabel='Student-t degrees of freedom',qLabel='Lower marginal quantile',
  gaussianLabel='Gaussian conditional, solid line',studentLabel='Student-t conditional, dashed line',conditionalLabel='Conditional probability at selected q',
  gaussianLimitLabel='Gaussian limiting coefficient',studentLimitLabel='Student-t limit, dotted line',jointLabel='Joint probability at selected q',
  xAxisLabel='Lower quantile q, shrinking to the right on a logarithmic scale',yAxisLabel='Conditional probability',
  chartLabel='At latent correlation {rho}, degrees of freedom {nu} and quantile {q}, finite conditional probabilities are Gaussian {gaussian} and Student-t {student}. Limits are zero and {limit}.',
  statusMessage='A zero Gaussian limit does not make its displayed finite joint probability zero. The limit describes increasingly extreme quantiles, not a guarantee about the next crisis.',
  detailsLabel='Inspect the numerical reference table',tableRegionLabel='Finite and limiting tail probabilities, scroll horizontally if needed',
  caption='Precomputed conditional-integral reference values on the displayed discrete grid, not a live fitting or integration engine. Both families use the selected latent correlation parameter; transformed asset-return correlations need not match it. Amounts are probabilities, not annual forecasts. Display rounding and quadrature estimates do not provide a mathematical error guarantee.',className,
}:CopulaTailComparisonProps) {
  calculateCopulaTail(rho,nu,q);
  const labels={title,rhoLabel,nuLabel,qLabel,gaussianLabel,studentLabel,conditionalLabel,gaussianLimitLabel,studentLimitLabel,jointLabel,xAxisLabel,yAxisLabel,chartLabel,statusMessage,detailsLabel,tableRegionLabel,caption};
  for(const [name,value] of Object.entries(labels)) if(typeof value!=='string'||!value.trim()) throw new Error(`CopulaTailComparison: ${name} must be nonempty.`);
  const percent=new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:4});
  const number=new Intl.NumberFormat(locale,{maximumFractionDigits:2});
  const id=useId();const [r,setR]=useState(rho);const [df,setDf]=useState(nu);const [quantile,setQuantile]=useState(q);
  const row=calculateCopulaTail(r,df,quantile);const rows=COPULA_QUANTILES.map(v=>calculateCopulaTail(r,df,v));
  const template={rho:number.format(r),nu:number.format(df),q:percent.format(quantile),gaussian:percent.format(row.gaussian),student:percent.format(row.student),limit:percent.format(row.limit)};
  const alt=chartLabel.replace(/\{(rho|nu|q|gaussian|student|limit)\}/g,(_,key:keyof typeof template)=>template[key]);
  const W=560,H=300,L=90,R=50,T=20,B=46;
  const x=(p:number)=>L+(-Math.log10(p)-1)/2*(W-L-R);
  const y=(v:number)=>T+(1-v)*(H-T-B);
  const path=(key:'gaussian'|'student')=>rows.map((d,i)=>`${i?'L':'M'}${x(d.q)},${y(d[key])}`).join(' ');
  const selectClass='mt-2 block w-full rounded-lg border border-ink-300 bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
  return <figure className={cx('not-prose my-8 rounded-card bg-surface-sunken p-4 text-ink-800 sm:p-6',className)} aria-labelledby={`${id}-title`}>
    <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption>
    <div className="mt-5 grid gap-4 sm:grid-cols-3">
      <div><label htmlFor={`${id}-rho`} className="text-sm font-medium">{rhoLabel}</label><select id={`${id}-rho`} value={r} onChange={e=>setR(Number(e.target.value))} className={selectClass}>{COPULA_RHOS.map(v=><option key={v} value={v}>{number.format(v)}</option>)}</select></div>
      <div><label htmlFor={`${id}-nu`} className="text-sm font-medium">{nuLabel}</label><select id={`${id}-nu`} value={df} onChange={e=>setDf(Number(e.target.value))} className={selectClass}>{COPULA_NUS.map(v=><option key={v} value={v}>{number.format(v)}</option>)}</select></div>
      <div><label htmlFor={`${id}-q`} className="text-sm font-medium">{qLabel}</label><select id={`${id}-q`} value={quantile} onChange={e=>setQuantile(Number(e.target.value))} className={selectClass}>{COPULA_QUANTILES.map(v=><option key={v} value={v}>{percent.format(v)}</option>)}</select></div>
    </div>
    <p className="mt-5 text-xs text-ink-600">{yAxisLabel}</p>
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 block w-full" role="img" aria-label={alt}>
      {[0,.25,.5,.75,1].map(v=><g key={v}><line x1={L} x2={W-R} y1={y(v)} y2={y(v)} stroke="var(--color-ink-200)"/><text x={L-8} y={y(v)+4} textAnchor="end" fill="var(--color-ink-600)" fontSize="12" className="text-[28px] sm:text-[12px]">{percent.format(v)}</text></g>)}
      <line x1={L} x2={W-R} y1={y(row.limit)} y2={y(row.limit)} stroke="var(--color-accent-600)" strokeDasharray="2 4" strokeWidth="1.5" />
      <path d={path('gaussian')} stroke="var(--color-brand-600)" fill="none" strokeWidth="3" />
      <path d={path('student')} stroke="var(--color-accent-600)" fill="none" strokeWidth="3" strokeDasharray="8 4" />
      {rows.map(d=><g key={d.q}><circle cx={x(d.q)} cy={y(d.gaussian)} r={d.q===quantile?6:3} fill="var(--color-brand-600)"/><rect x={x(d.q)-4} y={y(d.student)-4} width={d.q===quantile?10:7} height={d.q===quantile?10:7} fill="var(--color-accent-600)" /></g>)}
      {[.1,.01,.001].map(v=><text key={v} x={x(v)} y={H-20} textAnchor="middle" fontSize="12" className="text-[28px] sm:text-[12px]" fill="var(--color-ink-600)">{percent.format(v)}</text>)}
    </svg>
    <p className="text-xs text-ink-600">{xAxisLabel}</p>
    <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2" aria-live="polite" aria-atomic="true">
      <div><dt className="font-medium text-brand-700">{gaussianLabel}</dt><dd className="mt-1 font-mono text-xl font-semibold">{percent.format(row.gaussian)}</dd><dd className="mt-1 text-xs">{jointLabel}: {percent.format(row.q*row.gaussian)}</dd></div>
      <div><dt className="font-medium text-accent-600">{studentLabel}</dt><dd className="mt-1 font-mono text-xl font-semibold">{percent.format(row.student)}</dd><dd className="mt-1 text-xs">{jointLabel}: {percent.format(row.q*row.student)}</dd></div>
      <div><dt>{gaussianLimitLabel}</dt><dd className="mt-1 font-mono font-semibold">{percent.format(0)}</dd></div>
      <div><dt>{studentLimitLabel}</dt><dd className="mt-1 font-mono font-semibold">{percent.format(row.limit)}</dd></div>
    </dl>
    <p className="mt-4 text-sm leading-relaxed">{statusMessage}</p>
    <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600">{detailsLabel}</summary>
      <div className="mt-3">
        <table tabIndex={0} aria-label={tableRegionLabel} className="block w-full max-w-full overflow-x-auto text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><caption className="sr-only">{conditionalLabel}</caption><thead><tr>{[qLabel,gaussianLabel,studentLabel,studentLimitLabel].map(s=><th key={s} scope="col" className="p-2 font-semibold">{s}</th>)}</tr></thead><tbody>{rows.map(d=><tr key={d.q} className={d.q===quantile?'bg-brand-50':'odd:bg-surface'}><th scope="row" className="p-2 font-medium">{percent.format(d.q)}</th><td className="p-2 font-mono">{percent.format(d.gaussian)}</td><td className="p-2 font-mono">{percent.format(d.student)}</td><td className="p-2 font-mono">{percent.format(d.limit)}</td></tr>)}</tbody></table>
      </div>
    </details>
    <p className="mt-4 text-xs leading-relaxed text-ink-600">{caption}</p>
  </figure>;
}
export default CopulaTailComparison;
