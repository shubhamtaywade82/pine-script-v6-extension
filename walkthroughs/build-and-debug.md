# Build and run PineForge

From the repository root:

```bash
npm install
npm run compile
```

Press **F5** (**Run PineForge Extension**) to open an Extension Development Host. The default launch config runs `npm: compile` first.

For faster iteration, run the **`npm: watch`** task, then F5 once so `dist/` updates as you edit TypeScript.

## Debug the language server

Set breakpoints in `src/server.ts`, then either:

- Use **Run PineForge Extension** with **`autoAttachChildProcesses`** (default in this repo’s `.vscode/launch.json`), or  
- Use the compound **Extension + Server (manual attach)** and attach to port **6009**.

LSP client logs: **View → Output → PineForge LSP**.

## Integration tests (`npm run test:e2e`)

From the repo root, **`npm run test:e2e`** launches VS Code (under `.vscode-test/`), opens **`src/test/fixtures/workspace`**, and runs Mocha suites in **`src/test/suite/`** that exercise the real PineForge language server (diagnostics, completions, format, hover, symbols, go-to-definition). On headless Linux, run under **xvfb** (as in CI).
