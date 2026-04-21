export function refactorSelectionUserMessage(selection: string, fileLabel: string, instruction: string): string {
  const loc = fileLabel ? `File: ${fileLabel}\n\n` : '';
  return `You assist with TradingView Pine Script v6.

${loc}User instruction: ${instruction.trim()}

Rewrite or adjust the following Pine Script accordingly. Explain briefly, then give the full revised snippet in a single \`\`\`pine fenced block.

\`\`\`pine
${selection.trim()}
\`\`\``;
}
