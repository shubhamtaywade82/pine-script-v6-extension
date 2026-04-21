import { collectDocumentSymbols } from '../analysis/documentSymbols';
import { formatPineSource } from '../analysis/format';
import { findIdentifierRanges } from '../analysis/wordRefs';

describe('formatPineSource', () => {
  it('trims trailing whitespace and ensures newline at EOF', () => {
    expect(formatPineSource('a  \nb\t', 4)).toBe('a\nb\n');
  });
});

describe('findIdentifierRanges', () => {
  it('skips matches inside strings', () => {
    const src = 'x = 1\ny = "x here"\nx = 2';
    const ranges = findIdentifierRanges(src, 'x');
    expect(ranges.length).toBe(2);
  });
});

describe('collectDocumentSymbols', () => {
  it('extracts var and function declarations', () => {
    const src = `//@version=6
indicator("t")
myFn(x) =>
    float r = x + 1
    r
`;
    const syms = collectDocumentSymbols(src);
    const names = syms.map((s) => s.name);
    expect(names).toContain('myFn');
    const fn = syms.find((s) => s.name === 'myFn');
    expect(fn?.children?.some((c) => c.name === 'r')).toBe(true);
  });
});
