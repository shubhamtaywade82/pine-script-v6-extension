/**
 * Deterministic whitespace cleanup (not a full Pine pretty-printer).
 * Trims trailing spaces, normalizes tabs to spaces, ensures newline at EOF.
 */
export function formatPineSource(text: string, tabSize: number): string {
  const ts = Math.max(1, Math.min(12, tabSize));
  const lines = text.split('\n');
  const cleaned = lines.map((line) => line.replace(/\t/g, ' '.repeat(ts)).replace(/\s+$/, ''));
  let out = cleaned.join('\n');
  if (!out.endsWith('\n')) out += '\n';
  return out;
}
