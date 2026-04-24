# PineForge (`pine-forge`)

**Vision:** An **all-in-one** Pine Script **v6** development tool for VS Code and Cursor — LSP, linting, formatting, and corrections backed by parsing and the official v6 reference where possible.

**Shipped in 0.2.x**

| Feature | Notes |
|---------|--------|
| Diagnostics | Version checks, unknown calls vs [`src/references/pine.json`](src/references/pine.json), v6 migration rules (`transp`, `when`, `na`/bool); **`alertcondition`** `title` / `message` must be **const string** (TradingView **CE10123**); optional **bare `if` series** via `pineForge.strictImplicitBoolIf`; **TV manual hints** (`pineForge.tradingViewManualHints`, e.g. **CE10101** bare `if ident`) — [docs/tradingview-errors-overview.md](docs/tradingview-errors-overview.md); **structural parse errors**; **surface syntax** (illegal `then` + `;`) |
| Hover | Markdown: curated **signature** + optional **inline docs** from [`signatureOverlay.json`](src/references/signatureOverlay.json) (where present), else one-line summary from the v6 index + **TradingView** link |
| Completions | Prefix filter; **user symbols** (outline) merged with bundled v6 index (users sort first) |
| Go to definition | For indexed symbols → **official v6 reference URL** (external location) |
| Find references / highlight | Same-file; skips strings/comments; **UDF parameters** scoped to that function’s range |
| Outline / document symbols | From structural [`parseProgram`](src/parser/treeParser.ts) AST (`var`, `method` / UDFs, nested blocks) |
| Workspace symbol | Search open documents by symbol name |
| Signature help | Summary + doc link; **curated signatures** from `signatureOverlay.json` when present |
| Rename | `prepareRename` + workspace edit for **non-built-in** names; same-file, best-effort |
| Format document | Trim trailing whitespace, tabs → spaces, newline at EOF — **not** a full Pine pretty-printer |
| Code actions | Insert/set `//@version=6`; starter removal for deprecated `transp` |
| Ollama (optional) | Explain / suggest fix / refactor / cursor ask; **inline ghost text**; optional **completion list** + **refactor** code action — all via [`ollama`](https://github.com/ollama/ollama-js) in the **extension host only** (never the LSP server) |
| TradingView style hints (optional) | `pineForge.styleTradingViewHints`: *Information* diagnostics for a few [style-guide](docs/tradingview-style-guide.md) conventions (ordering, `Input` suffix on `input.*`); not a full linter for naming/spacing |
| TradingView **limits** hints (optional) | `pineForge.limitationHints`: *Information* hints for [platform limits](docs/tradingview-limitations.md) we can only approximate locally (plot-count **upper bound**, many `request.*` call sites) — not runtime or TV-accurate counts |

**Limits (honest)**

- TradingView’s compiler is still **authoritative** for full syntax, types, and runtime errors. PineForge does **not** embed TradingView’s grammar and cannot guarantee **bit-for-bit parity** with every compile-time diagnostic. Official language references: [Pine Script® docs](https://www.tradingview.com/pine-script-docs) and [Pine Script® v6 language reference](https://www.tradingview.com/pine-script-reference/v6/).
- **Cloud limits** (compile time, execution budget, plot counts, `request.*()` uniqueness, IL size, etc.) are enforced only on TradingView. See **[docs/tradingview-limitations.md](docs/tradingview-limitations.md)** for a summary; enable **`pineForge.limitationHints`** for rough editor hints where we can approximate (not a substitute for TV’s runtime).
- **What we add:** recoverable **structural parse** messages from PineForge’s own lexer/AST pipeline, plus small **surface checks** aligned with common TV rejections (starting with illegal `;` after `then` / `else then` on the same line). Coverage will grow incrementally; it will never be “every possible TV error” without their closed-source compiler.
- Formatter does **not** re-indent Pine blocks from grammar rules yet.
- Rename / references do **not** understand full scoping; avoid renaming names that collide with built-ins.

**`pineForge.maxNumberOfProblems`** applies to the **combined** list (structural parse + surface rules + reference-backed rules), ordered with structural/surface issues first so they are less likely to be dropped when the cap is low.

See **[pinescript-extension.md](pinescript-extension.md)** for architecture and deeper roadmap (semantic tokens, arity from reference, **AST indent printer**, etc.).

**CI:** every `push` and `pull_request` runs `.github/workflows/ci.yml` (`npm ci`, compile, unit tests, xvfb e2e, then `npm run package` to validate the production VSIX).

### Publishing checklist

- **`images/icon.png`** (128×128) and **`"icon": "images/icon.png"`** are set for Marketplace listing.
- **`npm run package`** runs **`vscode:prepublish`** → **`build:prod`** (esbuild bundles `dist/extension.js` + `dist/server.js`; dev workflow still uses **`npm run compile`** + watch).
- `vsce login` → `npm run package` → `vsce publish` (or attach the VSIX to a GitHub Release).
- Grow **`src/references/signatureOverlay.json`** (or generated data) for better signatures without bloating `pine.json`.

## Develop

```bash
npm install
npm run compile
npm test
# VS Code integration tests (downloads VS Code once under .vscode-test/; use xvfb on Linux headless)
# Opens src/test/fixtures/workspace — full LSP + settings e2e: diagnostics (rules above), references/highlights, signature help, rename, QuickFixes, document & range format, completions, hover, definition, workspace & document symbols; all contributed commands registered
npm run test:e2e
# Optional: same bundle as Marketplace VSIX (overwrites dist/ with two minified files)
npm run build:prod
```

Open this folder in VS Code, then **Run → Start Debugging** (F5) with **Run PineForge Extension** (task: `npm: compile`). In the Extension Development Host, open a `.pine` file (e.g. `examples/demo.pine`).

For day-to-day edits, run **`npm: watch`** (background TypeScript watch) from **Tasks: Run Task** so `dist/` stays current while you F5.

**Debug the language server:** Launch config **`autoAttachChildProcesses`** (see [VS Code Extension API](https://code.visualstudio.com/api)) lets the debugger step into the LSP child process when breakpoints are set in `src/server.ts`. Alternatively, start **Extension + Server (manual attach)** (compound): the server listens on **`127.0.0.1:6009`** in debug mode; if **`Starting inspector … address already in use`**, stop the Extension Host or change the port in `src/extension.ts` (`serverOptions.debug.options`) and `.vscode/launch.json` together.

**Reference samples:** Microsoft’s **[vscode-extension-samples](https://github.com/microsoft/vscode-extension-samples)** repo and the **[Language Server Extension Guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)** mirror patterns used here (client + server, `preLaunchTask`, packaging). PineForge does not vendor that repo; compare when adding new LSP capabilities.

**LSP log channel:** **View → Output → PineForge LSP** shows client/server traffic; it is revealed automatically on **Error** severity (`revealOutputChannelOn`).

**Language server lifecycle:** PineForge uses **`vscode-languageclient`** with **IPC** — each extension host starts **one** child process (`dist/server.js`) for that window. The client does not probe the machine for “an existing PineForge server” to attach to; that would mean a **socket-based** server you start yourself and optional `TransportKind.socket`, which is a different deployment model. On `deactivate`, the client is stopped and the module clears its reference so a later activation can construct a fresh client.

### `.pine` files and language mode

With **PineForge installed** (or loaded via F5), VS Code maps **`*.pine`** and **`*.pinescript`** to the **`pinescript`** language id via `contributes.languages` in `package.json`. That applies grammar, `language-configuration.json`, and activates the extension for those files (VS Code derives activation from the language contribution).

The extension also contributes **`configurationDefaults`** so **`files.associations`** pins `*.pine` / `*.pinescript` → **`pinescript`** when you have not set your own association (helps when the status bar showed **Plain Text** or another extension claimed the extension).

**Manual override:** status bar language mode → **Configure File Association for `'.pine'`…** → choose **Pine Script**, or in `settings.json`:

```json
"files.associations": {
  "*.pine": "pinescript",
  "*.pinescript": "pinescript"
}
```

This repo includes [`.vscode/settings.json`](.vscode/settings.json) with the same mapping for local development.

### Command palette

- **Pine Script: Open v6 Reference Manual** — opens the TradingView v6 reference in the browser.
- **PineForge: Explain selection with Ollama** — sends the current selection to your Ollama host; replies go to **View → Output → PineForge AI** (also in the editor context menu for Pine files).
- **PineForge: Suggest fix with Ollama (selection or line)** — uses the selection if non-empty, otherwise the **current line**; includes **diagnostic messages** that overlap that range when available.
- **PineForge: Refactor selection with Ollama** — prompts for a short instruction, then sends the selection plus that instruction to the model (output channel).
- **PineForge: Ask Ollama at cursor (output channel)** — same **prefix/suffix window** around the cursor as inline AI (see `pineForge.ollama.inlineContextLines`); useful when inline completions are off or you want a full reply in the channel.
- **PineForge: Suggest fix for range (Ollama)** — intended for the **lightbulb** code action; if you run it from the palette with no arguments, it behaves like **Suggest fix** on the active selection or line.
- **PineForge: Set / Clear Ollama API key** — stores a **Bearer** token in VS Code **Secret Storage** (for `https://ollama.com` or any host that requires auth). Keys are never written to `settings.json`.

### Ollama (optional AI)

**Master switch:** `pineForge.ollama.enabled` defaults to **`true`**. **`pineForge.ollama.model`** defaults to **`qwen3.5:4b`** (override if you use another local or cloud model).

| Setting | Default | Purpose |
|---------|---------|---------|
| `pineForge.ollama.enabled` | `true` | Turn on Ollama-backed features (commands, optional inline/list/lightbulb). |
| `pineForge.ollama.host` | `http://127.0.0.1:11434` | Local Ollama, or `https://ollama.com` for cloud. |
| `pineForge.ollama.model` | `qwen3.5:4b` | Model id for local Ollama or a cloud model name (`ollama.com`). |
| `pineForge.ollama.stream` | `true` | Stream tokens into the **PineForge AI** output channel for **command**-driven chats (inline completions always use a single non-streaming request). |
| `pineForge.ollama.inlineCompletions` | `true` | **Ghost-text** suggestions at the cursor (separate from LSP symbol completions). |
| `pineForge.ollama.inlineDebounceMs` | `400` | Wait after typing before requesting inline AI (`0` = no debounce). |
| `pineForge.ollama.inlineContextLines` | `40` | Lines of document **before** / **after** the cursor included in inline and “Ask at cursor” prompts. |
| `pineForge.ollama.inlineMaxPromptChars` | `12000` | Cap on combined prefix+suffix size for inline requests. |
| `pineForge.ollama.inlineTimeoutMs` | `12000` | Hard timeout (ms) per inline completion request. |
| `pineForge.ollama.codeActionsInLightbulb` | `true` | Adds a **Refactor** code action that runs **suggest fix** for the current range (still **no network** until you pick it). |
| `pineForge.ollama.completionAskAiItem` | `true` | Adds an **“Ask PineForge AI (cursor context)”** entry to the completion list; accepting it runs the same flow as **Ask Ollama at cursor**. |

**Editor integration (when enabled above):** with **`inlineCompletions`** you get VS Code **inline suggestions** alongside normal IntelliSense. With **`completionAskAiItem`**, the extra completion item appears with the rest of the list. With **`codeActionsInLightbulb`**, open the lightbulb / refactor menu on a range to see **PineForge AI: Suggest fix for range (Ollama)**.

**Privacy:** any Ollama call sends **the relevant source snippet** (and for suggest-fix, overlapping **diagnostic text**) to the configured host. **Commands** and the **Ask AI** completion item run only when you choose them; **code actions** hit the network only after you pick one. **Inline completions** can request the model **while you type** (after debounce) when enabled — turn off `pineForge.ollama.inlineCompletions` or `pineForge.ollama.enabled` to avoid that. Use **Clear Ollama API key** to revoke stored cloud tokens on this machine.

**Authority:** LSP diagnostics, completions, and quick fixes remain **deterministic**; the model can be wrong — treat AI output as advisory and keep validating on TradingView.

**Troubleshooting (output looks empty):** Command-based AI **reveals the Output panel and focuses it** on the **PineForge AI** channel. If you still see no text, pick **PineForge AI** in the Output dropdown; set **`pineForge.ollama.stream`** to **`false`** once (some models stream only `thinking` first, or odd clients swallow chunks). **Inline ghost text** never uses the output channel — only commands and the “Ask at cursor” / completion item do.

### Settings (`pineForge.*`)

| Setting | Default | Purpose |
|---------|---------|---------|
| `pineForge.enable` | `true` | Turn diagnostics on/off. |
| `pineForge.maxNumberOfProblems` | `100` | Cap diagnostics per file. |
| `pineForge.strictVersionCheck` | `true` | When enabled, warn if `//@version=` is missing; hints for versions other than 6. |
| `pineForge.strictImplicitBoolIf` | `false` | When `true`, warns on **bare** `if close`-style series-as-bool (same line only; skips comments, comparisons, and `[` tails). |
| `pineForge.styleTradingViewHints` | `false` | *Information* hints for common [TradingView Pine style guide](docs/tradingview-style-guide.md) patterns (ordering, `Input` suffix on `input.*` LHS). Heuristic only. |
| `pineForge.limitationHints` | `false` | *Information* hints for [TradingView platform limits](docs/tradingview-limitations.md) (plot budget **upper bound**, many `request.*` sites). Cannot measure TV compile/runtime. |
| `pineForge.tradingViewManualHints` | `true` | *Information* hints aligned with the TV User Manual *Errors and warnings* overview (e.g. **CE10101**-style bare `if identifier`). Heuristic — [mapping](docs/tradingview-errors-overview.md). |

## Package

```bash
npm run package
```

Uses `publisher` from `package.json` (`shubhamtaywade82`). Adjust `repository.url` if the GitHub remote differs. See [CHANGELOG.md](CHANGELOG.md) for release notes.
