/** Minimal Pine static type shape for editor-time inference (not TradingView parity). */

export type PineBaseKind = 'float' | 'int' | 'bool' | 'string' | 'color' | 'unknown';

export interface InferredType {
  base: PineBaseKind;
  /** True when the value may vary bar-to-bar (series semantics). */
  isSeries: boolean;
}

export const UNKNOWN_SERIES: InferredType = { base: 'unknown', isSeries: true };

export function literalType(
  kind: 'float' | 'int' | 'bool' | 'string' | 'color',
  isSeries = false,
): InferredType {
  return { base: kind, isSeries };
}

export function unify(a: InferredType, b: InferredType): InferredType {
  const base = dominantBase(a.base, b.base);
  return { base, isSeries: a.isSeries || b.isSeries };
}

function dominantBase(x: PineBaseKind, y: PineBaseKind): PineBaseKind {
  if (x === y) return x;
  if (x === 'unknown') return y;
  if (y === 'unknown') return x;
  if ((x === 'int' && y === 'float') || (x === 'float' && y === 'int')) return 'float';
  return 'unknown';
}
