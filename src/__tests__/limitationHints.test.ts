import { parseDocument } from '../parser/parser';
import { builtinNames } from '../references/index';
import { runRules } from '../rules/engine';
import { collectLimitationHints } from '../rules/limitationHints';
import { defaultPineForgeSettings } from '../settings';

const builtins = builtinNames();

describe('collectLimitationHints', () => {
  it('warns when upper-bound plot budget exceeds 56', () => {
    const lines = ['//@version=6', 'indicator("x", overlay = true)'];
    for (let i = 0; i < 30; i++) {
      lines.push(`plotcandle(open, high, low, close, color = close > open ? color.green : color.red)`);
    }
    const src = `${lines.join('\n')}\n`;
    const parsed = parseDocument(src);
    const hints = collectLimitationHints(parsed, 3);
    expect(hints.some((h) => h.code === 'pine-forge/limit-plot-budget-est')).toBe(true);
  });

  it('warns when many request.* call sites exist', () => {
    const lines = ['//@version=6', 'indicator("x", overlay = true)'];
    for (let i = 0; i < 40; i++) {
      lines.push(`x${i} = request.security(syminfo.tickerid, "${i}", close)`);
    }
    const src = `${lines.join('\n')}\n`;
    const parsed = parseDocument(src);
    const hints = collectLimitationHints(parsed, 3);
    expect(hints.some((h) => h.code === 'pine-forge/limit-request-density')).toBe(true);
  });
});

describe('runRules with limitationHints', () => {
  const base = {
    ...defaultPineForgeSettings,
    strictVersionCheck: false,
    limitationHints: false,
  };

  it('does not emit limitation codes when off', () => {
    const src = `//@version=6
indicator("x", overlay = true)
plot(close)`;
    const issues = runRules(parseDocument(src), builtins, base);
    expect(issues.some((i) => i.code.startsWith('pine-forge/limit-'))).toBe(false);
  });
});
