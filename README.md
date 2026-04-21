# Pine Script v6 Linter (`pine-v6-linter`)

LSP-backed VS Code / Cursor extension for **Pine Script v6**: diagnostics, hover docs, completions, and links into TradingView’s [language reference](https://www.tradingview.com/pine-script-reference/v6/).

This is an **early MVP** — not a full Pine compiler. TradingView remains the authority for compile errors. See [pinescript-extension.md](pinescript-extension.md) for architecture and roadmap.

## Develop

```bash
npm install
npm run compile
npm test
```

Open this folder in VS Code, then **Run → Start Debugging** (F5) with **Run PineForge Extension** (task: `npm: compile`). In the Extension Development Host, open a `.pine` file (e.g. `examples/demo.pine`).

### Command palette

- **Pine Script: Open v6 Reference Manual** — opens the TradingView v6 reference in the browser.

### Settings (`pineV6.*`)

| Setting | Default | Purpose |
|---------|---------|---------|
| `pineV6.enable` | `true` | Turn diagnostics on/off. |
| `pineV6.maxNumberOfProblems` | `100` | Cap diagnostics per file. |
| `pineV6.strictVersionCheck` | `true` | When enabled, warn if `//@version=` is missing; hints for versions other than 6. |

## Package

```bash
npm run package
```

Uses `publisher` from `package.json` (`shubhamtaywade82`). Adjust `repository.url` if the GitHub remote differs.

## Current behavior

- Lexer-based scan for `//@version=` and `identifier(` calls (including dotted names like `ta.sma`).
- Full structural **AST type definitions** live in [`src/ast.ts`](src/ast.ts) for future parser work.
- Warns on unknown calls vs [`src/references/pine.json`](src/references/pine.json); hover/completion for indexed symbols.

## Roadmap

Scopes, types, arity, migration rules, formatter — see [pinescript-extension.md](pinescript-extension.md).
