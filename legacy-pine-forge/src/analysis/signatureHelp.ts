/**
 * Callee name for signature help: last `ident(` before cursor on the same logical prefix.
 * Fails when arguments contain nested `(` — acceptable for a first pass.
 */
export function calleeBeforeOpenParen(text: string, offset: number): string | null {
  const head = text.slice(0, offset);
  const m = head.match(/([\w.]+)\s*\([^)]*$/);
  return m ? m[1] : null;
}
