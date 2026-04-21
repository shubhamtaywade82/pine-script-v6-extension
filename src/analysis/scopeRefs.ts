import type { FunctionDecl, Program, Statement } from '../ast';
import { parseProgram } from '../parser/treeParser';
import type { Position, Range } from 'vscode-languageserver-types';
import { findIdentifierRanges, positionToOffset, stringOffsetInsideRange } from './wordRefs';

function walkFunctions(stmts: Statement[], out: FunctionDecl[]): void {
  for (const s of stmts) {
    if (s.type === 'FunctionDecl') {
      out.push(s);
      walkFunctions(s.body, out);
    } else if (s.type === 'IfStmt') {
      walkFunctions(s.consequent, out);
      if (s.alternate) {
        if (Array.isArray(s.alternate)) walkFunctions(s.alternate, out);
        else walkFunctions([s.alternate], out);
      }
    } else if (s.type === 'ForStmt' || s.type === 'WhileStmt') {
      walkFunctions(s.body, out);
    } else if (s.type === 'SwitchStmt') {
      for (const c of s.cases) walkFunctions(c.body, out);
      if (s.defaultBody) walkFunctions(s.defaultBody, out);
    }
  }
}

export function listFunctions(program: Program): FunctionDecl[] {
  const fns: FunctionDecl[] = [];
  walkFunctions(program.body, fns);
  return fns;
}

export function findEnclosingFunctionFromSource(
  source: string,
  program: Program,
  pos: Position,
): FunctionDecl | null {
  const offset = positionToOffset(source, pos);
  for (const fn of listFunctions(program)) {
    if (stringOffsetInsideRange(source, fn.range, offset)) return fn;
  }
  return null;
}

export function isParameterOf(fn: FunctionDecl, name: string): boolean {
  return fn.params.some((p) => p.name === name);
}

export function filterRangesInsideFunction(source: string, fn: FunctionDecl, ranges: Range[]): Range[] {
  return ranges.filter((r) => stringOffsetInsideRange(source, fn.range, positionToOffset(source, r.start)));
}

export function parseProgramSafe(source: string): Program | null {
  try {
    return parseProgram(source).program;
  } catch {
    return null;
  }
}

/** Same-file references; for UDF parameters, limits matches to the enclosing function (incl. param list). */
export function resolveReferenceRanges(source: string, pos: Position, word: string): Range[] {
  const ranges = findIdentifierRanges(source, word);
  const program = parseProgramSafe(source);
  if (!program) return ranges;
  const fn = findEnclosingFunctionFromSource(source, program, pos);
  if (!fn || !isParameterOf(fn, word)) return ranges;
  return filterRangesInsideFunction(source, fn, ranges);
}

export function countNameDeclarations(program: Program, name: string): number {
  let n = 0;
  const walk = (stmts: Statement[]) => {
    for (const s of stmts) {
      if (s.type === 'VarDecl' && s.name === name) n++;
      if (s.type === 'FunctionDecl') {
        if (s.name === name) n++;
        walk(s.body);
      }
      if (s.type === 'IfStmt') {
        walk(s.consequent);
        if (s.alternate) {
          if (Array.isArray(s.alternate)) walk(s.alternate);
          else walk([s.alternate]);
        }
      }
      if (s.type === 'ForStmt' || s.type === 'WhileStmt') walk(s.body);
      if (s.type === 'SwitchStmt') {
        for (const c of s.cases) walk(c.body);
        if (s.defaultBody) walk(s.defaultBody);
      }
    }
  };
  walk(program.body);
  return n;
}
