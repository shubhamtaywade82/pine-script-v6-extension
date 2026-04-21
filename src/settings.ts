export const PINE_FORGE_SETTINGS_NOTIFICATION = 'pineForge/settings';

export interface PineForgeSettings {
  enable: boolean;
  maxNumberOfProblems: number;
  strictVersionCheck: boolean;
  /**
   * When true, flags bare `if close`-style conditions (series used as bool) only when the
   * condition is obviously a single identifier on the same line (conservative).
   */
  strictImplicitBoolIf: boolean;
  /**
   * When true, emit **Information** hints for common TradingView Pine style guide conventions
   * (script ordering, `Input` suffix on `input.*` assignments). Heuristic only — not exhaustive.
   */
  styleTradingViewHints: boolean;
  /**
   * When true, emit **Information** hints for TradingView **platform** limits we can only approximate
   * locally (plot-count upper bound, many `request.*` call sites). See docs/tradingview-limitations.md.
   */
  limitationHints: boolean;
}

export const defaultPineForgeSettings: PineForgeSettings = {
  enable: true,
  maxNumberOfProblems: 100,
  strictVersionCheck: true,
  strictImplicitBoolIf: false,
  styleTradingViewHints: false,
  limitationHints: false,
};
