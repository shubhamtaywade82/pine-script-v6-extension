export function inlineContinuationUserMessage(prefix: string, suffix: string): string {
  const p = prefix.trimEnd();
  const suf = suffix.trimEnd();
  return `You assist with TradingView Pine Script v6.

The caret is at the end of "prefix" below. Output ONLY the text that should be inserted immediately after the prefix to continue the program (no markdown fences, no commentary, no labels). If nothing sensible to add, output an empty response.

--- prefix ---
${p}
--- end prefix ---

--- suffix (text after caret on same line / following lines; may be empty) ---
${suf}
--- end suffix ---`;
}
