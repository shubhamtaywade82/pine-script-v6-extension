# Claude Code hooks (TradersPost pine agents + MCP)

These scripts are adapted from [TradersPost/pinescript-agents](https://github.com/TradersPost/pinescript-agents) for this repo’s layout:

- User Pine scripts: repo-root `*.pine`, optional `projects/`, or `scripts/*.pine`
- Vendored docs: `vendor/pinescript-agents/docs/` (not top-level `docs/`)
- No `./start` launcher; use `start` prompt → workspace summary (see `user-prompt-submit.sh`)

Requires a POSIX shell (e.g. Git Bash on Windows) for Claude Code hook execution.
