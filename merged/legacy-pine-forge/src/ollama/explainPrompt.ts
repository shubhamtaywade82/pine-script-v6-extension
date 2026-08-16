const PREAMBLE = `You are helping with TradingView Pine Script v6. TradingView is authoritative for compiler errors; give practical guidance and cite uncertainty where needed.

`;

export function explainSelectionUserMessage(selection: string, fileLabel: string): string {
  const trimmed = selection.trim();
  const loc = fileLabel ? `File: ${fileLabel}\n\n` : '';
  return `${PREAMBLE}${loc}Selected Pine Script:\n\`\`\`pine\n${trimmed}\n\`\`\`\n\nExplain or answer questions about this code.`;
}
