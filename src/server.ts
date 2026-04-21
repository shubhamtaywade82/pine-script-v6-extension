import {
  CodeAction,
  CodeActionKind,
  CompletionItem,
  createConnection,
  Diagnostic,
  DiagnosticSeverity,
  DocumentHighlight,
  DocumentHighlightKind,
  Hover,
  InitializeParams,
  Location,
  MarkupKind,
  ProposedFeatures,
  SignatureHelp,
  SignatureInformation,
  TextDocumentSyncKind,
  TextDocuments,
  TextEdit,
  WorkspaceEdit,
} from 'vscode-languageserver/node';
import type {
  CodeActionParams,
  CompletionParams,
  DefinitionParams,
  DocumentFormattingParams,
  DocumentHighlightParams,
  PrepareRenameParams,
  ReferenceParams,
  RenameParams,
  SignatureHelpParams,
  WorkspaceSymbolParams,
} from 'vscode-languageserver';
import type { DocumentSymbol, SymbolInformation } from 'vscode-languageserver-types';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { buildCompletionItems } from './completions/buildCompletions';
import { collectDocumentSymbols } from './analysis/documentSymbols';
import { formatPineSource } from './analysis/format';
import { calleeBeforeOpenParen } from './analysis/signatureHelp';
import { countNameDeclarations, parseProgramSafe, resolveReferenceRanges } from './analysis/scopeRefs';
import { wordRangeAtOffset } from './analysis/wordRefs';
import { parseProgram } from './parser/treeParser';
import { parseDocument } from './parser/parser';
import { runRules } from './rules/engine';
import { syntaxSurfaceIssues } from './rules/syntaxSurface';
import { builtinNames, pineReferences, referenceSignature, refUrl } from './references/index';
import {
  defaultPineForgeSettings,
  PINE_FORGE_SETTINGS_NOTIFICATION,
  type PineForgeSettings,
} from './settings';
import type { RuleIssue } from './rules/engine';

function flattenDocumentSymbols(syms: DocumentSymbol[]): DocumentSymbol[] {
  const out: DocumentSymbol[] = [];
  for (const s of syms) {
    out.push(s);
    if (s.children?.length) out.push(...flattenDocumentSymbols(s.children));
  }
  return out;
}

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

const builtins = builtinNames();

let serverSettings: PineForgeSettings = { ...defaultPineForgeSettings };

connection.onInitialize((params: InitializeParams) => {
  const init = params.initializationOptions as Partial<PineForgeSettings> | undefined;
  if (init) {
    serverSettings = { ...serverSettings, ...init };
  }
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ['.', '_', '('],
      },
      definitionProvider: true,
      referencesProvider: true,
      documentSymbolProvider: true,
      workspaceSymbolProvider: true,
      documentHighlightProvider: true,
      documentFormattingProvider: true,
      signatureHelpProvider: {
        triggerCharacters: ['(', ','],
      },
      renameProvider: {
        prepareProvider: true,
      },
      codeActionProvider: {
        codeActionKinds: [CodeActionKind.QuickFix],
      },
    },
  };
});

connection.onNotification(PINE_FORGE_SETTINGS_NOTIFICATION, (partial: Partial<PineForgeSettings>) => {
  serverSettings = { ...serverSettings, ...partial };
  for (const doc of documents.all()) {
    validateDocument(doc);
  }
});

function validateDocument(doc: TextDocument): void {
  if (!serverSettings.enable) {
    connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] });
    return;
  }

  const text = doc.getText();
  const parsed = parseDocument(text);
  const { program } = parseProgram(text);
  const structuralIssues: RuleIssue[] = program.errors.map((e) => ({
    code: 'pine-forge/structural-parse',
    message: `PineForge structural parse: ${e.message}`,
    range: e.range,
    severity: DiagnosticSeverity.Error,
  }));
  const surfaceIssues = syntaxSurfaceIssues(text);
  const ruleIssues = runRules(parsed, builtins, serverSettings);
  const maxProblems = Math.max(1, serverSettings.maxNumberOfProblems);
  const issues = [...structuralIssues, ...surfaceIssues, ...ruleIssues].slice(0, maxProblems);
  const diagnostics: Diagnostic[] = issues.map((issue) => ({
    range: issue.range,
    message: issue.message,
    severity: issue.severity,
    source: 'pine-forge',
    code: issue.code,
  }));
  connection.sendDiagnostics({ uri: doc.uri, diagnostics });
}

documents.onDidChangeContent((change: { document: TextDocument }) => {
  validateDocument(change.document);
});

documents.onDidOpen((e: { document: TextDocument }) => {
  validateDocument(e.document);
});

connection.onHover((params): Hover | null => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  const text = doc.getText();
  const offset = doc.offsetAt(params.position);
  const hit = wordRangeAtOffset(text, offset);
  if (!hit) return null;
  const ref = pineReferences[hit.word];
  if (!ref) return null;
  const url = refUrl(ref.path);
  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: `**${hit.word}** (${ref.kind})\n\n${ref.summary}\n\n[TradingView reference](${url})`,
    },
  };
});

function completionPrefix(doc: TextDocument, pos: { line: number; character: number }): string {
  const line = doc.getText({
    start: { line: pos.line, character: 0 },
    end: pos,
  });
  const m = line.match(/[\w.]+$/);
  return m ? m[0] : '';
}

connection.onCompletion((params: CompletionParams): CompletionItem[] => {
  const doc = params.textDocument ? documents.get(params.textDocument.uri) : undefined;
  const prefix = doc ? completionPrefix(doc, params.position).toLowerCase() : '';
  const text = doc?.getText() ?? '';
  return buildCompletionItems(text, prefix);
});

connection.onDefinition((params: DefinitionParams): Location | Location[] | null => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  const text = doc.getText();
  const offset = doc.offsetAt(params.position);
  const hit = wordRangeAtOffset(text, offset);
  if (!hit) return null;
  const ref = pineReferences[hit.word];
  if (!ref) return null;
  const url = refUrl(ref.path);
  return Location.create(url, {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 0 },
  });
});

connection.onReferences((params: ReferenceParams): Location[] | null => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  const text = doc.getText();
  const offset = doc.offsetAt(params.position);
  const hit = wordRangeAtOffset(text, offset);
  if (!hit) return null;
  const ranges = resolveReferenceRanges(text, params.position, hit.word);
  return ranges.map((r) => Location.create(params.textDocument.uri, r));
});

connection.onDocumentSymbol((params) => collectDocumentSymbols(documents.get(params.textDocument.uri)?.getText() ?? ''));

connection.onWorkspaceSymbol((params: WorkspaceSymbolParams): SymbolInformation[] => {
  const q = (params.query ?? '').toLowerCase();
  if (!q) return [];
  const out: SymbolInformation[] = [];
  for (const doc of documents.all()) {
    for (const sym of flattenDocumentSymbols(collectDocumentSymbols(doc.getText()))) {
      if (sym.name.toLowerCase().includes(q)) {
        out.push({
          name: sym.name,
          kind: sym.kind,
          location: { uri: doc.uri, range: sym.selectionRange ?? sym.range },
        });
      }
    }
  }
  return out.slice(0, 50);
});

connection.onDocumentHighlight((params: DocumentHighlightParams): DocumentHighlight[] | null => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  const text = doc.getText();
  const hit = wordRangeAtOffset(text, doc.offsetAt(params.position));
  if (!hit) return null;
  return resolveReferenceRanges(text, params.position, hit.word).map((r) => ({
    range: r,
    kind: DocumentHighlightKind.Text,
  }));
});

connection.onSignatureHelp((params: SignatureHelpParams): SignatureHelp | null => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  const text = doc.getText();
  const offset = doc.offsetAt(params.position);
  const callee = calleeBeforeOpenParen(text, offset);
  if (!callee) return null;
  const ref = pineReferences[callee];
  if (!ref) return null;
  const sigLabel = referenceSignature(callee) ?? `${callee}(…)`;
  const sig: SignatureInformation = {
    label: sigLabel,
    documentation: {
      kind: MarkupKind.Markdown,
      value: `${ref.summary}\n\n[Open v6 reference](${refUrl(ref.path)})`,
    },
    parameters: [
      {
        label: '…',
        documentation: 'See TradingView reference for full parameter list and qualified types.',
      },
    ],
  };
  return {
    signatures: [sig],
    activeSignature: 0,
    activeParameter: 0,
  };
});

connection.onDocumentFormatting((params: DocumentFormattingParams): TextEdit[] | null => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  const tabSize = params.options.tabSize ?? 4;
  const prev = doc.getText();
  const next = formatPineSource(prev, tabSize);
  if (next === prev) return [];
  const endPos = doc.positionAt(prev.length);
  return [TextEdit.replace({ start: { line: 0, character: 0 }, end: endPos }, next)];
});

connection.onPrepareRename((params: PrepareRenameParams) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  const text = doc.getText();
  const hit = wordRangeAtOffset(text, doc.offsetAt(params.position));
  if (!hit) return null;
  if (builtins.has(hit.word)) {
    return { defaultBehavior: false, message: 'Cannot rename built-in / indexed reference symbols.' };
  }
  const program = parseProgramSafe(text);
  if (program && countNameDeclarations(program, hit.word) > 1) {
    return {
      defaultBehavior: false,
      message: `Multiple declarations named '${hit.word}' — rename is disabled to avoid wrong edits.`,
    };
  }
  return {
    range: {
      start: doc.positionAt(hit.start),
      end: doc.positionAt(hit.end),
    },
    placeholder: hit.word,
  };
});

connection.onRenameRequest((params: RenameParams): WorkspaceEdit | null => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  const newName = params.newName.trim();
  if (!newName || !/^[a-zA-Z_]\w*$/.test(newName)) return null;
  const text = doc.getText();
  const hit = wordRangeAtOffset(text, doc.offsetAt(params.position));
  if (!hit || builtins.has(hit.word)) return null;
  const ranges = resolveReferenceRanges(text, params.position, hit.word);
  if (!ranges.length) return null;
  ranges.sort((a, b) => doc.offsetAt(b.start) - doc.offsetAt(a.start));
  const edits: TextEdit[] = ranges.map((r) => TextEdit.replace(r, newName));
  return { changes: { [params.textDocument.uri]: edits } };
});

connection.onCodeAction((params: CodeActionParams): CodeAction[] | null => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  const text = doc.getText();
  const actions: CodeAction[] = [];

  for (const d of params.context.diagnostics) {
    const raw = d.code;
    const code = typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : undefined;
    if (code === 'pine-forge/version-missing') {
      actions.push({
        title: 'Insert //@version=6',
        kind: CodeActionKind.QuickFix,
        diagnostics: [d],
        edit: {
          changes: {
            [params.textDocument.uri]: [
              TextEdit.insert({ line: 0, character: 0 }, '//@version=6\n'),
            ],
          },
        },
      });
    }
    if (code === 'pine-forge/version-below-6') {
      actions.push({
        title: 'Set //@version=6',
        kind: CodeActionKind.QuickFix,
        diagnostics: [d],
        edit: {
          changes: {
            [params.textDocument.uri]: [
              TextEdit.replace(
                (() => {
                  const m = text.match(/\/\/\s*@version\s*=\s*\d+/);
                  if (!m || m.index === undefined) {
                    return { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
                  }
                  const start = doc.positionAt(m.index);
                  const end = doc.positionAt(m.index + m[0].length);
                  return { start, end };
                })(),
                '//@version=6',
              ),
            ],
          },
        },
      });
    }
    if (code === 'pine-forge/deprecated-transp' && d.range) {
      const startOff = doc.offsetAt(d.range.start);
      const endOff = doc.offsetAt(d.range.end);
      const inner = text.slice(startOff, endOff);
      actions.push({
        title: 'Remove deprecated transp argument (review manually)',
        kind: CodeActionKind.QuickFix,
        diagnostics: [d],
        edit: {
          changes: {
            [params.textDocument.uri]: [
              TextEdit.replace(
                d.range,
                inner.replace(/^\s*,?\s*transp\s*=\s*[^,)]+/, '').replace(/,\s*$/, ''),
              ),
            ],
          },
        },
      });
    }
  }

  return actions.length ? actions : null;
});

documents.listen(connection);
connection.listen();
