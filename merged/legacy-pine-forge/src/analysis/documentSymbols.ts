import { DocumentSymbol, SymbolKind } from 'vscode-languageserver-types';
import type { Statement } from '../ast';
import { parseProgram } from '../parser/treeParser';
import { astRangeToLsp } from './lspConvert';

function walkStatements(stmts: Statement[], bucket: DocumentSymbol[]): void {
  for (const stmt of stmts) walkStatement(stmt, bucket);
}

function walkStatement(stmt: Statement, bucket: DocumentSymbol[]): void {
  switch (stmt.type) {
    case 'VarDecl':
      bucket.push({
        name: stmt.name,
        kind: SymbolKind.Variable,
        range: astRangeToLsp(stmt.range),
        selectionRange: astRangeToLsp(stmt.nameRange),
      });
      return;
    case 'FunctionDecl': {
      const children: DocumentSymbol[] = [];
      for (const p of stmt.params) {
        children.push({
          name: p.name,
          kind: SymbolKind.Variable,
          range: astRangeToLsp(p.range),
          selectionRange: astRangeToLsp(p.range),
        });
      }
      walkStatements(stmt.body, children);
      bucket.push({
        name: stmt.name,
        kind: SymbolKind.Function,
        range: astRangeToLsp(stmt.range),
        selectionRange: astRangeToLsp(stmt.nameRange),
        children: children.length ? children : undefined,
      });
      return;
    }
    case 'TypeDecl': {
      const children: DocumentSymbol[] = [];
      for (const f of stmt.fields) {
        children.push({
          name: f.name,
          kind: SymbolKind.Field,
          range: astRangeToLsp(f.range),
          selectionRange: astRangeToLsp(f.range),
        });
      }
      bucket.push({
        name: stmt.name,
        kind: SymbolKind.Struct,
        range: astRangeToLsp(stmt.range),
        selectionRange: astRangeToLsp(stmt.nameRange),
        children: children.length ? children : undefined,
      });
      return;
    }
    case 'EnumDecl': {
      const children: DocumentSymbol[] = [];
      for (const m of stmt.members) {
        children.push({
          name: m.name,
          kind: SymbolKind.EnumMember,
          range: astRangeToLsp(m.range),
          selectionRange: astRangeToLsp(m.range),
        });
      }
      bucket.push({
        name: stmt.name,
        kind: SymbolKind.Enum,
        range: astRangeToLsp(stmt.range),
        selectionRange: astRangeToLsp(stmt.nameRange),
        children: children.length ? children : undefined,
      });
      return;
    }
    case 'ExportDecl':
      walkStatement(stmt.declaration, bucket);
      return;
    case 'IfStmt':
      walkStatements(stmt.consequent, bucket);
      if (stmt.alternate) {
        if (Array.isArray(stmt.alternate)) walkStatements(stmt.alternate, bucket);
        else walkStatement(stmt.alternate, bucket);
      }
      return;
    case 'ForStmt':
    case 'WhileStmt':
      walkStatements(stmt.body, bucket);
      return;
    case 'SwitchStmt':
      for (const c of stmt.cases) walkStatements(c.body, bucket);
      if (stmt.defaultBody) walkStatements(stmt.defaultBody, bucket);
      return;
    default:
      return;
  }
}

/** Outline symbols from the structural parser (best-effort on partial Pine). */
export function collectDocumentSymbols(source: string): DocumentSymbol[] {
  try {
    const { program } = parseProgram(source);
    const out: DocumentSymbol[] = [];
    walkStatements(program.body, out);
    return out;
  } catch {
    return [];
  }
}
