import { CompletionItem, CompletionItemKind } from 'vscode-languageserver/node';
import { MarkupKind, SymbolKind } from 'vscode-languageserver-types';
import { collectDocumentSymbols } from '../analysis/documentSymbols';
import { completionLabels, pineReferences, refUrl } from '../references/index';

function flattenSymbols(
  syms: ReturnType<typeof collectDocumentSymbols>,
): { name: string; kind: SymbolKind }[] {
  const out: { name: string; kind: SymbolKind }[] = [];
  const walk = (nodes: typeof syms) => {
    for (const n of nodes) {
      out.push({ name: n.name, kind: n.kind });
      if (n.children?.length) walk(n.children);
    }
  };
  walk(syms);
  return out;
}

function matchesPrefix(label: string, prefixLower: string): boolean {
  if (!prefixLower) return true;
  const l = label.toLowerCase();
  return l.startsWith(prefixLower) || l.includes(`.${prefixLower}`);
}

const MAX_COMPLETIONS = 2500;

/**
 * Merges outline-derived user symbols with the bundled v6 index. User symbols sort first.
 */
export function buildCompletionItems(docText: string, prefixLower: string): CompletionItem[] {
  const seen = new Set<string>();
  const items: CompletionItem[] = [];

  for (const { name, kind } of flattenSymbols(collectDocumentSymbols(docText))) {
    if (!matchesPrefix(name, prefixLower)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    const isFn = kind === SymbolKind.Function;
    items.push({
      label: name,
      kind: isFn ? CompletionItemKind.Function : CompletionItemKind.Variable,
      detail: isFn ? 'User function (document symbols)' : 'User variable (document symbols)',
      sortText: `0_${name}`,
    });
  }

  for (const label of completionLabels()) {
    if (!matchesPrefix(label, prefixLower)) continue;
    if (seen.has(label)) continue;
    seen.add(label);
    const ref = pineReferences[label];
    items.push({
      label,
      kind: CompletionItemKind.Function,
      detail: ref?.summary ?? label,
      documentation: ref
        ? { kind: MarkupKind.Markdown, value: `${ref.summary}\n\n[TradingView v6](${refUrl(ref.path)})` }
        : undefined,
      sortText: `1_${label}`,
    });
  }

  return items.slice(0, MAX_COMPLETIONS);
}
