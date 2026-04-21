import { parseDocument } from '../parser/parser';

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
