import { DiagnosticSeverity } from 'vscode-languageserver/node';
import type { Range } from 'vscode-languageserver-types';

const VERSION_LINE = /^\s*\/\/@version\s*=\s*\d+/;
const DECL_LINE = /^\s*(?:export\s+)?(indicator|strategy|library)\s*\(/;
const METHOD_LINE = /^\s*(?:export\s+)?method\s+/;
const INPUT_ASSIGN =
  /^\s*([A-Za-z_][\w]*)\s*=\s*input\.(?:int|float|string|bool|color|text_area|timeframe|session|symbol|source|text)\s*\(/;

function lineRange(source: string, lineIndex: number): Range {
  const lines = source.split(/\r?\n/);
  const line = lines[lineIndex] ?? '';
  return {
    start: { line: lineIndex, character: 0 },
    end: { line: lineIndex, character: line.length },
  };
}

/**
 * Information-level hints aligned with TradingView’s Pine Script style guide (naming, ordering).
 * Line-based heuristics only — not a full formatter; enable with `pineForge.styleTradingViewHints`.
 */
export function collectTradingViewStyleHints(source: string, cap: number) {
  const issues: {
    code: string;
    message: string;
    range: Range;
    severity: typeof DiagnosticSeverity.Information;
  }[] = [];
  const lines = source.split(/\r?\n/);

  let versionLine = -1;
  let declLine = -1;
  let methodLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    if (VERSION_LINE.test(raw) && versionLine < 0) versionLine = i;
    if (DECL_LINE.test(raw) && declLine < 0) declLine = i;
    if (METHOD_LINE.test(raw) && methodLine < 0) methodLine = i;
  }

  const push = (code: string, message: string, range: Range): void => {
    if (issues.length >= cap) return;
    issues.push({
      code,
      message,
      range,
      severity: DiagnosticSeverity.Information,
    });
  };

  if (versionLine >= 0 && declLine >= 0 && declLine < versionLine) {
    push(
      'pine-forge/style-version-order',
      'TradingView style: put `//@version=` above `indicator()`, `strategy()`, or `library()` (after license comments).',
      lineRange(source, declLine),
    );
  }

  if (versionLine >= 30) {
    push(
      'pine-forge/style-version-depth',
      'TradingView style: keep `//@version=` near the top of the script (after the standard license header when applicable).',
      lineRange(source, versionLine),
    );
  }

  if (methodLine >= 0 && declLine >= 0 && methodLine < declLine) {
    push(
      'pine-forge/style-declaration-before-methods',
      'TradingView style: declare `indicator()` / `strategy()` / `library()` before user-defined `method` blocks when possible.',
      lineRange(source, methodLine),
    );
  }

  for (let i = 0; i < lines.length; i++) {
    if (issues.length >= cap) break;
    const raw = lines[i] ?? '';
    const t = raw.trim();
    if (t.startsWith('//')) continue;

    const im = INPUT_ASSIGN.exec(raw);
    if (!im) continue;
    const name = im[1];
    if (name.endsWith('Input')) continue;
    if (name === '_' || name.length <= 1) continue;

    push(
      'pine-forge/style-input-suffix',
      `TradingView style: consider suffixing inputs with \`Input\` (e.g. \`${name}Input\`) for clarity when used later in the script.`,
      lineRange(source, i),
    );
  }

  return issues;
}
