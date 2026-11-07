import{describe,test,expect}from'bun:test';import{createElement}from'react';import{renderToString}from'react-dom/server';
import{initialReserveBooks,reserveBookTotals,reserveBalanceScenario,toyCapitalCapacity,bankIncome,bankRepricing,bankMaturity,bankCreditStress,bankLiquidityStress,ReserveBalanceSheetLab,BankFundingLab}from'@/components/react/BankingBalanceLabs';
const close=(a:number,b:number)=>expect(Math.abs(a-b)).toBeLessThan(2e-10*Math.max(1,Math.abs(b)));
describe('Banking balance sheets, flows and declared stress assumptions',()=>{
 test('Opening books and each operation preserve paired identities and reserve aggregation',()=>{
  const base=initialReserveBooks();Object.values(base).forEach(b=>close(reserveBookTotals(b).residual,0));
  for(const operation of['purchaseBank','purchaseHousehold','saleBank','saleHousehold','payment','commercialLoan','lendBank','repayBank']as const)for(const amount of[0,5,20,40])for(const rep of[0,.3,1]){const x=reserveBalanceScenario(operation,amount,rep);for(const b of Object.values(x.after))close(reserveBookTotals(b).residual,0);close(x.reserves,x.after.central.reserveLiability);close(x.bankEquity,150);close(x.privateNetWorth,200);}
 });
 test('The ultimate seller controls deposit creation; asset swaps are not capital injections',()=>{
  const b=reserveBalanceScenario('purchaseBank',40),h=reserveBalanceScenario('purchaseHousehold',40);expect(b.reserveChange).toBe(40);expect(h.reserveChange).toBe(40);expect(b.depositChange).toBe(0);expect(h.depositChange).toBe(40);expect(b.after.bankA.bonds).toBe(110);expect(h.after.bankA.bonds).toBe(150);expect(h.after.household.equity).toBe(200);
  const s=reserveBalanceScenario('saleHousehold',40);expect(s.depositChange).toBe(-40);expect(s.after.bankA.reserves).toBe(10);
 });
 test('Principal repayment, settlement and collateralised funding remain distinct',()=>{
  const l=reserveBalanceScenario('commercialLoan',100,.3);expect(l.remainingLoan).toBe(70);expect(l.principalRepaid).toBe(30);expect(l.paymentFundingGap).toBe(20);expect(l.reserveChange).toBe(0);
  const p=reserveBalanceScenario('payment',20);expect(p.deposits).toBe(1350);expect(p.after.bankA.reserves).toBe(30);expect(p.after.bankB.reserves).toBe(50);
  const f=reserveBalanceScenario('lendBank',40);expect(f.after.bankA.bonds).toBe(150);expect(f.after.bankA.centralDebt).toBe(40);const r=reserveBalanceScenario('repayBank',40);expect(r.before.bankA.centralDebt).toBe(40);expect(r.after.bankA.centralDebt).toBe(0);expect(r.reserves).toBe(80);
 });
 test('Income, NIM, spread and profit use their own denominators and horizons',()=>{
  const x=bankIncome({loanRate:.05,bondRate:.03,reserveRate:.02,depositRate:.01,wholesaleRate:.02});close(x.income,45.5);close(x.expense,10);close(x.nii,35.5);close(x.nimPct,3.55);close(x.spreadPct,4.55-100/90);close(x.profit,13.5);
  const z=bankIncome({loanRate:0,bondRate:0,reserveRate:0,depositRate:.1,wholesaleRate:.1});close(z.nii,-90);close(z.profit,-112);
 });
 test('Repricing gap exactly reconciles the specified full-year linear income experiment',()=>{
  for(const sh of[-.02,0,.01,.02,.04])for(const fl of[0,.25,.5,1])for(const beta of[0,.5,1]){const x=bankRepricing(sh,fl,beta);close(x.change,x.scenario.nii-x.base.nii);close(x.change,x.gap*sh);}
  const x=bankRepricing(.02,.25,.5);close(x.gap,-250);close(x.change,-5);close(x.scenario.nii,30.5);
 });
 test('Maturity routes keep dates, funding and transferred claims explicit',()=>{
  const x=bankMaturity(.05,.06,'roll');close(x.debtAtOne,91.8);close(x.renewedDebtAtTwo,96.39);close(x.equityAtTwo,11.77);expect(x.scheduledAssetAtOne).toBe(0);close(bankMaturity(.1,.06,'roll').equityAtTwo,7.18);
  const s=bankMaturity(.05,.06,'sell');close(s.saleAtOne,108.16/1.06);close(s.equityAtOne,108.16/1.06-91.8);expect(s.claimAtTwo).toBe(0);expect(s.equityAtTwo).toBe(0);expect(s.renewedDebtAtTwo).toBe(0);
 });
 test('Loss, cash equity and liquidity funding preserve the stated balance equations',()=>{
  for(let loss=0;loss<=150;loss+=5)for(let injection=0;injection<=100;injection+=5){const x=bankCreditStress(loss,injection);close(x.residual,0);expect(x.passes).toBe(x.equity>=.1*x.rwa);close(x.investorDepositChange+x.investorShareClaim,0);close(x.settlementBankReserveChange,x.settlementBankDepositChange);}
  close(bankCreditStress(30,0).capitalPct,100*70/770);expect(bankCreditStress(20,0).passes).toBe(true);expect(bankCreditStress(120,0).bookSolvent).toBe(false);close(bankCreditStress(30,40).equity,110);expect(toyCapitalCapacity(300,40).passes).toBe(false);
 });
 test('Sale discounts, collateral haircuts and incomplete settlements have different accounting',()=>{
  for(const route of['sell','borrow']as const)for(let request=0;request<=250;request+=10)for(let d=0;d<=40;d+=5)for(let h=0;h<=40;h+=5){const x=bankLiquidityStress(request,d/100,h/100,route);close(x.residual,0);close(x.settled+x.unpaid,request);expect(x.reserves).toBeGreaterThanOrEqual(-1e-12);expect(x.bonds).toBeGreaterThanOrEqual(0);if(route==='borrow'){expect(x.sold).toBe(0);expect(x.loss).toBe(0);expect(x.bonds).toBe(150)}else expect(x.borrowing).toBe(0);}
  const s=bankLiquidityStress(100,.2,.2,'sell');close(s.sold,62.5);close(s.loss,12.5);close(s.equity,87.5);const b=bankLiquidityStress(200,.2,.2,'borrow');close(b.borrowing,120);close(b.settled,170);close(b.unpaid,30);expect(b.fullySettled).toBe(false);expect(b.equity).toBe(100);
 });
 test('Author native-grid guards reject tiny off-grid values and accept every native point',()=>{
  for(const props of[{amount:1e-10},{loan:Number.MIN_VALUE},{transfer:5.000000000000001},{visibleEntities:[]},{visibleEntities:['bankA','bankA']}])expect(()=>renderToString(createElement(ReserveBalanceSheetLab,props as any))).toThrow();
  for(const props of[{loanRatePct:1e-10},{shockPp:.25000000000000006},{request:10.000000000000002}])expect(()=>renderToString(createElement(BankFundingLab,props))).toThrow();
  for(let i=0;i<=40;i++)expect(()=>renderToString(createElement(BankFundingLab,{loanRatePct:i/4,bondRatePct:i/4,reserveRatePct:i/4,depositRatePct:i/4,wholesaleRatePct:i/4}))).not.toThrow();
  for(let i=0;i<=30;i++)expect(()=>renderToString(createElement(ReserveBalanceSheetLab,{loan:i*10,newLoan:i*10}))).not.toThrow();
  for(let i=0;i<=24;i++)expect(()=>renderToString(createElement(BankFundingLab,{view:'repricing',shockPp:-2+i/4}))).not.toThrow();
 });
 test('All legitimate zero, negative earnings and exhausted-capacity states render finite accessible data',()=>{
  for(const view of['income','repricing','maturity','credit','liquidity']as const){const s=renderToString(createElement(BankFundingLab,{view,loss:150,injection:0,request:250,discountPct:40,haircutPct:40}));expect(s).not.toMatch(/NaN|Infinity/);expect(s).toContain('tabindex="0"');expect(s).toContain('aria-live="polite"');}
  for(const f of[()=>reserveBalanceScenario('payment',50),()=>bankIncome({loanRate:NaN,bondRate:0,reserveRate:0,depositRate:0,wholesaleRate:0}),()=>bankRepricing(Infinity,.25,.5),()=>bankMaturity(0,.11,'sell'),()=>bankCreditStress(-1,0),()=>bankLiquidityStress(100,.5,0,'sell')])expect(f).toThrow();
 });
});

test('All 491 supported authored native values SSR with raw matching input values',()=>{
 const reserveCases=[['amount','purchase',0,80,5,'amount'],['transfer','payment',0,40,5,'transfer'],['loan','loan',0,300,10,'loan'],['repaymentPct','loan',0,100,5,'repay'],['centralAmount','central',0,40,5,'central'],['newLoan','capital',0,300,10,'newLoan'],['purchase','capital',0,40,5,'purchase']]as const;
 const fundingCases=[['loanRatePct','income',0,10,.25,'loanRate'],['bondRatePct','income',0,10,.25,'bondRate'],['reserveRatePct','income',0,10,.25,'reserveRate'],['depositRatePct','income',0,10,.25,'depositRate'],['wholesaleRatePct','income',0,10,.25,'wholesaleRate'],['shockPp','repricing',-2,4,.25,'shock'],['floatingPct','repricing',0,100,25,'floating'],['betaPct','repricing',0,100,10,'beta'],['renewalPct','maturity',0,10,1,'renewal'],['resalePct','maturity',0,10,1,'resale'],['loss','credit',0,150,5,'loss'],['injection','credit',0,100,5,'injection'],['request','liquidity',0,250,10,'request'],['discountPct','liquidity',0,40,5,'discount'],['haircutPct','liquidity',0,40,5,'haircut']]as const;
 let count=0;
 for(const[isReserve,cases]of[[true,reserveCases],[false,fundingCases]]as const)for(const[prop,view,min,max,step,key]of cases)for(let i=0;i<=Math.round((max-min)/step);i++){const v=min+i*step,s=renderToString(createElement(isReserve?ReserveBalanceSheetLab:BankFundingLab as any,{[isReserve?'mode':'view']:view,[prop]:v}));const input=s.match(new RegExp(`<input[^>]*data-control="${key}"[^>]*>`))?.[0];expect(input).toBeDefined();const raw=input?.match(/value="([^"]+)"/)?.[1];expect(Number(raw)).toBe(v);count++;}
 expect(count).toBe(491);
 expect(()=>bankIncome({}as any)).toThrow();expect(()=>reserveBookTotals({...initialReserveBooks().bankA,reserves:NaN})).toThrow();
});
