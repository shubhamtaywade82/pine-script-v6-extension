import { buildCompletionItems } from '../completions/buildCompletions';

describe('buildCompletionItems', () => {
  it('includes user function from outline and built-ins', () => {
    const src = `//@version=6
indicator("t")
myFn() => 1
`;
    const items = buildCompletionItems(src, '');
    const labels = items.map((i) => i.label);
    expect(labels).toContain('myFn');
    expect(labels).toContain('indicator');
  });
});
