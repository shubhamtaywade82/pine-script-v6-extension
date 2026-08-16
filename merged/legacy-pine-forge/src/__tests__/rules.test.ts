import { builtinNames } from '../references/index';
import { runRules } from '../rules/engine';
import { defaultPineForgeSettings } from '../settings';
import { parsedDocFromSource as parsedDoc } from './parseHelpers';

const builtins = builtinNames();

describe('implicit bool if rule', () => {
  const base = {
    ...defaultPineForgeSettings,
    strictVersionCheck: false,
    strictImplicitBoolIf: true,
    tradingViewManualHints: false,
  };

  it('when strictImplicitBoolIf is off, does not flag bare if close', () => {
    const src = `//@version=6
if close
    na`;
    const issues = runRules(parsedDoc(src), builtins, { ...base, strictImplicitBoolIf: false });
    expect(issues.some((i) => i.code === 'pine-forge/implicit-bool-cast')).toBe(false);
  });

  it('flags bare same-line condition when strictImplicitBoolIf is enabled', () => {
    const src = `//@version=6
if close
    na`;
    const issues = runRules(parsedDoc(src), builtins, base);
    expect(issues.some((i) => i.code === 'pine-forge/implicit-bool-cast')).toBe(true);
  });

  it('does not flag comparisons on the same line', () => {
    const src = `//@version=6
if close == 0
    na`;
    const issues = runRules(parsedDoc(src), builtins, base);
    expect(issues.some((i) => i.code === 'pine-forge/implicit-bool-cast')).toBe(false);
  });

  it('does not flag matches inside line comments', () => {
    const src = `//@version=6
// if close
plot(close)`;
    const issues = runRules(parsedDoc(src), builtins, base);
    expect(issues.some((i) => i.code === 'pine-forge/implicit-bool-cast')).toBe(false);
  });

  it('does not flag indexing tail on same line', () => {
    const src = `//@version=6
if close[1]
    na`;
    const issues = runRules(parsedDoc(src), builtins, base);
    expect(issues.some((i) => i.code === 'pine-forge/implicit-bool-cast')).toBe(false);
  });
});
