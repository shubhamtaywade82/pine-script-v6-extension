# PineForge (`pine-forge`)

**Vision:** An **all-in-one** Pine Script **v6** development tool for VS Code and Cursor — **LSP** (diagnostics, hover, completions, signature help, go-to-definition, find references, rename, document symbols), **linting** (syntax, scopes, types, v6 migration and domain rules), **formatting**, and **corrections** (code actions / quick fixes), all backed by a real parse and symbol model where possible.

**Reality today (0.1.x):** A **preview** on that path — not yet a full replacement for TradingView’s compiler or editor. TradingView remains the authority for final compile errors until grammar and semantics are aligned. What already works: language registration and **syntax highlighting**, LSP boot with **incremental sync**, **diagnostics** (version checks, a few v6 migration rules, unknown calls vs a curated [`src/references/pine.json`](src/references/pine.json)), **hover** and a **global completion list** for indexed symbols, plus a growing **lexer + tree parser** for richer call extraction when parsing succeeds.

See **[pinescript-extension.md](pinescript-extension.md)** for architecture, phased roadmap (formatter → code actions → symbols, etc.), and links to official Pine v6 docs.

## Develop

```bash
npm install
npm run compile
npm test
```

Open this folder in VS Code, then **Run → Start Debugging** (F5) with **Run PineForge Extension** (task: `npm: compile`). In the Extension Development Host, open a `.pine` file (e.g. `examples/demo.pine`).

### Command palette

- **Pine Script: Open v6 Reference Manual** — opens the TradingView v6 reference in the browser.

### Settings (`pineForge.*`)

| Setting | Default | Purpose |
|---------|---------|---------|
| `pineForge.enable` | `true` | Turn diagnostics on/off. |
| `pineForge.maxNumberOfProblems` | `100` | Cap diagnostics per file. |
| `pineForge.strictVersionCheck` | `true` | When enabled, warn if `//@version=` is missing; hints for versions other than 6. |

## Package

```bash
npm run package
```

Uses `publisher` from `package.json` (`shubhamtaywade82`). Adjust `repository.url` if the GitHub remote differs.

## Roadmap (high level)

| Next milestones | Notes |
|-----------------|--------|
| Symbols + go-to-definition / references | Scope table, declarations vs `pine.json` |
| Smarter completions | Context, arity hints from reference |
| Formatter | AST printer → `TextEdit[]`; separate from lint rules |
| Code actions | Quick fixes mapped from diagnostics |
| Broader grammar + types | Fewer false positives; v6-aware semantics |

Details: [pinescript-extension.md](pinescript-extension.md) § Implementation phases.
