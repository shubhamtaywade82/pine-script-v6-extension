import {
  CompletionItem,
  CompletionItemKind,
  createConnection,
  Diagnostic,
  DiagnosticSeverity,
  Hover,
  InitializeParams,
  ProposedFeatures,
  TextDocumentSyncKind,
  TextDocuments,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseDocument } from './parser/parser';
import { runRules } from './rules/engine';
import { builtinNames, completionLabels, pineReferences, refUrl } from './references/index';
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

const builtins = builtinNames();

connection.onInitialize((_params: InitializeParams) => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ['.', '_'],
      },
    },
  };
});

function wordAt(text: string, offset: number): { word: string; start: number; end: number } | null {
  if (offset < 0 || offset > text.length) return null;
  const isWordChar = (c: string) => /[\w.]/.test(c);
  let start = offset;
  if (start >= text.length) start = text.length - 1;
  if (!isWordChar(text[start])) return null;
  while (start > 0 && isWordChar(text[start - 1])) start--;
  let end = offset;
  while (end < text.length && isWordChar(text[end])) end++;
  const word = text.slice(start, end);
  if (!word) return null;
  return { word, start, end };
}

function validateDocument(doc: TextDocument): void {
  const text = doc.getText();
  const parsed = parseDocument(text);
  const issues = runRules(parsed, builtins);
  const diagnostics: Diagnostic[] = issues.map((issue) => ({
    range: issue.range,
    message: issue.message,
    severity: issue.severity,
    source: 'pineforge',
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
  const hit = wordAt(text, offset);
  if (!hit) return null;
  const ref = pineReferences[hit.word];
  if (!ref) return null;
  const url = refUrl(ref.path);
  return {
    contents: {
      kind: 'markdown',
      value: `**${hit.word}** (${ref.kind})\n\n${ref.summary}\n\n[TradingView reference](${url})`,
    },
  };
});

connection.onCompletion((): CompletionItem[] => {
  return completionLabels().map((label) => {
    const ref = pineReferences[label];
    return {
      label,
      kind: CompletionItemKind.Function,
      detail: ref?.summary,
      documentation: ref ? `${ref.summary}\n\n${refUrl(ref.path)}` : undefined,
    };
  });
});

documents.listen(connection);
connection.listen();
