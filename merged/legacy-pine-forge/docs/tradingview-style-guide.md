# TradingView Pine style guide ↔ PineForge

This repo follows TradingView’s published Pine Script style recommendations where we can do so **deterministically** without pretending to be the compiler.

## What TradingView documents

Summary (see TradingView’s own docs for the full text):

- **Naming:** `camelCase` for most identifiers; **ALL_CAPS_SNAKE_CASE** for `const` constants; meaningful suffixes such as `Input` for `input.*` results.
- **Script layout:** license → `//@version=` → `indicator()` / `strategy()` / `library()` → imports → constants → inputs → functions → logic → strategy calls → visuals → alerts.
- **Spacing / wrapping:** spaces around binary operators (except unary `-`); line-wrapping rules (avoid multiples of four spaces outside parentheses, etc.).

## What PineForge implements today

| Style area | In PineForge |
|------------|----------------|
| Version + v6 migration | Diagnostics (`strictVersionCheck`, unknown calls, `transp` / `when`, bool `na`, optional bare `if` series — see settings). |
| **Optional style hints** | Setting **`pineForge.styleTradingViewHints`**: *Information* diagnostics for a few line-based checks (ordering of `//@version=` vs declaration, very late `//@version=`, `method` before declaration, `input.*` LHS not ending in `Input`). **Heuristic only** — disable if noisy. |
| Full naming (camelCase / SNAKE for every binding) | **Not** enforced (would need full AST + type/`const` qualification; high false-positive rate). |
| Section grouping / vertical alignment | **Not** enforced (editor formatter is whitespace-only today). |
| Operator spacing / wrap layout | **Not** auto-fixed in **Format Document** (would need a real pretty-printer). |

## Enabling style hints

```json
"pineForge.styleTradingViewHints": true
```

Treat hints as advisory; TradingView remains authoritative for compile errors and semantics.

For **compile/runtime/plot/request limits** on the TradingView servers, see **[tradingview-limitations.md](tradingview-limitations.md)** and optional `pineForge.limitationHints`.
