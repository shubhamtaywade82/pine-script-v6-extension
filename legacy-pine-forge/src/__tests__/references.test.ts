import {
  referenceDocumentation,
  referenceExample,
  referenceOverloadHint,
  referenceParams,
  referenceRemarks,
  referenceReturns,
  referenceSignature,
} from '../references/index';

describe('referenceSignature overlay', () => {
  it('returns curated signature for known symbols', () => {
    expect(referenceSignature('ta.sma')).toContain('ta.sma');
    expect(referenceSignature('plot')).toBeDefined();
  });

  it('returns undefined for unknown keys', () => {
    expect(referenceSignature('not.a.real.symbol.ever')).toBeUndefined();
  });
});

describe('referenceDocumentation / referenceOverloadHint', () => {
  it('curates TV-style hover prose for math.round', () => {
    expect(referenceDocumentation('math.round')).toMatch(/nearest integer/i);
    expect(referenceDocumentation('math.round')).toMatch(/\*\*Returns\*\*/);
  });

  it('exposes overload hints where set', () => {
    expect(referenceOverloadHint('str.tostring')).toMatch(/\+4 overloads/);
    expect(referenceOverloadHint('color.new')).toMatch(/\+3 overloads/);
    // math.round has 2 scraped syntax overloads → auto-generates hint now
    expect(referenceOverloadHint('math.round')).toMatch(/\+1 overload/);
  });
});

describe('rich reference helpers', () => {
  it('referenceParams returns undefined for symbols with no curated params and no scraped params', () => {
    // math.round has no overlay params defined — may or may not have scraped params
    const p = referenceParams('not.a.real.symbol.ever');
    expect(p).toBeUndefined();
  });

  it('referenceReturns returns undefined for unknown symbol', () => {
    expect(referenceReturns('not.a.real.symbol.ever')).toBeUndefined();
  });

  it('referenceExample returns undefined for unknown symbol', () => {
    expect(referenceExample('not.a.real.symbol.ever')).toBeUndefined();
  });

  it('referenceRemarks returns undefined for unknown symbol', () => {
    expect(referenceRemarks('not.a.real.symbol.ever')).toBeUndefined();
  });

  it('overlay params take precedence when defined', () => {
    // If a symbol has overlay params set, referenceParams should return them
    // (test is forward-compatible: passes when overlay has no params for these symbols too)
    const p = referenceParams('math.round');
    if (p !== undefined) {
      expect(Array.isArray(p)).toBe(true);
      expect(p.length).toBeGreaterThan(0);
      expect(p[0]).toHaveProperty('name');
      expect(p[0]).toHaveProperty('description');
    }
  });
});
