import { resolveReferenceRanges } from '../analysis/scopeRefs';

describe('resolveReferenceRanges (parameter scoping)', () => {
  it('limits references for a parameter to the enclosing function', () => {
    const src = `//@version=6
indicator("t")
f(x) =>
    x + 1
`;
    const xInF = { line: 3, character: 4 };
    const ranges = resolveReferenceRanges(src, xInF, 'x');
    expect(ranges.length).toBe(2);
  });

  it('does not apply parameter filter for other identifiers inside a UDF', () => {
    const src = `//@version=6
indicator("t")
f(x) =>
    x + close
`;
    const posOnClose = { line: 3, character: 10 };
    const ranges = resolveReferenceRanges(src, posOnClose, 'close');
    expect(ranges.length).toBeGreaterThanOrEqual(1);
  });
});
