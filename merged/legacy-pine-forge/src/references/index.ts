import type { PineParam, PineRefEntry } from './types';
import raw from './pine.json';
import overlay from './signatureOverlay.json';

const REF_BASE = 'https://www.tradingview.com/pine-script-reference/v6/';

export const pineReferences: Record<string, PineRefEntry> = raw as Record<string, PineRefEntry>;

export interface SignatureOverlayEntry {
  signature?: string;
  /** Markdown prose shown in hovers (overrides scraped description + params). */
  documentation?: string;
  /** Shown after the kind, e.g. "+4 overloads". */
  overloadHint?: string;
  params?: PineParam[];
  returns?: string;
  example?: string;
  remarks?: string;
}

const signatureOverlay = overlay as Record<string, SignatureOverlayEntry>;

export function referenceSignature(name: string): string | undefined {
  const o = signatureOverlay[name];
  if (o?.signature) return o.signature;
  const r = pineReferences[name];
  return r?.syntax?.[0];
}

export function referenceDocumentation(name: string): string | undefined {
  const d = signatureOverlay[name]?.documentation;
  return d && d.trim() ? d.trim() : undefined;
}

export function referenceOverloadHint(name: string): string | undefined {
  const h = signatureOverlay[name]?.overloadHint;
  if (h && h.trim()) return h.trim();
  const syns = pineReferences[name]?.syntax;
  if (syns && syns.length > 1) return `+${syns.length - 1} overload${syns.length > 2 ? 's' : ''}`;
  return undefined;
}

export function referenceParams(name: string): PineParam[] | undefined {
  return signatureOverlay[name]?.params ?? pineReferences[name]?.params;
}

export function referenceReturns(name: string): string | undefined {
  return signatureOverlay[name]?.returns ?? pineReferences[name]?.returns;
}

export function referenceExample(name: string): string | undefined {
  return signatureOverlay[name]?.example ?? pineReferences[name]?.example;
}

export function referenceRemarks(name: string): string | undefined {
  return signatureOverlay[name]?.remarks ?? pineReferences[name]?.remarks;
}

export function referenceDescription(name: string): string | undefined {
  const r = pineReferences[name];
  return r?.description;
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
