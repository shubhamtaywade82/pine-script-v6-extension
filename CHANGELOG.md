# Changelog

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
