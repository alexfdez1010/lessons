import { describe,expect,test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CallAuctionClearing, calculateCallAuction, DEFAULT_AUCTION_PRICES, DEFAULT_AUCTION_BUYS, DEFAULT_AUCTION_SELLS } from '@/components/react/CallAuctionClearing';
const base={prices:DEFAULT_AUCTION_PRICES,buyOrders:DEFAULT_AUCTION_BUYS,sellOrders:DEFAULT_AUCTION_SELLS,marketBuy:60,marketSell:10,referencePrice:10.14};
describe('invented single-price call selection',()=>{
 test('aggregates acceptable prices and counts each matched share once',()=>{
  const result=calculateCallAuction(base);
  expect(result.candidates.map(r=>[r.demand,r.supply,r.matched,r.imbalance])).toEqual([[200,50,50,150],[180,100,100,80],[140,140,140,0],[90,170,90,-80]]);
  expect(result.selected?.priceCents).toBe(1020);
  expect(result.selected?.matched).toBe(140);
  for(const row of result.candidates){expect(row.matched).toBeLessThanOrEqual(row.demand);expect(row.matched).toBeLessThanOrEqual(row.supply);expect(row.imbalance).toBe(row.demand-row.supply);}
 });
 test('reference distance never overrides higher volume or smaller absolute imbalance',()=>{
  expect(calculateCallAuction({...base,referencePrice:10}).selected?.priceCents).toBe(1020);
  const tie={...base,marketBuy:20};
  expect(calculateCallAuction(tie).selected?.priceCents).toBe(1010);
  expect(calculateCallAuction({...tie,referencePrice:10.16}).selected?.priceCents).toBe(1020);
  expect(calculateCallAuction({...tie,referencePrice:10.15}).selected?.priceCents).toBe(1010);
  const smallerImbalance=calculateCallAuction({...tie,buyOrders:DEFAULT_AUCTION_BUYS.map(order=>order.price===10.1?{...order,quantity:60}:order),referencePrice:10});
  expect(smallerImbalance.candidates.filter(row=>row.matched===100).map(row=>Math.abs(row.imbalance))).toEqual([60,40]);
  expect(smallerImbalance.selected?.priceCents).toBe(1020);
 });
 test('adding permitted opposing interest changes matched quantity without predicting a future price',()=>{
  const r=calculateCallAuction({...base,marketBuy:20,marketSell:50});
  expect(r.selected?.priceCents).toBe(1010);expect(r.selected?.matched).toBe(140);expect(r.selected?.imbalance).toBe(0);
 });
 test('zero maximum volume has no fabricated execution price',()=>{
  const separated={...base,buyOrders:[{price:10,quantity:100}],sellOrders:[{price:10.3,quantity:100}],marketBuy:0,marketSell:0};
  const r=calculateCallAuction(separated);expect(r.selected).toBeNull();expect(r.candidates.every(row=>row.matched===0)).toBe(true);
  expect(calculateCallAuction({...separated,referencePrice:10.3}).selected).toBeNull();
  expect(calculateCallAuction({...separated,marketBuy:10}).selected?.priceCents).toBe(1030);
 });
 test('bad author models and malformed headings fail during SSR',()=>{
  for(const props of [{prices:[]},{prices:[10,10.1,10.3]},{marketBuy:-1},{marketSell:1.5},{referencePrice:11},{buyOrders:[{price:10.05,quantity:10}]},{candidateHeaders:['Price']}])expect(()=>renderToStaticMarkup(createElement(CallAuctionClearing,props))).toThrow('CallAuctionClearing');
  const html=renderToStaticMarkup(createElement(CallAuctionClearing,{locale:'es-ES',title:'Subasta ilustrativa',noCrossLabel:'Sin cruce',referenceLabel:'Precio de referencia'}));
  expect(html).toContain('Subasta ilustrativa');expect(html).toContain('10,20');expect(html).toContain('aria-live="polite"');expect(html).toContain('tabindex="0"');
 });
});
