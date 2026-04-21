# PineForge (`pine-forge`)

**Vision:** An **all-in-one** Pine Script **v6** development tool for VS Code and Cursor — LSP, linting, formatting, and corrections backed by parsing and the official v6 reference where possible.

**Shipped in 0.2.x**

| Feature | Notes |
|---------|--------|
| Diagnostics | Version checks, unknown calls vs [`src/references/pine.json`](src/references/pine.json), v6 migration rules (`transp`, `when`, `na`/bool); optional **bare `if` series** check via `pineForge.strictImplicitBoolIf` |
| Hover | Markdown + TradingView link for indexed symbols |
| Completions | Prefix filter; **user symbols** (outline) merged with bundled v6 index (users sort first) |
| Go to definition | For indexed symbols → **official v6 reference URL** (external location) |
| Find references / highlight | Same-file; skips strings/comments; **UDF parameters** scoped to that function’s range |
| Outline / document symbols | From structural [`parseProgram`](src/parser/treeParser.ts) AST (`var`, `method` / UDFs, nested blocks) |
| Workspace symbol | Search open documents by symbol name |
| Signature help | Summary + doc link; **curated signatures** from `signatureOverlay.json` when present |
| Rename | `prepareRename` + workspace edit for **non-built-in** names; same-file, best-effort |
| Format document | Trim trailing whitespace, tabs → spaces, newline at EOF — **not** a full Pine pretty-printer |
| Code actions | Insert/set `//@version=6`; starter removal for deprecated `transp` |

**Limits (honest)**

- TradingView’s compiler is still **authoritative** for full syntax, types, and runtime errors.
- Formatter does **not** re-indent Pine blocks from grammar rules yet.
- Rename / references do **not** understand full scoping; avoid renaming names that collide with built-ins.

See **[pinescript-extension.md](pinescript-extension.md)** for architecture and deeper roadmap (semantic tokens, arity from reference, **AST indent printer**, etc.).

**CI:** every `push` and `pull_request` runs `.github/workflows/ci.yml` (`npm ci`, compile, test).

### Publishing checklist

- Add **`images/icon.png`** (128×128) and set `"icon": "images/icon.png"` in `package.json` for the Marketplace.
- `vsce login` → `npm run package` → `vsce publish` (or attach the VSIX to a GitHub Release).
- Grow **`src/references/signatureOverlay.json`** (or generated data) for better signatures without bloating `pine.json`.

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
| `pineForge.strictImplicitBoolIf` | `false` | When `true`, warns on **bare** `if close`-style series-as-bool (same line only; skips comments, comparisons, and `[` tails). Off by default to limit false positives. |

## Package

```bash
npm run package
```

Uses `publisher` from `package.json` (`shubhamtaywade82`). Adjust `repository.url` if the GitHub remote differs. See [CHANGELOG.md](CHANGELOG.md) for release notes.
