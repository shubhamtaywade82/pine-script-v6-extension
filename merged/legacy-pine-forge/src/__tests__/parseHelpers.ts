import { buildParsedDocumentFromProgram } from '../parser/parsedDocumentFromProgram';
import { parseProgram } from '../parser/treeParser';
import type { ParsedDocument } from '../parser/parser';

/** `ParsedDocument` derived from the structural program AST (canonical for rules). */
export function parsedDocFromSource(src: string): ParsedDocument {
  return buildParsedDocumentFromProgram(src, parseProgram(src).program);
}
