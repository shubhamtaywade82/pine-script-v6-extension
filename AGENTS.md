## Learned User Preferences

- When adding Pine Script support from upstream, prefer vendoring skills plus documentation into this repo rather than assuming an external checkout of pinescript-agents.

## Learned Workspace Facts

- Pine Script skills live under `.cursor/skills/` (Cursor) and `.claude/skills/` (Claude Code mirror): `pine-developer`, `pine-debugger`, `pine-visualizer`, `pine-backtester`, `pine-optimizer`, `pine-publisher`, `pine-manager` (from TradersPost/pinescript-agents), plus `tradingview-mcp-pine` for MCP-driven compile/sync workflows. Hooks live under `.claude/hooks/`; refresh docs + mirror with `npm run sync:pinescript-agents`.
- Bundled Pine v6 and workflow docs are under `vendor/pinescript-agents/docs/`; skills reference those paths instead of upstream `/docs/...`.
- Project workflow in skills was adapted for this repo: use workspace `*.pine` files; the upstream `/projects/blank.pine` rotation is not part of this layout.
- Security posture for automation: `ui_evaluate` runs arbitrary JavaScript in the TradingView page via CDP; combined with MCP access and localhost CDP, treat the stack as a trusted-local controller (see `SECURITY.md`).
