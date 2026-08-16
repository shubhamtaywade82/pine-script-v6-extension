# Pine agents + TradingView MCP

This repository integrates **[TradersPost/pinescript-agents](https://github.com/TradersPost/pinescript-agents)** (MIT) with the **TradingView MCP** bridge.

- **Claude Code skills**: `.claude/skills/` (mirrors `.cursor/skills/` for Cursor).
- **Bundled Pine v6 docs**: `vendor/pinescript-agents/docs/`.
- **MCP tools** (chart, Pine editor, replay): see repo root `CLAUDE.md` and `README.md`.

Refresh documentation from upstream:

```bash
npm run sync:pinescript-agents
```

For the full upstream onboarding narrative, see the original project’s `CLAUDE.md` and `.claude/onboarding.md` in [TradersPost/pinescript-agents](https://github.com/TradersPost/pinescript-agents).
