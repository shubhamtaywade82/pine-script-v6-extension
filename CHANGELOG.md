# Changelog

## 0.4.1

- **LSP:** **`documentRangeFormattingProvider`** — range format applies the same whitespace cleanup as full-document format on the selected span (`src/server.ts`).
- **VS Code e2e (full surface):** `runTest.ts` opens **`src/test/fixtures/workspace`**. Suites **`lsp.e2e.test.ts`** and **`lsp.e2e.rules.test.ts`** exercise **diagnostics** (surface `then`/`;`, unknown call, version-missing / below-6, clean script, TV **CE10101**, **alertcondition** const string, **deprecated transp**), **references**, **document highlights**, **signature help**, **prepareRename** + **rename**, **QuickFix code actions** (version insert/replace, transp removal), **format document** + **format range**, **completions**, **hover**, **definition**, **document / workspace symbols**, and **workspace-scoped settings** toggles (**strictImplicitBoolIf**, **styleTradingViewHints**, **limitationHints**, **`pineForge.enable`** clearing diagnostics). **`extension.test.ts`** asserts every **`contributes.commands`** id is registered. Helpers + reset in **`src/test/suite/testUtils.ts`**. **`src/test/fixtures/workspace/.vscode/`** is **gitignored** (workspace settings written during tests).

## 0.4.0

- **Production VSIX:** `vscode:prepublish` runs **`npm run build:prod`** — esbuild bundles `src/extension.ts` → `dist/extension.js` and `src/server.ts` → `dist/server.js` (minified, no source maps in package). Host API stays **`external: ['vscode']`** on the extension bundle.
- **Marketplace:** `images/icon.png` (128×128), **`icon`**, **`galleryBanner`**, **`homepage`**, and **`qna`** in `package.json`.
- **Lean package:** `.vscodeignore` excludes **`scripts/**`** and **`.github/**`** from the VSIX.
- **CI:** after unit tests and xvfb e2e, **`npm run package`** verifies the prepublish bundle produces a valid VSIX.

## 0.3.3

- **VS Code integration tests:** `@vscode/test-electron` + Mocha (`npm run test:e2e`), following [helloworld-test-sample](https://github.com/microsoft/vscode-extension-samples/tree/main/helloworld-test-sample). `tsconfig` excludes only `src/__tests__/**` so `src/test/**` compiles into `dist/test/`.
- **Walkthrough:** contributed **`pineforge.welcome`** with steps linking to `walkthroughs/*.md` (Get Started / Welcome).
- **CI:** Ubuntu job runs e2e under **xvfb** after unit tests.
- **VSIX:** `dist/test/**` omitted from package via `.vscodeignore`.

## 0.3.2

- **Extension host (samples-aligned):** dedicated **PineForge LSP** output channel with `revealOutputChannelOn: Error`; language server debug inspect fixed to **port 6009** for **Attach to PineForge Language Server**; launch **autoAttachChildProcesses** + compound **Extension + Server (manual attach)**; `npm: watch` task; `pretest` runs compile; `package.json` **bugs** URL; `.vscodeignore` excludes `.cursor/**`.

## 0.3.1

- **TradingView manual hints:** new setting `pineForge.tradingViewManualHints` (default **on**) emits **Information** diagnostic `pine-forge/TV-CE10101` for bare `if <identifier>` on one line, aligned with TV **CE10101** (*condition must be bool*). Overlap with `pineForge.strictImplicitBoolIf` on OHLC/`bar_index`/… is suppressed when that rule is on.
- **Docs:** [docs/tradingview-errors-overview.md](docs/tradingview-errors-overview.md) maps CE10101 / CW10003 / RE10139 / RE10143 to PineForge coverage.
- **Limitation hints:** `request.*` density message now mentions **RE10139** as possible context.

## 0.3.0

- **TradingView style hints:** optional `pineForge.styleTradingViewHints` — Information diagnostics for script-order and `input.*` naming heuristics; see `docs/tradingview-style-guide.md`.
- **TradingView limitations hints:** optional `pineForge.limitationHints` — rough plot-count upper bound and `request.*` call-site density; see `docs/tradingview-limitations.md`. **`//@version=`** lines are counted before comment-skipping so **version order / depth** hints work.
- **Diagnostics:** structural **parse errors** from [`src/parser/treeParser.ts`](src/parser/treeParser.ts) are now surfaced in the Problems panel (code `pine-forge/structural-parse`).
- **`alertcondition` const strings (CE10123):** `title` and `message` must be **const string** (not `series string` from `+` with non-literals, etc.). Diagnostics `pine-forge/alertcondition-title-not-const` and `pine-forge/alertcondition-message-not-const`.
- **Surface syntax:** illegal **multiple statements after `then`** on one line (semicolon-separated) is flagged with `pine-forge/invalid-then-semicolon`, matching the common TradingView error *no viable alternative at character ';'*.
- **Cap:** `pineForge.maxNumberOfProblems` now limits the merged diagnostic list (structural + surface + reference rules), with structural/surface entries listed first.

## 0.2.5

- **Default Ollama model:** `pineForge.ollama.model` defaults to **`qwen3.5:4b`** (aligned with `readOllamaExtensionConfig` fallback).

## 0.2.4

- **Defaults:** `pineForge.strictImplicitBoolIf`, `pineForge.ollama.enabled`, `pineForge.ollama.inlineCompletions`, `pineForge.ollama.codeActionsInLightbulb`, and `pineForge.ollama.completionAskAiItem` now default to **`true`**.

## 0.2.3

- **Ollama (optional):** `ollama` npm client in the **extension host** only — settings `pineForge.ollama.enabled`, `host`, `model`, `stream`; API key via **Secret Storage** (`PineForge: Set/Clear Ollama API key` commands), not `settings.json`.
- **Commands (output channel unless noted):** Explain selection; **Suggest fix** (selection or current line, includes overlapping diagnostics); **Refactor selection** (prompted instruction); **Ask Ollama at cursor**; **Suggest fix for range** (palette or code action). Editor context menu entries for Pine files where applicable.
- **Inline completions:** `pineForge.ollama.inlineCompletions` plus debounce, context lines, prompt size cap, and per-request timeout — **non-streaming**, separate from LSP symbol completion.
- **Editor hooks:** optional **Refactor** lightbulb entry (`pineForge.ollama.codeActionsInLightbulb`, no network until chosen); optional completion-list item **Ask PineForge AI** (`pineForge.ollama.completionAskAiItem`).
- **Docs:** [README.md](README.md) and [pinescript-extension.md](pinescript-extension.md) updated for the full Ollama surface and privacy notes.

## 0.2.2

- **Reference data:** `signatureOverlay.json` merged in `references/index.ts` — curated **signatures** for common APIs; **signature help** and **completion detail** use them when present (expand the overlay over time).
- **Scope (trust):** **Find references**, **document highlights**, and **rename** use **function-body–limited** ranges when the symbol is a **parameter** of the enclosing UDF (reduces cross-function false matches).
- **Rename guard:** `prepareRename` blocks when **more than one** `var` / `function` declaration shares the name in the file.
- **Format:** collapse **3+** consecutive blank lines to **2** after whitespace cleanup.
- **CI:** workflow runs on **all** branches for `push` and `pull_request`.

## 0.2.1

- **Trust:** `if close`-style implicit-bool rule is **off by default**; enable with `pineForge.strictImplicitBoolIf`. When on, it only fires for a **bare** identifier on the same line (EOL, `//`, or newline next), skips **strings/comments**, and ignores same-line **comparisons** and **`[`** indexing tails. Severity is **warning** (not error).
- **Completions:** user symbols from the document outline are merged with the bundled v6 index (user entries sort first).
- **CI:** GitHub Action runs `npm ci`, `compile`, and `test` on push/PR to `main`/`master`.

## 0.2.0

- Language server: **go to definition** for symbols in the bundled v6 reference (opens official TradingView URL).
- **Find references** and **document highlights** for identifiers (best-effort, string/comment aware).
- **Document symbols** and **workspace symbols** from the structural parser (`parseProgram` / AST).
- **Signature help** after `(` with summary + doc link for indexed calls.
- **Rename** with `prepareRename` for non-built-in identifiers (same-file, best-effort).
- **Format document**: trim trailing whitespace, expand tabs, ensure newline at EOF (not a full Pine pretty-printer).
- **Completions** filtered by prefix at the cursor.
- **Code actions**: insert or bump `//@version=6`; starter fix for deprecated `transp` args.
- Diagnostic rule codes unified under `pine-forge/*`.

## 0.1.0

- Initial PineForge extension: grammar, LSP boot, diagnostics, hovers, global completions from `pine.json`, reference command.
