# TradingView errors / warnings vs PineForge

TradingView documents **runtime errors**, **compilation errors**, and **compiler warnings** in the [Pine Script® User Manual](https://www.tradingview.com/pine-script-docs) (*Errors and warnings*). That list is **not exhaustive** and evolves; PineForge cannot mirror every code path of TradingView’s closed-source compiler.

This page maps **well-known codes** to what PineForge can approximate **locally** (without executing your script on a chart).

| TV code | Topic | PineForge |
|--------|--------|-----------|
| **CE10101** | `if` / `switch` condition must be **bool** | **Information** hint `pine-forge/TV-CE10101` for a **bare** `if identifier` on one line (heuristic). Enable/disable with `pineForge.tradingViewManualHints`. Overlap with OHLC/`bar_index`/… is suppressed when `pineForge.strictImplicitBoolIf` is on (that rule emits `pine-forge/implicit-bool-cast` instead). |
| **CW10003** | History-dependent call should run every bar | **Not** implemented (needs scope + history semantics). |
| **RE10139** | Memory limits exceeded | **Not** detected statically. Optional rough context: `pineForge.limitationHints` may mention memory when **many** `request.*` sites are seen — see [tradingview-limitations.md](tradingview-limitations.md). |
| **RE10143** | Historical offset beyond buffer | **Not** implemented (runtime / buffer sizing). |

For **syntax** that TradingView rejects but a text scan can catch (e.g. multiple statements after `then` separated by `;`), see diagnostic `pine-forge/invalid-then-semicolon` and [README.md](../README.md) (*Syntax vs TradingView compiler*).
