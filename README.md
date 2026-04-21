# PineForge

VS Code / Cursor extension for **Pine Script v6**: syntax highlighting, language server (diagnostics, hover, completions), and links into TradingView’s [language reference](https://www.tradingview.com/pine-script-reference/v6/).

This is an **early MVP**. It does not implement a full Pine compiler; TradingView remains the authority for compile errors. See [pinescript-extension.md](pinescript-extension.md) for architecture and roadmap.

## Develop

```bash
npm install
npm run build
```

Open this folder in VS Code, then **Run → Start Debugging** (or F5) with **Run PineForge Extension**. In the Extension Development Host, open a `.pine` file (see `examples/demo.pine`).

## Package

Change `"publisher"` in `package.json` to your Marketplace id, then:

```bash
npx @vscode/vsce package
```

## Current behavior

- Warns if `//@version=` is missing; informational hint if version &lt; 6.
- Warns on `identifier(` calls not present in the bundled `src/references/pine.json` index (expand the JSON for fewer false positives).
- Hover / completion for symbols listed in `pine.json`, with TradingView reference URLs.

## Roadmap (short)

Parser and rules: scopes, types, arity, migration rules, formatter, tests — see [pinescript-extension.md](pinescript-extension.md) implementation phases.
