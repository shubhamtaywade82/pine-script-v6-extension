import { parseDocument } from '../parser/parser';
import { isConstStringExpressionForAlert } from '../rules/alertconditionConstString';
import { runRules } from '../rules/engine';
import { builtinNames } from '../references/index';
import { defaultPineForgeSettings } from '../settings';

describe('alertcondition const string (CE10123)', () => {
  describe('isConstStringExpressionForAlert', () => {
    it('accepts plain string literals', () => {
      expect(isConstStringExpressionForAlert('"hi"')).toBe(true);
      expect(isConstStringExpressionForAlert("'x'")).toBe(true);
    });

    it('accepts only string literals joined with +', () => {
      expect(isConstStringExpressionForAlert('"a" + "b"')).toBe(true);
    });

    it('rejects + with non-literal parts (series string)', () => {
      expect(isConstStringExpressionForAlert('"a" + str.tostring(close)')).toBe(false);
      expect(isConstStringExpressionForAlert('"a" + close')).toBe(false);
      expect(isConstStringExpressionForAlert('"a" + syminfo.ticker')).toBe(false);
    });

    it('accepts a bare identifier (possible const var)', () => {
      expect(isConstStringExpressionForAlert('MY_MSG')).toBe(true);
    });
  });

  const builtins = builtinNames();
  const opts = {
    ...defaultPineForgeSettings,
    strictVersionCheck: false,
    strictImplicitBoolIf: false,
  };

  it('flags message when expression is not const string', () => {
    const src = `//@version=6
alertcondition(true, title='t', message='m' + str.tostring(close))`;
    const issues = runRules(parseDocument(src), builtins, opts);
    expect(issues.some((i) => i.code === 'pine-forge/alertcondition-message-not-const')).toBe(true);
  });

  it('flags title when expression is not const string', () => {
    const src = `//@version=6
alertcondition(true, title='t' + str.tostring(high), message='ok')`;
    const issues = runRules(parseDocument(src), builtins, opts);
    expect(issues.some((i) => i.code === 'pine-forge/alertcondition-title-not-const')).toBe(true);
  });

  it('does not flag literal title and message', () => {
    const src = `//@version=6
alertcondition(true, title='t', message='m')`;
    const issues = runRules(parseDocument(src), builtins, opts);
    expect(issues.filter((i) => String(i.code).includes('alertcondition'))).toEqual([]);
  });

  it('accepts positional title and message as literals', () => {
    const src = `//@version=6
alertcondition(true, "My title", "My message")`;
    const issues = runRules(parseDocument(src), builtins, opts);
    expect(issues.filter((i) => String(i.code).includes('alertcondition'))).toEqual([]);
  });
});
