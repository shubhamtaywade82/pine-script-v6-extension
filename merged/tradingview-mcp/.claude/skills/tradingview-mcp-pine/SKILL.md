---
name: tradingview-mcp-pine
description: Connects Pine Script authoring in this repo with TradingView Desktop via the tradingview-mcp bridge. Use when the user wants to compile Pine in TradingView, sync editor code, read compile errors or console logs, save to TradingView cloud, or use chart/replay tools while editing .pine files in tradingview-mcp.
---

# TradingView MCP + Pine Script

## When this applies

The workspace is **tradingview-mcp** (or the user enabled its MCP server). TradingView Desktop runs with CDP on `localhost:9222`.

## Pine workflow (MCP tools)

Follow detailed tool selection in repo root `CLAUDE.md`. Typical loop:

1. **`pine_set_source`** — push code into the Pine editor.
2. **`pine_smart_compile`** — compile with auto-detection and error check.
3. **`pine_get_errors`** / **`pine_get_console`** — read diagnostics and `log.info()` output.
4. **`pine_save`** — save to TradingView cloud when requested.

Avoid **`pine_get_source`** on huge scripts unless necessary (large payload).

## Pair with pinescript-agents skills

Use the copied **pine-developer**, **pine-debugger**, **pine-visualizer**, **pine-backtester**, **pine-optimizer**, **pine-publisher**, and **pine-manager** skills for how to write, debug, and structure Pine v6. Use **this** skill to remember MCP is available for live iteration.

## Reference material in-repo

- Pine v6 notes and guides: `vendor/pinescript-agents/docs/` (especially `pinescript-v6/`).
- Optional scripts: `scripts/pine_push.js`, `scripts/pine_pull.js` (CDP helpers; MCP is usually preferred).
