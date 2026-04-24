import { parseProgram } from '../parser/treeParser';
import { collectRepaintDiagnostics } from '../semantics/repaintDiagnostics';

describe('collectRepaintDiagnostics', () => {
  it('flags request.security with lookahead_on', () => {
    const src = `//@version=6
indicator("x")
x = request.security(syminfo.tickerid, "D", close, lookahead = barmerge.lookahead_on)
`;
    const { program } = parseProgram(src);
    const issues = collectRepaintDiagnostics(src, program);
    expect(issues.some((i) => i.code === 'pine-forge/repaint-security-lookahead')).toBe(true);
  });

  it('flags negative history on high', () => {
    const src = `//@version=6
indicator("x")
x = high[-1]
`;
    const { program } = parseProgram(src);
    const issues = collectRepaintDiagnostics(src, program);
    expect(issues.some((i) => i.code === 'pine-forge/repaint-negative-history')).toBe(true);
  });
});
