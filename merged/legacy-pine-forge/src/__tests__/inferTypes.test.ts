import { parseProgram } from '../parser/treeParser';
import { inferExpressionType } from '../semantics/inferTypes';

describe('inferExpressionType', () => {
  it('treats close as series float', () => {
    const src = '//@version=6\nindicator("x")\nvar x = close\n';
    const { program } = parseProgram(src);
    const decl = program.body.find((s) => s.type === 'VarDecl' && s.name === 'x');
    expect(decl?.type).toBe('VarDecl');
    if (decl?.type !== 'VarDecl' || !decl.init) return;
    const t = inferExpressionType(decl.init, new Map());
    expect(t.base).toBe('float');
    expect(t.isSeries).toBe(true);
  });

  it('treats literal int as scalar', () => {
    const src = '//@version=6\nindicator("x")\nvar x = 7\n';
    const { program } = parseProgram(src);
    const decl = program.body.find((s) => s.type === 'VarDecl' && s.name === 'x');
    if (decl?.type !== 'VarDecl' || !decl.init) return;
    const t = inferExpressionType(decl.init, new Map());
    expect(t.base).toBe('int');
    expect(t.isSeries).toBe(false);
  });

  it('propagates series through binary add', () => {
    const src = '//@version=6\nindicator("x")\nvar x = close + 1\n';
    const { program } = parseProgram(src);
    const decl = program.body.find((s) => s.type === 'VarDecl' && s.name === 'x');
    if (decl?.type !== 'VarDecl' || !decl.init) return;
    const t = inferExpressionType(decl.init, new Map());
    expect(t.isSeries).toBe(true);
  });
});
