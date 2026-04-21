import { referenceSignature } from '../references/index';

describe('referenceSignature overlay', () => {
  it('returns curated signature for known symbols', () => {
    expect(referenceSignature('ta.sma')).toContain('ta.sma');
    expect(referenceSignature('plot')).toBeDefined();
  });

  it('returns undefined for unknown keys', () => {
    expect(referenceSignature('not.a.real.symbol.ever')).toBeUndefined();
  });
});
