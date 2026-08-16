/** Strip markdown fences and trim so inline completion stays insertable. */
export function sanitizeModelInsertText(raw: string): string {
  let s = raw.trim();
  if (!s) return '';

  const fence = /^```(?:pine|pinescript)?\s*\n?([\s\S]*?)\n?```$/im;
  const m = s.match(fence);
  if (m?.[1]) s = m[1].trim();

  s = s.replace(/^```(?:pine|pinescript)?\s*/i, '').replace(/\s*```$/i, '');
  return s.trim();
}
