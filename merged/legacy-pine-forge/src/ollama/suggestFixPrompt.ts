export function suggestFixUserMessage(
  selection: string,
  fileLabel: string,
  diagnosticLines: string[],
): string {
  const loc = fileLabel ? `File: ${fileLabel}\n\n` : '';
  const diags =
    diagnosticLines.length > 0
      ? `Diagnostics in this range:\n${diagnosticLines.map((d) => `- ${d}`).join('\n')}\n\n`
      : '';
  return `You assist with TradingView Pine Script v6. TradingView is authoritative for compiler errors.

${loc}${diags}Suggest a concrete fix or improved version for the following code. Prefer minimal, idiomatic Pine v6. If uncertain, say so.

\`\`\`pine
${selection.trim()}
\`\`\``;
}
