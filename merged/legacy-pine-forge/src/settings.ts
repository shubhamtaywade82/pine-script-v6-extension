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
  /**
   * When true, emit **Information** hints aligned with the TradingView User Manual *Errors and warnings*
   * overview (e.g. **CE10101**-style bare `if identifier` on one line). Heuristic only — not a type checker;
   * see docs/tradingview-errors-overview.md.
   */
  tradingViewManualHints: boolean;
  /**
   * Reserved for additional series/scalar and type-aware hints built on the inference pass.
   * Core AST rules (e.g. bool/`na`) always run regardless of this flag.
   */
  semanticTypeHints: boolean;
  /**
   * When true, emit repaint / future-data **warnings** from static analysis (`request.security` lookahead,
   * negative history on OHLC-like series). Off by default to limit noise.
   */
  repaintHints: boolean;
}

export const defaultPineForgeSettings: PineForgeSettings = {
  enable: true,
  maxNumberOfProblems: 100,
  strictVersionCheck: true,
  strictImplicitBoolIf: false,
  styleTradingViewHints: false,
  limitationHints: false,
  tradingViewManualHints: true,
  semanticTypeHints: true,
  repaintHints: false,
};
