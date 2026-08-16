import { builtinNames } from '../references/index';
import { runAnalysisFromProgram } from '../rules/engine';
import { defaultPineForgeSettings } from '../settings';
import { parseProgram } from '../parser/treeParser';

const builtins = builtinNames();

describe('runAnalysisFromProgram', () => {
  it('reports bool-na from AST', () => {
    const src = `//@version=6
indicator("x")
a = na(true)
`;
    const { program } = parseProgram(src);
    const issues = runAnalysisFromProgram(src, program, builtins, {
      ...defaultPineForgeSettings,
      strictVersionCheck: false,
    });
    expect(issues.some((i) => i.code === 'pine-forge/bool-na')).toBe(true);
  });

  it('includes repaint hints when repaintHints is true', () => {
    const src = `//@version=6
indicator("x")
x = request.security(syminfo.tickerid, "D", close, lookahead = barmerge.lookahead_on)
`;
    const { program } = parseProgram(src);
    const issues = runAnalysisFromProgram(src, program, builtins, {
      ...defaultPineForgeSettings,
      strictVersionCheck: false,
      repaintHints: true,
    });
    expect(issues.some((i) => i.code === 'pine-forge/repaint-security-lookahead')).toBe(true);
  });
});
