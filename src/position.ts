import type { Position } from 'vscode-languageserver-types';

export function offsetToPosition(text: string, offset: number): Position {
  const safe = Math.max(0, Math.min(offset, text.length));
  const slice = text.slice(0, safe);
  const lines = slice.split('\n');
  const line = lines.length - 1;
  const character = lines[lines.length - 1].length;
  return { line, character };
}
