import type { PineRefEntry } from './types';
import raw from './pine.json';

const REF_BASE = 'https://www.tradingview.com/pine-script-reference/v6/';

export const pineReferences: Record<string, PineRefEntry> = raw as Record<string, PineRefEntry>;

export function refUrl(path: string): string {
  return `${REF_BASE}${path.startsWith('#') ? path : `#${path}`}`;
}

export function builtinNames(): Set<string> {
  return new Set(Object.keys(pineReferences));
}

export function completionLabels(): string[] {
  return Object.keys(pineReferences).sort((a, b) => a.localeCompare(b));
}
