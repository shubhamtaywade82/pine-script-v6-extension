import { parseDocument } from '../parser/parser';
import { parseProgram } from '../parser/treeParser';

describe('parseDocument', () => {
  it('records version 6 from annotation', () => {
    const src = `//@version=6\nindicator("x")\nplot(close)\n`;
    const doc = parseDocument(src);
    expect(doc.versionDirective).toBe(6);
    expect(doc.nodes.some((n) => n.kind === 'version')).toBe(true);
  });

  it('detects namespaced call as single identifier', () => {
    const src = `//@version=6\nindicator("x")\nta.sma(close, 14)\n`;
    const doc = parseDocument(src);
    const calls = doc.nodes.filter((n) => n.kind === 'call').map((n) => (n as { name: string }).name);
    expect(calls).toContain('ta.sma');
  });
});

describe('parseProgram structural AST', () => {
  it('parses na(true) as call with bool literal argument', () => {
    const src = `//@version=6
indicator("x")
a = na(true)
`;
    const { program } = parseProgram(src);
    const last = program.body[program.body.length - 1];
    expect(last?.type).toBe('VarDecl');
    if (last?.type !== 'VarDecl' || !last.init) return;
    expect(last.init.type).toBe('CallExpr');
    if (last.init.type !== 'CallExpr') return;
    expect(last.init.args[0]?.value.type).toBe('BoolLiteral');
  });
});
