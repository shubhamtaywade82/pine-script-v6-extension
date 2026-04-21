import { parseDocument } from '../parser/parser';
import { builtinNames } from '../references/index';
import { runRules } from '../rules/engine';
import { collectTradingViewStyleHints } from '../rules/styleTradingViewHints';
import { defaultPineForgeSettings } from '../settings';

const builtins = builtinNames();

describe('collectTradingViewStyleHints', () => {
  it('flags declaration before //@version', () => {
    const src = `indicator("x", overlay = true)
//@version=6
plot(close)`;
    const hints = collectTradingViewStyleHints(src, 10);
    expect(hints.some((h) => h.code === 'pine-forge/style-version-order')).toBe(true);
  });

  it('flags //@version= deep in file', () => {
    const lines = Array.from({ length: 35 }, (_, i) => (i === 31 ? '//@version=6' : `// line ${i}`));
    const src = `${lines.join('\n')}\nindicator("x")`;
    const hints = collectTradingViewStyleHints(src, 10);
    expect(hints.some((h) => h.code === 'pine-forge/style-version-depth')).toBe(true);
  });

  it('suggests Input suffix for input assignments', () => {
    const src = `//@version=6
indicator("x", overlay = true)
length = input.int(14, "Length")`;
    const hints = collectTradingViewStyleHints(src, 10);
    expect(hints.some((h) => h.code === 'pine-forge/style-input-suffix')).toBe(true);
  });

  it('does not hint when LHS already ends with Input', () => {
    const src = `//@version=6
indicator("x", overlay = true)
lengthInput = input.int(14, "Length")`;
    const hints = collectTradingViewStyleHints(src, 10);
    expect(hints.some((h) => h.code === 'pine-forge/style-input-suffix')).toBe(false);
  });
});

describe('runRules with styleTradingViewHints', () => {
  const base = { ...defaultPineForgeSettings, strictVersionCheck: false, styleTradingViewHints: false };

  it('does not emit style codes when styleTradingViewHints is off', () => {
    const src = `//@version=6
indicator("x", overlay = true)
length = input.int(14, "Length")`;
    const issues = runRules(parseDocument(src), builtins, base);
    expect(issues.some((i) => i.code.startsWith('pine-forge/style-'))).toBe(false);
  });

  it('emits style hints when enabled', () => {
    const src = `//@version=6
indicator("x", overlay = true)
length = input.int(14, "Length")`;
    const issues = runRules(parseDocument(src), builtins, { ...base, styleTradingViewHints: true });
    expect(issues.some((i) => i.code === 'pine-forge/style-input-suffix')).toBe(true);
  });
});
