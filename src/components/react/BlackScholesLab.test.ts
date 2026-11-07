import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BlackScholesLab, blackScholesNormalCdf, calculateBlackScholes, physicalLognormalSummary } from '@/components/react/BlackScholesLab';

const reference = [
  {
    "input": {
      "spot": 100,
      "strike": 100,
      "volatility": 0.2,
      "time": 1,
      "rate": 0.05,
      "dividendYield": 0
    },
    "expected": {
      "call": 10.450583572185565,
      "put": 5.573526022256971,
      "d1": 0.35000000000000003,
      "d2": 0.15000000000000002,
      "nd1": 0.6368306511756191,
      "nd2": 0.5596176923702425,
      "deltaCall": 0.6368306511756191,
      "deltaPut": -0.3631693488243809,
      "assetLeg": 63.68306511756191,
      "cashLeg": 53.232481545376345,
      "callTheta": -6.414027546438197,
      "putTheta": -1.657880423934626,
      "vega": 37.52403469169379,
      "discount": 0.951229424500714,
      "prepaidSpot": 100.0,
      "discountedStrike": 95.1229424500714,
      "forward": 105.12710963760242
    }
  },
  {
    "input": {
      "spot": 100,
      "strike": 100,
      "volatility": 0.2,
      "time": 1,
      "rate": 0.05,
      "dividendYield": 0.02
    },
    "expected": {
      "call": 9.227005508154036,
      "put": 6.3300806275499255,
      "d1": 0.25,
      "d2": 0.04999999999999999,
      "nd1": 0.5987063256829237,
      "nd2": 0.5199388058383725,
      "deltaCall": 0.586851146134764,
      "deltaPut": -0.3933475271719913,
      "assetLeg": 58.685114613476394,
      "cashLeg": 49.45810910532236,
      "callTheta": -5.0893189139983335,
      "putTheta": -2.2935691381082735,
      "vega": 37.901157510017434,
      "discount": 0.951229424500714,
      "prepaidSpot": 98.01986733067552,
      "discountedStrike": 95.1229424500714,
      "forward": 103.0454533953517
    }
  },
  {
    "input": {
      "spot": 100,
      "strike": 100,
      "volatility": 0.4,
      "time": 1,
      "rate": 0.05,
      "dividendYield": 0
    },
    "expected": {
      "call": 18.02295145021668,
      "put": 13.145893900288087,
      "d1": 0.325,
      "d2": -0.07500000000000001,
      "nd1": 0.627409464153284,
      "nd2": 0.47010735594710523,
      "deltaCall": 0.627409464153284,
      "deltaPut": -0.372590535846716,
      "assetLeg": 62.7409464153284,
      "cashLeg": 44.71799496511172,
      "callTheta": -9.804296386931977,
      "putTheta": -5.048149264428405,
      "vega": 37.84198319338195,
      "discount": 0.951229424500714,
      "prepaidSpot": 100.0,
      "discountedStrike": 95.1229424500714,
      "forward": 105.12710963760242
    }
  },
  {
    "input": {
      "spot": 50,
      "strike": 100,
      "volatility": 0.2,
      "time": 1,
      "rate": 0.05,
      "dividendYield": 0
    },
    "expected": {
      "call": 0.002399417553309649,
      "put": 45.12534186762472,
      "d1": -3.1157359027997265,
      "d2": -3.3157359027997266,
      "nd1": 0.0009174326039451514,
      "nd2": 0.0004570108064809478,
      "deltaCall": 0.0009174326039451514,
      "deltaPut": -0.9990825673960548,
      "assetLeg": 0.04587163019725757,
      "cashLeg": 0.04347221264394792,
      "callTheta": -0.01772810385644283,
      "putTheta": 4.738419018647128,
      "vega": 0.15554493224245433,
      "discount": 0.951229424500714,
      "prepaidSpot": 50.0,
      "discountedStrike": 95.1229424500714,
      "forward": 52.56355481880121
    }
  },
  {
    "input": {
      "spot": 200,
      "strike": 100,
      "volatility": 0.1,
      "time": 1,
      "rate": -0.05,
      "dividendYield": 0
    },
    "expected": {
      "call": 94.87289036253368,
      "put": 1.3611867032559712e-10,
      "d1": 6.481471805599452,
      "d2": 6.381471805599452,
      "nd1": 0.9999999999545839,
      "nd2": 0.999999999912303,
      "deltaCall": 0.9999999999545839,
      "deltaPut": -4.541607191682228e-11,
      "assetLeg": 199.99999999091676,
      "cashLeg": 105.12710962838308,
      "callTheta": 5.25635547840845,
      "putTheta": -3.471670878152551e-09,
      "vega": 6.021408450936096e-08,
      "discount": 1.0512710963760241,
      "prepaidSpot": 200.0,
      "discountedStrike": 105.12710963760242,
      "forward": 190.2458849001428
    }
  },
  {
    "input": {
      "spot": 100,
      "strike": 110,
      "volatility": 0.25,
      "time": 2,
      "rate": 0.03,
      "dividendYield": 0.01
    },
    "expected": {
      "call": 11.52862779208624,
      "put": 17.10285915567807,
      "d1": 0.020335882463495412,
      "d2": -0.33321750812977835,
      "nd1": 0.5081122841834694,
      "nd2": 0.3694850515146386,
      "deltaCall": 0.49805098684750176,
      "deltaPut": -0.4821476864592535,
      "assetLeg": 49.80509868475017,
      "cashLeg": 38.27647089266393,
      "callTheta": -4.105890285914458,
      "putTheta": -1.9782659983931918,
      "vega": 55.290354335712664,
      "discount": 0.9417645335842487,
      "prepaidSpot": 98.01986733067552,
      "discountedStrike": 103.59409869426736,
      "forward": 104.08107741923882
    }
  },
  {
    "input": {
      "spot": 90,
      "strike": 100,
      "volatility": 0.45,
      "time": 0.25,
      "rate": -0.02,
      "dividendYield": 0.04
    },
    "expected": {
      "call": 3.973445273283378,
      "put": 15.370212321798327,
      "d1": -0.42243562514589456,
      "d2": -0.6474356251458946,
      "nd1": 0.33635353965747306,
      "nd2": 0.25867502273683474,
      "deltaCall": 0.3330067660188254,
      "deltaPut": -0.6570430677303427,
      "assetLeg": 29.97060894169429,
      "cashLeg": 25.997163668410913,
      "callTheta": -12.91215843600977,
      "putTheta": -18.486362879225577,
      "vega": 16.256584518939732,
      "discount": 1.005012520859401,
      "prepaidSpot": 89.10448503742514,
      "discountedStrike": 100.5012520859401,
      "forward": 88.66007456427563
    }
  },
  {
    "input": {
      "spot": 100,
      "strike": 100,
      "volatility": 0,
      "time": 1,
      "rate": 0.05,
      "dividendYield": 0
    },
    "expected": {
      "call": 4.877057549928594,
      "put": 0
    }
  },
  {
    "input": {
      "spot": 100,
      "strike": 100,
      "volatility": 0,
      "time": 1,
      "rate": 0,
      "dividendYield": 0
    },
    "expected": {
      "call": 0.0,
      "put": 0.0
    }
  },
  {
    "input": {
      "spot": 100,
      "strike": 100,
      "volatility": 0.2,
      "time": 0,
      "rate": 0.05,
      "dividendYield": 0.02
    },
    "expected": {
      "call": 0.0,
      "put": 0.0
    }
  }
];
const base = { spot: 100, strike: 100, volatility: .2, time: 1, rate: .05, dividendYield: 0 };

describe('European model values, measures and legal boundaries', () => {
  test('matches independently generated Python erfc references for call, put, dividend delta and theta', () => {
    for (const fixture of reference) {
      const result = calculateBlackScholes(fixture.input);
      expect(result.call).toBeCloseTo(fixture.expected.call, 11);
      expect(result.put).toBeCloseTo(fixture.expected.put, 11);
      if ('d1' in fixture.expected) {
        expect(result.d1).toBeCloseTo(fixture.expected.d1!, 13);
        expect(result.d2).toBeCloseTo(fixture.expected.d2!, 13);
        expect(result.nd1).toBeCloseTo(fixture.expected.nd1!, 13);
        expect(result.nd2).toBeCloseTo(fixture.expected.nd2!, 13);
        expect(result.callDelta).toBeCloseTo(fixture.expected.deltaCall!, 13);
        expect(result.putDelta).toBeCloseTo(fixture.expected.deltaPut!, 13);
        expect(result.callTheta).toBeCloseTo(fixture.expected.callTheta!, 11);
        expect(result.putTheta).toBeCloseTo(fixture.expected.putTheta!, 11);
      }
    }
  });
  test('continuous dividend yield changes spot delta and parity without redefining exercise probability as delta', () => {
    const x = { ...base, dividendYield: .02 }, result = calculateBlackScholes(x), h = .0001;
    expect(result.call - result.put).toBeCloseTo(result.prepaidSpot - result.discountedStrike, 12);
    expect(result.callDelta).toBeCloseTo(Math.exp(-.02) * result.nd1!, 14);
    expect(result.callDelta).not.toBeCloseTo(result.nd1!, 3);
    expect(result.callDelta).not.toBeCloseTo(result.callItmProbability, 3);
    expect((calculateBlackScholes({ ...x, spot: x.spot + h }).call - calculateBlackScholes({ ...x, spot: x.spot - h }).call) / (2 * h)).toBeCloseTo(result.callDelta!, 8);
    expect(result.assetLeg - result.cashLeg).toBeCloseTo(result.call, 12);
  });
  test('higher call value can coexist with lower Q exercise probability', () => {
    const a = calculateBlackScholes(base), b = calculateBlackScholes({ ...base, volatility: .4 });
    expect(b.d1).toBeCloseTo(.325, 14);
    expect(b.d2).toBeCloseTo(-.075, 14);
    expect(b.call).toBeGreaterThan(a.call);
    expect(b.callItmProbability).toBeLessThan(a.callItmProbability);
    expect(b.callItmProbability).toBeCloseTo(.47010735594710523, 14);
    const lowOtm = calculateBlackScholes({ ...base, strike: 140, volatility: .1 }), highOtm = calculateBlackScholes({ ...base, strike: 140, volatility: .2 });
    expect(highOtm.callItmProbability).toBeGreaterThan(lowOtm.callItmProbability);
  });
  test('a stated physical capital-gain drift changes its distribution but is not an input to the conditional pricing formula', () => {
    const p = physicalLognormalSummary({ spot: 100, strike: 100, volatility: .2, time: 1, priceDrift: .12 }), q = physicalLognormalSummary({ spot: 100, strike: 100, volatility: .2, time: 1, priceDrift: .05 });
    expect(p.mean).toBeCloseTo(112.74968515793758, 11);
    expect(p.median).toBeCloseTo(110.51709180756477, 11);
    expect(p.callItmProbability).toBeCloseTo(.6914624612740131, 14);
    expect(q.callItmProbability).toBeCloseTo(calculateBlackScholes(base).callItmProbability, 14);
    expect(p.callItmProbability).toBeGreaterThan(q.callItmProbability);
    expect(p.mean).toBeGreaterThan(p.median);
  });
  test('expiry and zero volatility return their own discounted payoffs and preserve strict tie events', () => {
    const expiry = calculateBlackScholes({ ...base, time: 0 }), zero = calculateBlackScholes({ ...base, volatility: 0 }), tie = calculateBlackScholes({ ...base, rate: 0, volatility: 0 }), near = calculateBlackScholes({ ...base, rate: 0, volatility: .0001 });
    expect(expiry.mode).toBe('expiry'); expect(expiry.call).toBe(0); expect(expiry.put).toBe(0);
    expect(expiry.d1).toBeNull(); expect(expiry.callDelta).toBeNull(); expect(expiry.callItmProbability).toBe(0); expect(expiry.putItmProbability).toBe(0);
    expect(zero.mode).toBe('deterministic'); expect(zero.call).toBeCloseTo(100 - 100 * Math.exp(-.05), 12); expect(zero.put).toBe(0); expect(zero.callDelta).toBe(1);
    expect(zero.callItmProbability).toBe(1); expect(zero.putItmProbability).toBe(0);
    expect(tie.callDelta).toBeNull(); expect(tie.callItmProbability + tie.putItmProbability).toBe(0);
    expect(near.callItmProbability).toBeCloseTo(.5, 4);
    const put = calculateBlackScholes({ ...base, spot: 90, time: 0 }); expect(put.put).toBe(10); expect(put.putDelta).toBe(-1); expect(put.putItmProbability).toBe(1);
  });
  test('calendar theta sign is scoped and matches a small forward-calendar repricing', () => {
    const put = { ...base, spot: 50 }, result = calculateBlackScholes(put), dt = .00001;
    expect(result.putTheta!).toBeGreaterThan(0);
    expect(result.putTheta).toBeCloseTo(4.738419018647128, 12);
    expect((calculateBlackScholes({ ...put, time: put.time - dt }).put - result.put) / dt).toBeCloseTo(result.putTheta!, 3);
    expect(calculateBlackScholes(base).callTheta!).toBeLessThan(0);
    expect(calculateBlackScholes({ ...base, spot: 200, volatility: .1, rate: -.05 }).callTheta!).toBeGreaterThan(0);
  });
  test('price bounds, parity and regular exercise complements hold across matched continuous scenarios', () => {
    let cases = 0;
    for (const spot of [20, 75, 100, 200]) for (const strike of [20, 100, 200]) for (const time of [0, .25, 1, 3]) for (const volatility of [0, .05, .2, .8]) for (const rate of [-.05, 0, .15]) for (const dividendYield of [0, .02, .1]) {
      const result = calculateBlackScholes({ spot, strike, time, volatility, rate, dividendYield }), tolerance = 1e-10;
      if (result.call < Math.max(result.prepaidSpot - result.discountedStrike, 0) - tolerance || result.call > result.prepaidSpot + tolerance || result.put < Math.max(result.discountedStrike - result.prepaidSpot, 0) - tolerance || result.put > result.discountedStrike + tolerance || Math.abs(result.call - result.put - result.prepaidSpot + result.discountedStrike) > tolerance) throw new Error('Matched model bounds/parity failure');
      if (result.mode === 'regular' && Math.abs(result.callItmProbability + result.putItmProbability - 1) > 1e-14) throw new Error('Regular probability complement failure');
      cases++;
    }
    expect(cases).toBe(1728);
  });
  test('continuous helper inputs remain independent of visible native author grids and malformed scales are explicit', () => {
    expect(() => calculateBlackScholes({ ...base, volatility: .204, time: .3, rate: Math.log1p(.05) })).not.toThrow();
    expect(() => renderToStaticMarkup(createElement(BlackScholesLab, { view: 'inputs', volatilityPct: 20.4 }))).toThrow('native grids');
    expect(() => renderToStaticMarkup(createElement(BlackScholesLab, { view: 'inputs', time: .3 }))).toThrow('native grids');
    expect(() => renderToStaticMarkup(createElement(BlackScholesLab, { view: 'measure', volatilityPct: 0 }))).toThrow('positive time');
    expect(() => renderToStaticMarkup(createElement(BlackScholesLab, { view: 'limits', volatilityPct: 0, time: 0, ratePct: Math.log1p(.05) * 100 }))).not.toThrow();
    expect(() => calculateBlackScholes({ ...base, volatility: -1 })).toThrow('nonnegative');
    expect(() => calculateBlackScholes({ ...base, volatility: 1e-320, time: 1e-320 })).toThrow('numerical resolution');
    expect(() => calculateBlackScholes({ ...base, rate: 0, time: 1e-300 })).toThrow('numerical resolution');
    expect(() => physicalLognormalSummary({ spot: 100, strike: 100, volatility: .2, time: 1e-300, priceDrift: 0 })).toThrow('numerical resolution');
    expect(() => blackScholesNormalCdf(NaN)).toThrow('NaN');
  });
});
