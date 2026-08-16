import type { Range as AstRange } from '../ast';
import type { Range as LspRange } from 'vscode-languageserver-types';

export function astRangeToLsp(r: AstRange): LspRange {
  return {
    start: { line: r.start.line, character: r.start.character },
    end: { line: r.end.line, character: r.end.character },
  };
}
