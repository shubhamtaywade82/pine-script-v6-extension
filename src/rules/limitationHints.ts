import { DiagnosticSeverity } from 'vscode-languageserver/node';
import type { Range } from 'vscode-languageserver-types';
import type { ParsedDocument } from '../parser/parser';

/**
 * Worst-case plot counts per call (TradingView docs — upper bound when series are passed
 * to color/wick/border etc.). Used only for a rough aggregate hint.
 */
const PLOT_COUNT_UPPER: Record<string, number> = {
  plot: 2,
  plotarrow: 3,
  plotbar: 5,
  plotcandle: 7,
  plotchar: 3,
  plotshape: 3,
  alertcondition: 1,
  bgcolor: 1,
  barcolor: 1,
  fill: 2,
};

export function collectLimitationHints(parsed: ParsedDocument, cap: number) {
  const issues: {
    code: string;
    message: string;
    range: Range;
    severity: typeof DiagnosticSeverity.Information;
  }[] = [];

  const push = (code: string, message: string, range: Range): void => {
    if (issues.length >= cap) return;
    issues.push({ code, message, range, severity: DiagnosticSeverity.Information });
  };

  let plotUpper = 0;
  let plotMarkerRange: Range | undefined;
  let requestSites = 0;
  let requestMarkerRange: Range | undefined;

  for (const node of parsed.nodes) {
    if (node.kind !== 'call') continue;
    const { name, range } = node;

    const p = PLOT_COUNT_UPPER[name];
    if (p) {
      plotUpper += p;
      if (plotUpper > 56 && !plotMarkerRange) plotMarkerRange = range;
    }

    if (name.startsWith('request.')) {
      requestSites += 1;
      if (requestSites > 32 && !requestMarkerRange) requestMarkerRange = range;
    }
  }

  if (plotMarkerRange) {
    push(
      'pine-forge/limit-plot-budget-est',
      `Rough upper-bound plot-count estimate is ~${plotUpper} (TradingView max is 64). Actual counts depend on series vs const arguments — see docs/tradingview-limitations.md.`,
      plotMarkerRange,
    );
  }

  if (requestMarkerRange) {
    push(
      'pine-forge/limit-request-density',
      `Many request.*() call sites (${requestSites}+). TradingView limits **unique** request.*() calls (often 40, or 64 on Ultimate); identical calls can dedupe — library calls count too. PineForge cannot verify uniqueness — see docs/tradingview-limitations.md.`,
      requestMarkerRange,
    );
  }

  return issues;
}
