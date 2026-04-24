import {
  referenceDocumentation,
  referenceOverloadHint,
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
    expect(referenceOverloadHint('math.round')).toBeUndefined();
  });
});
