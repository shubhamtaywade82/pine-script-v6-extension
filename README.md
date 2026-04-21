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
| Ollama (optional) | Explain / suggest fix / refactor / cursor ask; **inline ghost text**; optional **completion list** + **refactor** code action — all via [`ollama`](https://github.com/ollama/ollama-js) in the **extension host only** (never the LSP server) |

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
- **PineForge: Explain selection with Ollama** — sends the current selection to your Ollama host; replies go to **View → Output → PineForge AI** (also in the editor context menu for Pine files).
- **PineForge: Suggest fix with Ollama (selection or line)** — uses the selection if non-empty, otherwise the **current line**; includes **diagnostic messages** that overlap that range when available.
- **PineForge: Refactor selection with Ollama** — prompts for a short instruction, then sends the selection plus that instruction to the model (output channel).
- **PineForge: Ask Ollama at cursor (output channel)** — same **prefix/suffix window** around the cursor as inline AI (see `pineForge.ollama.inlineContextLines`); useful when inline completions are off or you want a full reply in the channel.
- **PineForge: Suggest fix for range (Ollama)** — intended for the **lightbulb** code action; if you run it from the palette with no arguments, it behaves like **Suggest fix** on the active selection or line.
- **PineForge: Set / Clear Ollama API key** — stores a **Bearer** token in VS Code **Secret Storage** (for `https://ollama.com` or any host that requires auth). Keys are never written to `settings.json`.

### Ollama (optional AI)

**Master switch:** `pineForge.ollama.enabled` must be `true`, and **`pineForge.ollama.model`** set, before any AI feature talks to your host.

| Setting | Default | Purpose |
|---------|---------|---------|
| `pineForge.ollama.enabled` | `false` | Turn on Ollama-backed features (commands, optional inline/list/lightbulb). |
| `pineForge.ollama.host` | `http://127.0.0.1:11434` | Local Ollama, or `https://ollama.com` for cloud. |
| `pineForge.ollama.model` | _(empty)_ | Model id (e.g. `llama3.1` locally, or a cloud model name). |
| `pineForge.ollama.stream` | `true` | Stream tokens into the **PineForge AI** output channel for **command**-driven chats (inline completions always use a single non-streaming request). |
| `pineForge.ollama.inlineCompletions` | `false` | **Ghost-text** suggestions at the cursor (separate from LSP symbol completions). |
| `pineForge.ollama.inlineDebounceMs` | `400` | Wait after typing before requesting inline AI (`0` = no debounce). |
| `pineForge.ollama.inlineContextLines` | `40` | Lines of document **before** / **after** the cursor included in inline and “Ask at cursor” prompts. |
| `pineForge.ollama.inlineMaxPromptChars` | `12000` | Cap on combined prefix+suffix size for inline requests. |
| `pineForge.ollama.inlineTimeoutMs` | `12000` | Hard timeout (ms) per inline completion request. |
| `pineForge.ollama.codeActionsInLightbulb` | `false` | Adds a **Refactor** code action that runs **suggest fix** for the current range (still **no network** until you pick it). |
| `pineForge.ollama.completionAskAiItem` | `false` | Adds an **“Ask PineForge AI (cursor context)”** entry to the completion list; accepting it runs the same flow as **Ask Ollama at cursor**. |

**Editor integration (when enabled above):** with **`inlineCompletions`** you get VS Code **inline suggestions** alongside normal IntelliSense. With **`completionAskAiItem`**, the extra completion item appears with the rest of the list. With **`codeActionsInLightbulb`**, open the lightbulb / refactor menu on a range to see **PineForge AI: Suggest fix for range (Ollama)**.

**Privacy:** any command or inline request sends **the relevant source snippet** (and for suggest-fix, overlapping **diagnostic text**) to the configured host. Nothing is sent until you trigger a command, accept an inline suggestion, pick a code action, or choose the “Ask AI” completion item. Use **Clear Ollama API key** to revoke stored cloud tokens on this machine.

**Authority:** LSP diagnostics, completions, and quick fixes remain **deterministic**; the model can be wrong — treat AI output as advisory and keep validating on TradingView.

**Troubleshooting (output looks empty):** Command-based AI **reveals the Output panel and focuses it** on the **PineForge AI** channel. If you still see no text, pick **PineForge AI** in the Output dropdown; set **`pineForge.ollama.stream`** to **`false`** once (some models stream only `thinking` first, or odd clients swallow chunks). **Inline ghost text** never uses the output channel — only commands and the “Ask at cursor” / completion item do.

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
