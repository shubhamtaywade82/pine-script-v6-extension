# TradingView Pine limitations ↔ PineForge

TradingView enforces **cloud-side** limits (compile time, execution time, memory, plot counts, `request.*()` budgets, IL tokens, etc.). PineForge runs in your editor and **cannot** measure TV resource usage or reproduce runtime limits exactly.

This page summarizes the **platform** limits (from TradingView’s documentation) and what PineForge can optionally **hint** about locally.

## Time and execution (TradingView)

| Limit | Typical value (check current TV docs) |
|--------|----------------------------------------|
| Script **compilation** | ~2 minutes per compile; repeated timeouts can lead to temporary compile restrictions. |
| Script **execution** (all bars) | ~20s (basic) / ~40s (other tiers) — varies by account. |
| **Loop** per bar | ~500 ms per outer loop on a single bar. |

PineForge does **not** estimate execution time or loop time.

## Chart visuals (TradingView)

| Limit | Notes |
|--------|--------|
| **Plot count** | Max **64** “plot counts” per script from `plot`, `plotarrow`, `plotbar`, `plotcandle`, `plotchar`, `plotshape`, `alertcondition`, `bgcolor`, `barcolor`, and `fill` (series color). A single call can consume **up to ~7** counts (`plotcandle` with dynamic series on several color args). `hline`, `line.new`, `label.new`, `table.new`, `box.new` do **not** add plot counts. |
| **Drawings** | Defaults (e.g. last **50** labels/lines/boxes); declaration `max_*_count` caps; max **500** ids for line/box/label, **100** for polylines. |
| **Tables** | Max **9** (one per fixed position). |

**PineForge (optional):** with `pineForge.limitationHints`, we sum a **worst-case upper bound** of plot counts from parsed `plot*` / `fill` / etc. calls and emit an **Information** diagnostic when the estimate exceeds **56** (early warning before 64). This **over-counts** when your arguments are not all series-colored — treat it as a rough guide only.

## `request.*()` (TradingView)

| Limit | Notes |
|--------|--------|
| **Unique** `request.*()` calls | **40** (typical) / **64** (Ultimate); identical calls dedupe; library-embedded calls count too. |
| **Tuple** elements across all `request.*()` | Max **127** (use UDTs to pack more). |
| **Intrabars** | Plan-dependent caps (e.g. 100K–200K lower-TF bars). |

**PineForge (optional):** if there are **many** `request.*` **call sites** in the file, we emit a **generic** Information hint — we do **not** prove uniqueness of arguments (that requires TradingView’s runtime).

## Script size and memory (TradingView)

| Limit | Notes |
|--------|--------|
| Compiled **IL tokens** per script | **100,000**; imported libraries share a **1M** token pool across imports. |
| **Compilation request** size | **5 MB** (includes full imported libraries). |
| **Variables per scope** | **1,000** per scope (global + each local block). |
| **Collections** | **100,000** elements (maps count key+value as two elements → max **50,000** pairs). |

PineForge does **not** count IL tokens or request payload size.

## Other (TradingView)

- **`alertcondition` (CE10123):** `title` and `message` must be **const string** — not expressions that become **series string** (for example `"text" + str.tostring(close)`). PineForge flags non-const-looking `title` / `message` arguments locally (`pine-forge/alertcondition-*-not-const`).
- **History reference** `[]`: often **5,000** bars (some builtins **10,000**); `max_bars_back` can adjust.
- **Bars forward** with `xloc.bar_index`: **500** max.
- **Strategy** backtest orders: **9,000** (Deep backtesting much higher).

## Official source

Always verify numbers on TradingView’s own **Limitations** / **Welcome** documentation; limits and plans change over time.
