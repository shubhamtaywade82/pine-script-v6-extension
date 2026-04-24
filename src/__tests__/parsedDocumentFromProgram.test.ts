import { parseDocument } from '../parser/parser';
import { buildParsedDocumentFromProgram } from '../parser/parsedDocumentFromProgram';
import { parseProgram } from '../parser/treeParser';

describe('buildParsedDocumentFromProgram', () => {
  it('lists the same top-level call names as legacy parseDocument for a simple script', () => {
    const src = `//@version=6
indicator("x", overlay = true)
plot(close)
y = ta.sma(close, 14)
`;
    const legacy = parseDocument(src);
    const fromAst = buildParsedDocumentFromProgram(src, parseProgram(src).program);
    const legacyCalls = legacy.nodes.filter((n) => n.kind === 'call').map((n) => (n as { name: string }).name);
    const astCalls = fromAst.nodes.filter((n) => n.kind === 'call').map((n) => (n as { name: string }).name);
    expect(new Set(astCalls)).toEqual(new Set(legacyCalls));
  });

  it('uses program version as versionDirective', () => {
    const src = '//@version=6\nindicator("a")\n';
    const { program } = parseProgram(src);
    const doc = buildParsedDocumentFromProgram(src, program);
    expect(doc.versionDirective).toBe(6);
  });
});
