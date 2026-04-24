import type { PineRefEntry } from './types';
import raw from './pine.json';
import overlay from './signatureOverlay.json';

const REF_BASE = 'https://www.tradingview.com/pine-script-reference/v6/';

export const pineReferences: Record<string, PineRefEntry> = raw as Record<string, PineRefEntry>;

export interface SignatureOverlayEntry {
  signature?: string;
  /** Markdown: parameter semantics, types, caveats. Shown in hovers when set. */
  documentation?: string;
  /** Shown after the kind, e.g. "+4 overloads" (TradingView-style header). */
  overloadHint?: string;
}

const signatureOverlay = overlay as Record<string, SignatureOverlayEntry>;

/** Curated short signatures (grow over time; see `signatureOverlay.json`). */
export function referenceSignature(name: string): string | undefined {
  return signatureOverlay[name]?.signature;
}

/** Extra hover body (Markdown) from `signatureOverlay.json` when curated. */
export function referenceDocumentation(name: string): string | undefined {
  const d = signatureOverlay[name]?.documentation;
  return d && d.trim() ? d.trim() : undefined;
}

export function referenceOverloadHint(name: string): string | undefined {
  const h = signatureOverlay[name]?.overloadHint;
  return h && h.trim() ? h.trim() : undefined;
}

export function refUrl(path: string): string {
  return `${REF_BASE}${path.startsWith('#') ? path : `#${path}`}`;
}

export function builtinNames(): Set<string> {
  return new Set(Object.keys(pineReferences));
}

export function completionLabels(): string[] {
  return Object.keys(pineReferences).sort((a, b) => a.localeCompare(b));
}
