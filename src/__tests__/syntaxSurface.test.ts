import { syntaxSurfaceIssues } from '../rules/syntaxSurface';

describe('syntaxSurfaceIssues (then + semicolon)', () => {
  it('flags multiple statements after then on one line', () => {
    const src = `//@version=6
if is_new_day then pdh := day_high; pdl := day_low
`;
    const issues = syntaxSurfaceIssues(src);
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0].code).toBe('pine-forge/invalid-then-semicolon');
    expect(issues[0].message).toContain('only one statement');
    expect(issues[0].range.start.line).toBe(1);
  });

  it('allows semicolons inside parentheses after then', () => {
    const src = `//@version=6
if barstate.islast then plot((1 + 2); (3 + 4))
`;
    expect(syntaxSurfaceIssues(src)).toHaveLength(0);
  });

  it('does not flag a single statement after then', () => {
    const src = `//@version=6
if close then plot(close)
`;
    expect(syntaxSurfaceIssues(src)).toHaveLength(0);
  });

  it('ignores then inside a string', () => {
    const src = `//@version=6
x = "if then;"
`;
    expect(syntaxSurfaceIssues(src)).toHaveLength(0);
  });
});
