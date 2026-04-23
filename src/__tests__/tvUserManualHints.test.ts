import { parseDocument } from '../parser/parser';
import { builtinNames } from '../references/index';
import { runRules } from '../rules/engine';
import { tradingViewUserManualIssues } from '../rules/tvUserManualHints';
import { defaultPineForgeSettings } from '../settings';

const builtins = builtinNames();

describe('tradingViewUserManualIssues (CE10101-style)', () => {
  it('flags bare if newMonth style identifier', () => {
    const src = `//@version=6
indicator("x")
newMonth = ta.change(month)
if newMonth
    plot(1)`;
    const issues = tradingViewUserManualIssues(src, {
      enabled: true,
      strictImplicitBoolIf: false,
      cap: 10,
    });
    expect(issues.some((i) => i.code === 'pine-forge/TV-CE10101')).toBe(true);
  });

  it('does not duplicate when strictImplicitBoolIf already covers OHLC', () => {
    const src = `//@version=6
if close
    na`;
    const issues = tradingViewUserManualIssues(src, {
      enabled: true,
      strictImplicitBoolIf: true,
      cap: 10,
    });
    expect(issues.some((i) => i.code === 'pine-forge/TV-CE10101')).toBe(false);
  });

  it('returns empty when disabled', () => {
    expect(
      tradingViewUserManualIssues('//@version=6\nif x\n    1', {
        enabled: false,
        strictImplicitBoolIf: false,
        cap: 10,
      }),
    ).toHaveLength(0);
  });
});

describe('runRules with tradingViewManualHints', () => {
  const base = {
    ...defaultPineForgeSettings,
    strictVersionCheck: false,
    tradingViewManualHints: true,
    strictImplicitBoolIf: false,
    styleTradingViewHints: false,
    limitationHints: false,
  };

  it('includes TV-CE10101 for non-OHLC bare if', () => {
    const src = `//@version=6
indicator("x")
if pivotHigh
    1`;
    const issues = runRules(parseDocument(src), builtins, base);
    expect(issues.some((i) => i.code === 'pine-forge/TV-CE10101')).toBe(true);
  });
});
