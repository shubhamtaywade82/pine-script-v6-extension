# PineForge: Pine Script v6 language tooling for VS Code and Cursor

This document specifies how to build **PineForge**—a VS Code–compatible **all-in-one** Pine Script **v6** development tool: **LSP** (diagnostics, hovers, completions, signature help, definition, references, rename, symbols), **linting** (syntax, scopes, types, migration and domain rules), **formatting** (document / range / on-type), and **corrections** (code actions and quick fixes). The design is **Language Server Protocol (LSP)**–first: a thin editor client and a language server that owns parsing, symbol tables, rules, formatters, and LSP handlers. Cursor installs the same extension format as VS Code.

**Implementation in this repo:** the VS Code extension **`pine-forge`** (product **PineForge**) lives at the repository root (`package.json`, `src/extension.ts`, `src/server.ts`, lexer, rules, …). See [README.md](README.md) to run, test, and package it.

## Table of contents

1. [Purpose and scope](#purpose-and-scope)
2. [Architecture](#architecture)
3. [Design decisions](#design-decisions)
4. [Identifiers (package vs brand)](#identifiers-package-vs-brand)
5. [Repository layout](#repository-layout)
6. [Implementation phases](#implementation-phases)
7. [Declarative language contributions](#declarative-language-contributions)
8. [Language client and server (canonical samples)](#language-client-and-server-canonical-samples)
9. [Parser and AST](#parser-and-ast)
10. [Rule engine](#rule-engine)
11. [Reference index and LSP features](#reference-index-and-lsp-features)
12. [Syntax highlighting](#syntax-highlighting)
13. [Formatter (separate subsystem)](#formatter-separate-subsystem)
14. [Testing and packaging](#testing-and-packaging)
15. [Production hardening, risks, and non-goals](#production-hardening-risks-and-non-goals)
16. [Verification checklist](#verification-checklist)
17. [Learning sequence and official docs](#learning-sequence-and-official-docs)
18. [Appendix A: Naming and branding alternatives](#appendix-a-naming-and-branding-alternatives)
19. [Appendix B: Tooling stack](#appendix-b-tooling-stack)
20. [Appendix C: TradingView manuals, reference URLs, and index maintenance](#appendix-c-tradingview-manuals-reference-urls-and-index-maintenance)
21. [External references](#external-references-verify-urls-periodically)

---

## Purpose and scope

- **Goal**: **All-in-one** TradingView Pine **v6** support in the editor—real diagnostics, doc-linked hovers, intelligent completion, navigation (definition / references / rename), deterministic **formatting**, and **code actions** (quick fixes, safe refactors)—not a regex-only highlighter.
- **Sources of truth**: Pine v6 **reference** and **migration** materials from TradingView (verify current URLs when implementing).
- **Compatibility**: Ship a standard VS Code extension; **Cursor** consumes it without custom integration.
- **Compiler authority**: Until semantic and grammar coverage match TradingView’s compiler, **TradingView remains authoritative** for final compile errors; PineForge focuses on static analysis, editor integration, and user-trusted autofixes that are easy to verify.

### Current maturity in this repo (rolling)

| Area | Target | Repo today |
|------|--------|------------|
| Language id, grammar, `language-configuration.json` | Yes | Shipped |
| LSP process, incremental sync | Yes | Shipped |
| Diagnostics (version + migration + unknown-call vs index) | Full rule set | **Partial** (rules grow over time; bare `if series` check is **on by default**; disable with `pineForge.strictImplicitBoolIf`: false) |
| Hover + completion | Context-aware, indexed | **Partial** (prefix filter + `pine.json`; not full type context) |
| Parser / AST | Full grammar + recovery | **Partial** (lexer + tree parser); structural `parseProgram` errors + targeted surface rules (e.g. `then` + `;`) are published as diagnostics — not full TradingView compiler parity |
| Go-to-definition | Project + libs | **Partial** (indexed symbols → official v6 doc URL) |
| Find references / rename | Scope-correct | **Partial** (same-file, string/comment-aware heuristic) |
| Document / workspace symbols | Yes | **Partial** (AST outline when `parseProgram` succeeds) |
| Formatter (document / range) | AST printer | **Partial** (whitespace cleanup only) |
| Code actions / quick fixes | Rich set | **Partial** (version + starter `transp` fix) |
| Signature help | Arity-aware | **Partial** (summary + link; not full arg list) |
| Semantic tokens | Optional | **Not yet** |
| Optional Ollama (explain, fix, refactor, inline, list item, refactor code action) | Opt-in, host-only | **Shipped** (extension host; [`ollama`](https://github.com/ollama/ollama-js); not part of LSP analysis) |

Ship order follows [Implementation phases](#implementation-phases); expand the parser and symbol table before promising formatter parity or risky autofixes.

---

## Architecture

```text
VS Code / Cursor (editor)
        │
        ▼
Extension host (thin client)
  • language id, grammar, language-configuration.json
  • spawns server, forwards LSP
        │
        ▼
Language server (core)
  ├── Lexer / parser → AST
  ├── Symbol table / scope
  ├── Rule engine (lint + semantics)
  ├── Formatter (AST → TextEdit[])
  ├── Reference index (docs + signatures)
  └── LSP handlers (diagnostics, hover, completion, definition, formatting, codeAction, …)
```

### Extension client (host)

- Register the Pine language (`.pine`, `.pinescript`), grammar, and `language-configuration.json`.
- Start the language server (`vscode-languageclient`) and subscribe to lifecycle.
- Optional: commands such as “Open Pine reference” that open URLs from the reference index.
- **Optional Ollama (AI):** all LLM traffic stays in the **extension host** — `src/ollama/*`, registered from `src/extension.ts` via `registerPineOllamaUi`. The language server **never** imports `ollama` or calls the network for AI; LSP completions, diagnostics, and quick fixes stay deterministic. See [README.md](README.md) for settings and commands.

### Language server

- Parse source to an AST; run lint rules; publish **diagnostics** (merged: `parseProgram` recoverable errors, `syntaxSurfaceIssues` heuristics, `runRules` reference checks — includes optional **TV manual** hints e.g. CE10101-style bare `if` per `pineForge.tradingViewManualHints` — capped by `pineForge.maxNumberOfProblems`, structural/surface first).
- Implement **hover**, **completion**, **definition**, **references**, **rename**, **document symbols**, **signature help**, **formatting**, and **code actions** from the AST + symbol table + reference index (roll out in phases; see [Current maturity](#current-maturity-in-this-repo-rolling)).

### Reference index

Local JSON (or generated DB) mapping built-ins, keywords, functions, types, v6 notes, and migration hints to summaries and **official doc URLs** for hovers and completions.

---

## Design decisions

| Decision | Rationale |
|----------|-----------|
| **LSP-backed** | Diagnostics, completion, hover, definition, references, rename, formatting, and code actions are first-class in the LSP model and map cleanly from a single analysis pipeline (shipped incrementally). |
| **No regex-as-linter** | Pine needs identifiers, arity, scopes, and version gates; text rules alone produce false positives/negatives. |
| **v6-aware rules** | v5 scripts may require migration; gate rules on `//@version=` and v6 docs. |
| **Thin client** | Keeps analysis testable in Node without the VS Code UI; server can be reused by other LSP clients later. |
| **Formatter separate** | Formatting is a printer over the AST (or a formatting IR); do not mix it with lint rule logic. Use `DocumentFormattingEditProvider` / range formatting, or LSP `textDocument/formatting`—pick one approach and stay consistent. |

---

## Identifiers (package vs brand)

| Concept | Recommended value | Notes |
|---------|-------------------|--------|
| **Product / brand** | PineForge | Marketplace listing and user-facing name. |
| **npm `name`** | `pine-forge` or `@your-publisher/pine-forge` | Kebab-case is common for extension repos; must match publisher rules for Marketplace. |
| **`displayName`** | `PineForge — Pine Script v6 Language Server, Linter & Formatter` | Shorter variants are fine if constrained by UI. |
| **`publisher`** | Your Marketplace publisher id | Required for packaging. |
| **Language id** | `pinescript` | Used in `contributes.languages` and `documentSelector`. |
| **`LanguageClient` id / name** | e.g. `pineForge` / `PineForge` | Stable string for logging and client identity. |
| **Diagnostic `source`** | `pine-forge` | Consistent across rules for filterable diagnostics. |
| **This repo’s manifest** | `pine-forge` | [`package.json`](package.json): `LanguageClient` id `pineForge`, diagnostic `source` `pine-forge`, settings `pineForge.*`. |

---

## Repository layout

```text
pineforge/                    # or your repo root name
  package.json
  language-configuration.json
  syntaxes/
    pine.tmLanguage.json
  src/
    extension.ts              # activate: start language client
    server.ts                 # LSP entry
    parser/
      lexer.ts
      parser.ts
      ast.ts                  # as the model grows
    rules/
      engine.ts
      rules/*.ts
    references/
      pine.json               # or generated from docs
  docs/
    pine-symbols.json         # optional: larger generated index
  test/
    ...
```

You may split `client.ts` from `extension.ts` if activation grows; one file is enough at first.

---

## Implementation phases

Single path from “file opens with color” to “shippable tool.” Merge early milestones with later hardening.

| Phase | Outcome | Key work |
|-------|---------|----------|
| **0 — Declarative language** | `.pine` / `.pinescript` → `pinescript` language id; comments/brackets/autoclose feel native | `package.json` `contributes.languages` / `grammars`, optional `configurationDefaults` (`files.associations` + `[pinescript]` editor defaults), `language-configuration.json`; VS Code derives activation from language contributions (no redundant `activationEvents`) |
| **1 — Grammar** | Readable syntax highlighting | TextMate grammar (`syntaxes/pine.tmLanguage.json`); keywords, strings, numbers, comments, `//@version=6` |
| **2 — LSP boot** | Server runs; documents sync | `vscode-languageclient` + `vscode-languageserver`; incremental sync; stub `validate` returning no diagnostics |
| **3 — Parser + AST MVP** | Parse errors and simple tree with **ranges** | Lexer, AST nodes, recovery; **not** full Pine grammar on day one |
| **4 — Rule engine + diagnostics** | Squiggles in editor | `LintRule` modules; unknown calls, basic version checks; wire `sendDiagnostics` |
| **5 — Reference index** | Hovers and completions with doc links | JSON index; `onHover`, `onCompletion`; optional code action “Open docs” |
| **6 — Symbols** | Go-to-definition / references (where feasible) | Scope table, declarations, built-in table |
| **7 — Formatter** | Format Document / Selection stable | AST → printer → **text edits**; deterministic indentation/spacing first |
| **8 — Code actions** | Quick fixes from rules | Map diagnostics to edits where safe |
| **9 — Semantic tokens** (optional) | Richer highlighting | After grammar + symbols stabilize |
| **10 — Tests + packaging** | CI confidence; VSIX | Parser/rule unit tests; extension host integration tests; `vsce` package |

**Suggested first vertical slice**: Phase 0 → 1 → 2 → minimal 3 → 4 (few high-value rules) → 5 (small index), then **6 (symbols + go-to-definition)** so navigation exists before **7 (formatter)** and **8 (code actions)**—formatting and autofix need stable ranges and usually benefit from a scope table.

**Execution map (concise)**

| Stage | Outcome |
|-------|---------|
| Declarative language | Basic editor behavior |
| Grammar | Highlighting |
| LSP | Intelligence plumbing |
| Parser + AST | Reliable analysis |
| Linter | Errors and warnings |
| Formatter | Stable code style |
| Code actions | One-click fixes |
| Tests | Controlled regressions |
| Packaging | Installable release |

**Mental model**: Extension = **integration**; language server = **intelligence**; parser/AST = **correctness**; formatter = **deterministic printing**; linter = **rules over AST + symbols**.

---

## Declarative language contributions

**`package.json`** (illustrative—adjust `publisher`, `name`, and scripts to match your build):

```json
{
  "name": "pine-forge",
  "displayName": "PineForge — Pine Script v6 Language Server, Linter & Formatter",
  "version": "0.1.0",
  "publisher": "your-publisher",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": ["Programming Languages"],
  "main": "./dist/extension.js",
  "contributes": {
    "languages": [
      {
        "id": "pinescript",
        "aliases": ["Pine Script", "PineScript"],
        "extensions": [".pine", ".pinescript"],
        "configuration": "./language-configuration.json"
      }
    ],
    "grammars": [
      {
        "language": "pinescript",
        "scopeName": "source.pinescript",
        "path": "./syntaxes/pine.tmLanguage.json"
      }
    ],
    "configurationDefaults": {
      "files.associations": {
        "*.pine": "pinescript",
        "*.pinescript": "pinescript"
      },
      "[pinescript]": { "editor.insertSpaces": true, "editor.tabSize": 4 }
    }
  },
  "scripts": {
    "build": "tsc -p .",
    "watch": "tsc -w"
  }
}
```

**Shipped note:** registering `extensions: [".pine", …]` is usually enough for VS Code to set `editorLangId` to `pinescript` and activate the extension. **`configurationDefaults.files.associations`** (as in the real `package.json`) reinforces that mapping when another tool left the file as **Plain Text** or a conflicting association.

**`language-configuration.json`**

```json
{
  "comments": {
    "lineComment": "//",
    "blockComment": ["/*", "*/"]
  },
  "brackets": [["{", "}"], ["(", ")"], ["[", "]"]],
  "autoClosingPairs": [
    { "open": "\"", "close": "\"" },
    { "open": "(", "close": ")" },
    { "open": "{", "close": "}" },
    { "open": "[", "close": "]" }
  ],
  "surroundingPairs": [
    { "open": "\"", "close": "\"" },
    { "open": "(", "close": ")" },
    { "open": "{", "close": "}" },
    { "open": "[", "close": "]" }
  ]
}
```

Add **indentation** and **folding** rules when you define Pine’s block structure precisely in the parser.

---

## Language client and server (canonical samples)

**Bootstrap** (from repo root):

```bash
npm init -y
npm install --save-dev typescript @types/node vscode
npm install vscode-languageclient vscode-languageserver vscode-languageserver-textdocument
npx tsc --init
```

**`src/extension.ts`** — start client, optional file watcher, clean shutdown:

```typescript
import * as path from 'path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'));

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=127.0.0.1:0'] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'pinescript' }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{pine,pinescript}'),
    },
  };

  client = new LanguageClient('pineForge', 'PineForge', serverOptions, clientOptions);
  context.subscriptions.push(client.start());
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
```

**`src/server.ts`** — minimal validate pipeline (replace stub `parse` / `runRules` with real implementations):

```typescript
import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  InitializeParams,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parse } from './parser/parser';
import { runRules } from './rules/engine';

const connection = createConnection();
const documents = new TextDocuments(TextDocument);

connection.onInitialize((_params: InitializeParams) => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      completionProvider: { resolveProvider: true },
    },
  };
});

documents.onDidChangeContent((change) => {
  void validate(change.document);
});

async function validate(doc: TextDocument) {
  const text = doc.getText();
  const ast = parse(text);
  const issues = runRules(ast, text);

  const diagnostics: Diagnostic[] = issues.map((issue) => ({
    severity: DiagnosticSeverity.Error,
    range: issue.range,
    message: issue.message,
    source: 'pine-forge',
  }));

  connection.sendDiagnostics({ uri: doc.uri, diagnostics });
}

documents.listen(connection);
connection.listen();
```

Register **hover** and **completion** in the same server module once the reference index exists (see next section).

---

## Parser and AST

**Do not** treat regex as the parser. Prefer one of:

- Hand-written **recursive descent**
- **PEG** grammar
- **tree-sitter** grammar
- Token stream + **Pratt** parser for expressions

**Minimum viable AST** (early linter value):

- Declarations, function calls, assignments, conditionals, series expressions
- Version directive `//@version=6` (or detected version for rule gating)

**Enables**: unknown identifiers, arity mismatches, invalid assignment targets, version mismatches, deprecated constructs, misplaced declarations.

**Parser deliverable**: every node carries **source ranges** for diagnostics; support partial **recovery** after errors.

---

## Rule engine

```typescript
export interface LintRule {
  id: string;
  check(ast: PineAst, source: string, ctx: RuleContext): Diagnostic[];
}
```

**Rule groups**

| Group | Purpose |
|-------|---------|
| Syntax | Malformed expressions, delimiters, blocks |
| Semantic | Unknown identifiers, argument shape/count, invalid types |
| Pine v6 | Version-specific syntax and behavior (gated on declared version) |
| Style | Naming, line length, readability |
| Safety | Repaint risk, ambiguous lookahead, unstable references |

**Linter build order** (signal-to-noise):

1. Syntax errors (tokens, delimiters, blocks)
2. Unresolved identifiers
3. Signature mismatches
4. Version errors (features vs declared version)
5. Style warnings
6. Domain-specific (repaint, lookahead, unsafe patterns)

---

## Reference index and LSP features

**Example `src/references/pine.json`**

```json
{
  "indicator": {
    "summary": "Declares an indicator script",
    "url": "https://www.tradingview.com/pine-script-reference/v6/#fun_indicator"
  },
  "strategy": {
    "summary": "Declares a strategy",
    "url": "https://www.tradingview.com/pine-script-reference/v6/#fun_strategy"
  }
}
```

Verify anchors and paths against current TradingView documentation.

**Per-symbol behavior**

- Hover markdown with summary + link
- Completion `documentation` / `detail`
- Definition/reference for known symbols where the symbol table supports it
- Optional code action: open official doc URL

**Hover** (pattern—improve `getWordAt` for Pine identifiers):

```typescript
connection.onHover((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;

  const word = getWordAt(doc, params.position);
  const ref = index[word];
  if (!ref) return null;

  return {
    contents: {
      kind: 'markdown',
      value: `**${word}**\n\n${ref.summary}\n\n[Docs](${ref.url})`,
    },
  };
});
```

**Completion** (seed list until indexer drives it):

```typescript
connection.onCompletion(() => [
  { label: 'indicator', kind: 3, detail: 'Declare indicator' },
  { label: 'strategy', kind: 3, detail: 'Declare strategy' },
]);
```

---

## Syntax highlighting

TextMate grammar: keywords, built-ins, operators, strings, numbers, comments, directives such as `//@version=6`. **Semantic tokens** can refine colors after the symbol table exists.

**Minimal `syntaxes/pine.tmLanguage.json`**

```json
{
  "name": "Pine",
  "scopeName": "source.pinescript",
  "patterns": [
    {
      "match": "\\b(indicator|strategy|plot)\\b",
      "name": "keyword.control.pine"
    }
  ]
}
```

---

## Formatter (separate subsystem)

**Build order**: indentation → spacing around operators → call wrapping → block layout → blank lines between top-level declarations. Avoid “smart” rewrites until the printer is **stable**.

**Architecture**: parse → formatting IR or printer state → **TextEdit[]** (do not silently rewrite whole file strings in memory without diffing). Preserve comments and meaningful whitespace where possible.

**VS Code integration**: `DocumentFormattingEditProvider`, optionally `DocumentRangeFormattingEditProvider` / `OnTypeFormattingEditProvider`, or LSP formatting requests—align with whether formatting runs in the server or host.

---

## Testing and packaging

**Dependencies** (example):

```bash
npm install --save-dev jest ts-jest @types/jest
```

**Example unit test**

```typescript
test('flags unknown function call', () => {
  const ast = parse('foo()');
  const issues = runRules(ast, 'foo()');
  expect(issues.length).toBe(1);
});
```

**Layers**

- Parser unit tests
- Rule engine unit tests
- Integration tests in **Extension Development Host** (VS Code testing API)

**Release**: package and publish with **`vsce`** per Microsoft’s publishing guide (VSIX + Marketplace).

---

## Production hardening, risks, and non-goals

### Mandatory upgrades (before calling it “production”)

1. **Real AST** — expressions, series vs literal, arguments, blocks  
2. **Scope** — global/local, redeclaration, shadowing  
3. **Types** — `series float`, `float`, `bool`, `color`, implicit casts (Pine-specific)  
4. **Pine v6 rule set** — `//@version=6`, deprecated APIs, migration warnings  
5. **Strategy-oriented rules** — repaint, lookahead, `request.security()` misuse, `strategy.*` misuse  

### Risk table

| Risk | Impact |
|------|--------|
| No real parser | Linter is misleading |
| No type model | Excessive false positives/negatives |
| No Pine semantics | Low trust for trading workflows |
| No version gating | v5 vs v6 breakage |

### Non-goals (foundation vs full compiler)

This architecture is a **foundation**, not a full Pine compiler. Expect gaps until iterated:

- Full Pine grammar coverage
- Full type inference
- Control-flow graph
- Advanced constructs (arrays, `var`, full series propagation) — add incrementally

### Future features (high value)

- Static analysis: repaint scoring, indicator/strategy misuse, invalid `security()` combinations  
- **AI (shipped baseline, still expandable):** today the extension offers explain, suggest-fix (with diagnostic text when available), refactor-with-instruction, cursor-context ask, optional **inline completions**, an optional **completion-list** entry, and an optional **refactor** code action — all opt-in and **extension-host** only; future work could add one-click apply / diff preview, tighter prompt grounding from AST spans, or explicit “explain this diagnostic” without manual range selection. **Deterministic rules and TradingView remain authoritative.**  
- Doc pipeline: scrape/cache TradingView docs with **v6 version lock**  
- Backtest-aware hints (domain-specific, optional)

### Cursor

No Cursor-specific fork: install the VSIX or marketplace extension in Cursor like VS Code.

---

## Verification checklist

- [ ] Open a `.pine` / `.pinescript` file in VS Code **and** Cursor; language id and grammar apply.  
- [ ] Comment toggle, brackets, and autoclose behave per `language-configuration.json`.  
- [ ] Introduce an invalid / unknown symbol; **diagnostic** appears from `source: pine-forge`.  
- [ ] Hover a built-in; markdown shows summary + **official** doc link.  
- [ ] Completion lists expected symbols with documentation where wired.  
- [ ] Go-to-definition / find references on a pilot symbol (when implemented).  
- [ ] Rename pilot (when implemented).  
- [ ] Load a v5-leaning script under v6 rules; **migration** or version warnings appear where intended.  
- [ ] `F5` Extension Development Host: extension activates without errors.  
- [ ] Format Document: stable output, no spurious churn on double-format (when formatter exists).  
- [ ] **Ollama (optional):** with `pineForge.ollama.enabled` + model + host, run **Explain selection**; output appears in **PineForge AI**.  
- [ ] With **`pineForge.ollama.inlineCompletions`**, confirm ghost-text suggestions appear (and that turning it off removes them without affecting LSP completions).  
- [ ] With **`pineForge.ollama.codeActionsInLightbulb`**, confirm a **PineForge AI** refactor action appears and only hits the network after you choose it.  

---

## Learning sequence and official docs

**Three layers**

1. **Declarative language features** — `package.json`, `language-configuration.json`, TextMate grammar.  
2. **Programmatic features** — LSP: client in extension host, server subprocess, protocol messages.  
3. **Formatting** — formatting providers or LSP formatting; separate from lint.

**VS Code topics to read early**: Extension API overview, extension anatomy, language extensions overview, **Language Server Extension Guide**, programmatic language features, language configuration, publishing.

**Phased learning** (maps to implementation): basic extension authoring → LSP fundamentals → static analysis (parse, scope, types, rules) → formatting → tests and Marketplace.

---

## Appendix A: Naming and branding alternatives

**Chosen product name: PineForge** — connotes building, shaping, and validating Pine scripts; short and extensible (future AI, strategy validation, tooling modules).

| Name | Positioning |
|------|----------------|
| PineForge | Balanced: developer + trading workflows (**recommended**) |
| PineGuard | Safety, lint, risk |
| PineLens | Analysis / insight |
| PineCore | Language infrastructure |
| PineFlow | Formatter / structure |
| PineLint Pro | Literal, functional |
| PineEngine | Heavy tooling / systems |

Trading-aligned alternatives: PineAlpha, PineQuant, PineSignals, PineRisk, PineExecution.

Toolchain tone: PineKit, PineStack, PineLab, PineSuite.

**Names to avoid**: overly generic “PineScript Linter”; “TradingView Helper” (brand risk); “Pine IDE” (scope mismatch); “Pine Formatter” (undersells).

**Marketplace line**: *PineForge — Pine Script v6 Language Server, Linter & Formatter*.

---

## Appendix B: Tooling stack

| Component | Role |
|-----------|------|
| TypeScript | Primary implementation language (VS Code recommendation) |
| `vscode` types | Extension API typing |
| `vscode-languageclient` | Host-side LSP client |
| `vscode-languageserver` (+ `textdocument`) | Server, diagnostics, LSP handlers |
| Parser (custom or tree-sitter / PEG) | AST and ranges |
| Jest (or similar) + `@vscode/test-electron` (as needed) | Unit and integration tests |
| `vsce` | Package and publish |

---

## Appendix C: TradingView manuals, reference URLs, and index maintenance

### Two manuals (do not confuse them)

| Manual | URL | Use in PineForge |
|--------|-----|------------------|
| **Pine Script User Manual** | [https://www.tradingview.com/pine-script-docs](https://www.tradingview.com/pine-script-docs) | Semantics: [execution model](https://www.tradingview.com/pine-script-docs/language/execution-model/), [type system](https://www.tradingview.com/pine-script-docs/language/type-system/), [variable declarations](https://www.tradingview.com/pine-script-docs/language/variable-declarations/), [identifiers](https://www.tradingview.com/pine-script-docs/language/identifiers/), [built-ins overview](https://www.tradingview.com/pine-script-docs/language/built-ins/), [concepts](https://www.tradingview.com/pine-script-docs/concepts/alerts/), [release notes](https://www.tradingview.com/pine-script-docs/release-notes/). Drives **correct** analysis, migration text, and domain rules. |
| **Pine Script v6 language reference** | [https://www.tradingview.com/pine-script-reference/v6/](https://www.tradingview.com/pine-script-reference/v6/) | **Authoritative** per-symbol API: signatures, parameter **qualified types**, return types, **SEE ALSO**. Drives **hover links**, **completion detail**, and **arity/type** diagnostics. |

TradingView states on the [Built-ins](https://www.tradingview.com/pine-script-docs/language/built-ins/) page that all built-in variables and functions are defined in the v6 reference; each entry documents purpose, signature, RETURNS, ARGUMENTS, and related symbols.

### v6 reference URL scheme (for `pine.json` / generated index)

Use a single base URL and **fragment** anchors (stable pattern used across the manual):

- **Base:** `https://www.tradingview.com/pine-script-reference/v6/`
- **Functions:** `#fun_<identifier>` — e.g. [indicator](https://www.tradingview.com/pine-script-reference/v6/#fun_indicator), [ta.sma](https://www.tradingview.com/pine-script-reference/v6/#fun_ta.sma), [request.security](https://www.tradingview.com/pine-script-reference/v6/#fun_request.security), [strategy.entry](https://www.tradingview.com/pine-script-reference/v6/#fun_strategy.entry).
- **Variables / constants as `var_*`:** `#var_<identifier>` — e.g. [close](https://www.tradingview.com/pine-script-reference/v6/#var_close), [na](https://www.tradingview.com/pine-script-reference/v6/#var_na).
- **Keywords, types, operators:** the reference site uses the same fragment style with prefixes such as `#kw_…`, `#type_…`, `#const_…`, `#op_…` (verify the exact fragment in the browser for each symbol when adding to your index).

**Examples for hover markdown**

- `ta.vwma` → `https://www.tradingview.com/pine-script-reference/v6/#fun_ta.vwma`
- `close` → `https://www.tradingview.com/pine-script-reference/v6/#var_close`

Encode dots in names as literal dots inside the fragment (e.g. `ta.sma`, `strategy.entry`). For ambiguous tokens (variable vs function), prefer the entry the reference UI uses; store **kind** in your index (`function` | `variable` | `keyword` | …).

### Building the symbol index (machine access reality)

The reference home page is largely **client-rendered** in the browser: a simple HTTP fetch often returns only the shell, **not** the full navigable symbol list. Plan one of:

1. **Curated / generated JSON in-repo** — Start from namespaces listed in [Built-ins](https://www.tradingview.com/pine-script-docs/language/built-ins/) (`ta`, `math`, `request`, `str`, `input`, `color`, `strategy`, …) and grow coverage; ship summaries + URLs you verify in the browser.  
2. **Headless browser scrape** — Automated extraction of the reference tree with Playwright/Puppeteer; respect [TradingView](https://www.tradingview.com/) terms of service and rate limits; pin a **schema version** and re-run when [release notes](https://www.tradingview.com/pine-script-docs/release-notes/) announce API changes.  
3. **Hybrid** — Curated core + periodic scrape or manual diff against release notes.

Always bump your index when **release notes** add functions, types, or compiler rules (e.g. new `request.*` APIs, line-wrapping rules).

### Migration (version-gated diagnostics and doc links)

- [Migration guides overview](https://www.tradingview.com/pine-script-docs/migration-guides/overview/) — Lists version-to-version guides and the **Pine converter** (scripts must compile before conversion; rare auto-convert breakage).  
- [To Pine Script version 6](https://www.tradingview.com/pine-script-docs/migration-guides/to-pine-version-6/) — Primary source for **v5 → v6** rewrite guidance when emitting migration diagnostics or code-action descriptions.

### All-in-one extension: map features to sources

| Feature | User Manual | v6 Reference |
|---------|---------------|--------------|
| Grammar / comment / wrap rules | Release notes, primer | — |
| Execution / series / “repaint” hints | [Execution model](https://www.tradingview.com/pine-script-docs/language/execution-model/) | — |
| Types / qualifiers for arguments | [Type system](https://www.tradingview.com/pine-script-docs/language/type-system/) | ARGUMENTS / RETURNS per symbol |
| Script kind / required declaration | [Built-ins](https://www.tradingview.com/pine-script-docs/language/built-ins/), first steps | `#fun_indicator`, `#fun_strategy`, `#fun_library` |
| Hover / completion URL | — | `#fun_*` / `#var_*` / … |
| v5 at `//@version=6` | Migration guides | New symbols in v6 reference |

---

## External references (verify URLs periodically)

### VS Code and LSP

- [VS Code Extension API](https://code.visualstudio.com/api) — Extension manifest, activation, contributions.  
- [Language extensions overview](https://code.visualstudio.com/api/language-extensions/overview) — Declarative vs programmatic language support.  
- [Language Server Extension Guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide) — Client/server split and LSP wiring.  
- [Programmatic language features](https://code.visualstudio.com/api/language-extensions/programmatic-language-features) — Diagnostics, hover, completion, definition, etc.  
- [Language configuration](https://code.visualstudio.com/api/language-extensions/language-configuration-guide) — Comments, brackets, autoclose, indentation, folding.

### Official TradingView documentation

Use the site’s **version selector (v6)** when a page offers multiple Pine versions. Re-check URLs when TradingView reorganizes paths; **release notes** are the best signal for language or compiler behavior changes. For the **two-manual model**, v6 **reference URL fragments**, **migration** links, and how to **maintain the symbol index** (including client-rendered reference pages), see [Appendix C](#appendix-c-tradingview-manuals-reference-urls-and-index-maintenance).

- [Pine Script User Manual (hub)](https://www.tradingview.com/pine-script-docs) — Entry point: Primer, Language, Concepts, Release notes.  
- [Welcome to Pine Script v6](https://www.tradingview.com/pine-script-docs/welcome/) — What Pine is, platform constraints, link into the primer.  
- [First steps](https://www.tradingview.com/pine-script-docs/primer/first-steps/) — Using scripts on charts, community scripts, reading code, script types (indicator / strategy / library).  
- [Execution model](https://www.tradingview.com/pine-script-docs/language/execution-model/) — Bar-by-bar execution, time series, `[]` history, realtime bars, rollback/recalculation; ties to the type system for correct semantics and “repaint”-style reasoning.  
- [Release notes](https://www.tradingview.com/pine-script-docs/release-notes/) — Changelog for new APIs, limits, and editor/compiler rules; review when extending the v6 rule set or reference index.  
- [Pine Script v6 language reference](https://www.tradingview.com/pine-script-reference/v6/) — Functions, variables, types, operators; use for hover links and signature grounding in the reference index.

For **v5 → v6 migration**, use TradingView’s current migration material from the manual or help center (path may change); search the manual hub for “migration” or “version” when implementing version-gated diagnostics.
