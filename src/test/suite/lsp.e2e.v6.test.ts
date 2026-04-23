import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  activatePineForge,
  diagnosticCode,
  openFixture,
  resetPineForgeWorkspaceSettings,
  sleep,
  waitForDiagnostics,
} from './testUtils';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: flatten DocumentSymbol tree
// ─────────────────────────────────────────────────────────────────────────────
function flatSyms(nodes: vscode.DocumentSymbol[]): vscode.DocumentSymbol[] {
  return nodes.flatMap((s) => [s, ...(s.children ? flatSyms(s.children) : [])]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: assert a fixture opens with pinescript language and has no structural errors
// ─────────────────────────────────────────────────────────────────────────────
async function assertCleanFixture(name: string): Promise<{ doc: vscode.TextDocument }> {
  const { doc } = await openFixture(name);
  await sleep(2000);
  const diags = vscode.languages.getDiagnostics(doc.uri);
  const structural = diags.filter((d) => diagnosticCode(d) === 'pine-forge/structural-parse');
  assert.strictEqual(
    structural.length,
    0,
    `${name}: unexpected structural-parse errors: ${structural.map((d) => d.message).join(' | ')}`,
  );
  return { doc };
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────
suite('PineForge v6 comprehensive E2E', function () {
  this.timeout(120_000);

  suiteSetup(async () => {
    await activatePineForge();
  });

  suiteTeardown(async () => {
    await resetPineForgeWorkspaceSettings();
  });

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  // ── Ollama AI commands ────────────────────────────────────────────────────
  test('Ollama: all AI commands are registered after activation', async () => {
    const cmds = await vscode.commands.getCommands(true);
    const ollamaCmds = [
      'pineForge.ollama.explainSelection',
      'pineForge.ollama.suggestFixSelection',
      'pineForge.ollama.refactorSelection',
      'pineForge.ollama.completeAtCursor',
      'pineForge.ollama.fixRange',
      'pineForge.ollama.setApiKey',
      'pineForge.ollama.clearApiKey',
    ];
    for (const id of ollamaCmds) {
      assert.ok(cmds.includes(id), `Missing Ollama command: ${id}`);
    }
  });

  test('Ollama: pineForge.openReference command registered', async () => {
    const cmds = await vscode.commands.getCommands(true);
    assert.ok(cmds.includes('pineForge.openReference'));
  });

  // ── Pine Script v6 Types ─────────────────────────────────────────────────
  test('Types: v6-types.pine opens as pinescript with no structural errors', async () => {
    await assertCleanFixture('v6-types.pine');
  });

  test('Types: document symbols include UDT Point and Enum Direction', async () => {
    const { doc } = await openFixture('v6-types.pine');
    await sleep(2500);
    const syms = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      doc.uri,
    );
    assert.ok(Array.isArray(syms) && syms.length > 0, 'Expected symbols from v6-types.pine');
    const names = flatSyms(syms!).map((s) => s.name);
    assert.ok(names.includes('Point'), `Expected UDT 'Point' in symbols, got: ${names.join(', ')}`);
    assert.ok(names.includes('Direction'), `Expected Enum 'Direction' in symbols, got: ${names.join(', ')}`);
  });

  test('Types: UDT Point fields (x, y) appear as child symbols', async () => {
    const { doc } = await openFixture('v6-types.pine');
    await sleep(2500);
    const syms = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      doc.uri,
    );
    const all = flatSyms(syms!);
    assert.ok(all.some((s) => s.name === 'x'), `Expected field 'x' in symbols`);
    assert.ok(all.some((s) => s.name === 'y'), `Expected field 'y' in symbols`);
  });

  test('Types: Enum Direction members appear as child symbols', async () => {
    const { doc } = await openFixture('v6-types.pine');
    await sleep(2500);
    const syms = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      doc.uri,
    );
    const all = flatSyms(syms!);
    assert.ok(all.some((s) => s.name === 'Up'),   `Expected enum member 'Up'`);
    assert.ok(all.some((s) => s.name === 'Down'), `Expected enum member 'Down'`);
  });

  test('Types: qualified types (series/simple/const/input) parse without errors', async () => {
    await assertCleanFixture('v6-types.pine');
  });

  // ── Pine Script v6 Variables ─────────────────────────────────────────────
  test('Variables: v6-variables.pine opens with no structural errors', async () => {
    await assertCleanFixture('v6-variables.pine');
  });

  test('Variables: OHLCV, barstate, syminfo built-ins produce no unknown-call', async () => {
    const { doc } = await openFixture('v6-variables.pine');
    await sleep(2500);
    const diags = vscode.languages.getDiagnostics(doc.uri);
    // built-in variables are not calls, so no unknown-call should fire for them
    const unexpected = diags.filter(
      (d) =>
        diagnosticCode(d) === 'pine-forge/structural-parse',
    );
    assert.strictEqual(unexpected.length, 0, `Unexpected errors: ${unexpected.map((d) => d.message).join(' | ')}`);
  });

  test('Variables: hover on "close" contains TradingView reference', async () => {
    const { doc } = await openFixture('v6-variables.pine');
    await sleep(1000);
    const idx = doc.getText().indexOf('float c = close');
    assert.ok(idx >= 0);
    const pos = doc.positionAt(idx + 'float c = '.length + 1);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider', doc.uri, pos,
    );
    if (hovers && hovers.length > 0) {
      const md = hovers[0].contents.map((c) => (typeof c === 'string' ? c : c.value)).join('\n');
      assert.ok(/close/i.test(md), `Hover should mention 'close': ${md.slice(0, 200)}`);
    }
  });

  // ── Pine Script v6 Constants ─────────────────────────────────────────────
  test('Constants: v6-constants.pine opens with no structural errors', async () => {
    await assertCleanFixture('v6-constants.pine');
  });

  test('Constants: hover on color.red returns TradingView reference link', async () => {
    const { doc } = await openFixture('v6-constants.pine');
    await sleep(1000);
    const idx = doc.getText().indexOf('color.red');
    assert.ok(idx >= 0);
    const pos = doc.positionAt(idx + 2);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider', doc.uri, pos,
    );
    if (hovers && hovers.length > 0) {
      const md = hovers[0].contents.map((c) => (typeof c === 'string' ? c : c.value)).join('\n');
      assert.ok(
        md.includes('tradingview') || md.includes('TradingView') || md.includes('color'),
        `color.red hover should reference TV docs: ${md.slice(0, 200)}`,
      );
    }
  });

  // ── Pine Script v6 Keywords ───────────────────────────────────────────────
  test('Keywords: v6-keywords.pine opens with no structural errors', async () => {
    await assertCleanFixture('v6-keywords.pine');
  });

  test('Keywords: if/else/for/while/switch/break/continue/return all parse', async () => {
    const { doc } = await openFixture('v6-keywords.pine');
    await sleep(2000);
    const diags = vscode.languages.getDiagnostics(doc.uri);
    const structural = diags.filter((d) => diagnosticCode(d) === 'pine-forge/structural-parse');
    assert.strictEqual(structural.length, 0, structural.map((d) => d.message).join(' | '));
  });

  test('Keywords: UDT (type) and enum symbols appear in outline', async () => {
    const { doc } = await openFixture('v6-keywords.pine');
    await sleep(2500);
    const syms = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider', doc.uri,
    );
    const names = flatSyms(syms ?? []).map((s) => s.name);
    assert.ok(names.includes('KwRect'),  `Expected 'KwRect' in symbols`);
    assert.ok(names.includes('KwState'), `Expected 'KwState' in symbols`);
    assert.ok(names.includes('Vec2'),    `Expected 'Vec2' in symbols`);
  });

  test('Keywords: method symbol (magnitude) appears in outline', async () => {
    const { doc } = await openFixture('v6-keywords.pine');
    await sleep(2500);
    const syms = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider', doc.uri,
    );
    const names = flatSyms(syms ?? []).map((s) => s.name);
    assert.ok(names.includes('magnitude') || names.includes('clamp'),
      `Expected method or user fn in symbols, got: ${names.join(', ')}`);
  });

  // ── Pine Script v6 Operators ─────────────────────────────────────────────
  test('Operators: v6-operators.pine opens with no structural errors', async () => {
    await assertCleanFixture('v6-operators.pine');
  });

  test('Operators: arithmetic/comparison/logical/ternary/assignment all parse', async () => {
    const { doc } = await openFixture('v6-operators.pine');
    await sleep(2000);
    const diags = vscode.languages.getDiagnostics(doc.uri).filter(
      (d) => diagnosticCode(d) === 'pine-forge/structural-parse',
    );
    assert.strictEqual(diags.length, 0, diags.map((d) => d.message).join(' | '));
  });

  // ── Pine Script v6 Annotations ────────────────────────────────────────────
  test('Annotations: v6-annotations.pine opens with no structural errors', async () => {
    await assertCleanFixture('v6-annotations.pine');
  });

  test('Annotations: //@version=6 directive recognized (no version-missing diagnostic)', async () => {
    const { doc } = await openFixture('v6-annotations.pine');
    await sleep(2000);
    const diags = vscode.languages.getDiagnostics(doc.uri);
    assert.ok(
      !diags.some((d) => diagnosticCode(d) === 'pine-forge/version-missing'),
      'v6-annotations.pine should NOT trigger version-missing',
    );
  });

  // ── Pine Script v6 Functions: ta namespace ───────────────────────────────
  test('Functions/ta: v6-functions-ta.pine opens with no structural errors', async () => {
    await assertCleanFixture('v6-functions-ta.pine');
  });

  test('Functions/ta: hover on ta.sma shows TradingView docs link', async () => {
    const { doc } = await openFixture('v6-functions-ta.pine');
    await sleep(1000);
    const idx = doc.getText().indexOf('ta.sma');
    assert.ok(idx >= 0);
    const pos = doc.positionAt(idx + 3);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider', doc.uri, pos,
    );
    if (hovers && hovers.length > 0) {
      const md = hovers[0].contents.map((c) => (typeof c === 'string' ? c : c.value)).join('\n');
      assert.ok(/sma|tradingview/i.test(md), `ta.sma hover: ${md.slice(0, 200)}`);
    }
  });

  test('Functions/ta: completion at ta. returns sma, ema, rsi entries', async () => {
    const { doc } = await openFixture('v6-functions-ta.pine');
    await waitForDiagnostics(doc.uri, () => true, 8000, 80);
    const pos = new vscode.Position(4, 19); // after "ta." in "float sma14   = ta.sma(close, 14)"
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider', doc.uri, pos, '.',
    );
    const labels = (list?.items ?? []).map((i) =>
      typeof i.label === 'string' ? i.label : i.label.label,
    );
    assert.ok(labels.some((l) => l.includes('sma')), `Expected ta.sma in completions`);
    assert.ok(labels.some((l) => l.includes('ema')), `Expected ta.ema in completions`);
    assert.ok(labels.some((l) => l.includes('rsi')), `Expected ta.rsi in completions`);
  });

  test('Functions/ta: definition of ta.sma points to v6 reference URL', async () => {
    const { doc } = await openFixture('v6-functions-ta.pine');
    await sleep(1000);
    const idx = doc.getText().indexOf('ta.sma');
    const pos = doc.positionAt(idx + 3);
    const loc = await vscode.commands.executeCommand<vscode.Location | vscode.LocationLink[]>(
      'vscode.executeDefinitionProvider', doc.uri, pos,
    );
    if (loc) {
      const first = Array.isArray(loc) ? loc[0] : loc;
      const uri =
        first && 'targetUri' in first && first.targetUri
          ? first.targetUri.toString()
          : (first as vscode.Location)?.uri?.toString() ?? '';
      assert.ok(
        uri.startsWith('https://www.tradingview.com/pine-script-reference/v6/'),
        `Expected TV v6 ref URL, got: ${uri}`,
      );
    }
  });

  // ── Functions: math/str/color ─────────────────────────────────────────────
  test('Functions/math-str-color: opens with no structural errors', async () => {
    await assertCleanFixture('v6-functions-math-str-color.pine');
  });

  test('Functions/math-str-color: hover on math.sqrt shows docs', async () => {
    const { doc } = await openFixture('v6-functions-math-str-color.pine');
    await sleep(1000);
    const idx = doc.getText().indexOf('math.sqrt');
    assert.ok(idx >= 0);
    const pos = doc.positionAt(idx + 5);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider', doc.uri, pos,
    );
    if (hovers && hovers.length > 0) {
      const md = hovers[0].contents.map((c) => (typeof c === 'string' ? c : c.value)).join('\n');
      assert.ok(/sqrt|math/i.test(md), `math.sqrt hover: ${md.slice(0, 200)}`);
    }
  });

  // ── Functions: collections (array/matrix/map) ────────────────────────────
  test('Functions/collections: v6-functions-collections.pine opens with no structural errors', async () => {
    await assertCleanFixture('v6-functions-collections.pine');
  });

  // ── Functions: input/plot/drawing ────────────────────────────────────────
  test('Functions/input-plot: v6-functions-input-plot.pine opens with no structural errors', async () => {
    await assertCleanFixture('v6-functions-input-plot.pine');
  });

  test('Functions/input-plot: hover on plot shows TradingView reference', async () => {
    const { doc } = await openFixture('v6-functions-input-plot.pine');
    await sleep(1000);
    const idx = doc.getText().indexOf('plot(ma');
    assert.ok(idx >= 0);
    const pos = doc.positionAt(idx + 1);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider', doc.uri, pos,
    );
    if (hovers && hovers.length > 0) {
      const md = hovers[0].contents.map((c) => (typeof c === 'string' ? c : c.value)).join('\n');
      assert.ok(/plot/i.test(md), `plot hover: ${md.slice(0, 200)}`);
    }
  });

  // ── Functions: strategy ───────────────────────────────────────────────────
  test('Functions/strategy: v6-functions-strategy.pine opens with no structural errors', async () => {
    await assertCleanFixture('v6-functions-strategy.pine');
  });

  // ── Functions: request/alert/ticker ──────────────────────────────────────
  test('Functions/request: v6-functions-request.pine opens with no structural errors', async () => {
    await assertCleanFixture('v6-functions-request.pine');
  });

  test('Functions/request: hover on request.security shows docs', async () => {
    const { doc } = await openFixture('v6-functions-request.pine');
    await sleep(1000);
    const idx = doc.getText().indexOf('request.security');
    assert.ok(idx >= 0);
    const pos = doc.positionAt(idx + 8);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider', doc.uri, pos,
    );
    if (hovers && hovers.length > 0) {
      const md = hovers[0].contents.map((c) => (typeof c === 'string' ? c : c.value)).join('\n');
      assert.ok(/request|security/i.test(md), `request.security hover: ${md.slice(0, 200)}`);
    }
  });

  // ── UDT + Enum + Method ───────────────────────────────────────────────────
  test('UDT/Enum/Method: v6-udt-enum-method.pine opens with no structural errors', async () => {
    await assertCleanFixture('v6-udt-enum-method.pine');
  });

  test('UDT/Enum/Method: Candle, Signal, Trend appear as symbols', async () => {
    const { doc } = await openFixture('v6-udt-enum-method.pine');
    await sleep(2500);
    const syms = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider', doc.uri,
    );
    const names = flatSyms(syms ?? []).map((s) => s.name);
    assert.ok(names.includes('Candle'),  `Expected 'Candle' UDT`);
    assert.ok(names.includes('Signal'),  `Expected 'Signal' UDT`);
    assert.ok(names.includes('Trend'),   `Expected 'Trend' enum`);
  });

  test('UDT/Enum/Method: methods (isGreen, bodySize, range) appear in outline', async () => {
    const { doc } = await openFixture('v6-udt-enum-method.pine');
    await sleep(2500);
    const syms = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider', doc.uri,
    );
    const names = flatSyms(syms ?? []).map((s) => s.name);
    assert.ok(
      names.some((n) => ['isGreen', 'bodySize', 'range', 'magnitude'].includes(n)),
      `Expected at least one method in symbols, got: ${names.join(', ')}`,
    );
  });

  test('UDT/Enum/Method: enum members (Bullish, Bearish, Neutral) appear in outline', async () => {
    const { doc } = await openFixture('v6-udt-enum-method.pine');
    await sleep(2500);
    const syms = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider', doc.uri,
    );
    const names = flatSyms(syms ?? []).map((s) => s.name);
    assert.ok(names.includes('Bullish'),  `Expected enum member 'Bullish'`);
    assert.ok(names.includes('Bearish'),  `Expected enum member 'Bearish'`);
    assert.ok(names.includes('Neutral'),  `Expected enum member 'Neutral'`);
  });

  // ── v6 Migration guards ───────────────────────────────────────────────────
  test('Migration: deprecated transp= fires pine-forge/deprecated-transp', async () => {
    const { doc } = await openFixture('v6-migration-transp.pine');
    await waitForDiagnostics(
      doc.uri,
      (ds) => ds.some((d) => diagnosticCode(d) === 'pine-forge/deprecated-transp'),
    );
    const hit = vscode.languages.getDiagnostics(doc.uri).find(
      (d) => diagnosticCode(d) === 'pine-forge/deprecated-transp',
    );
    assert.ok(hit, 'Expected pine-forge/deprecated-transp diagnostic');
    assert.ok(/transp/i.test(hit!.message));
  });

  test('Migration: deprecated when= in strategy fires pine-forge/deprecated-when', async () => {
    const { doc } = await openFixture('v6-migration-when.pine');
    await waitForDiagnostics(
      doc.uri,
      (ds) => ds.some((d) => diagnosticCode(d) === 'pine-forge/deprecated-when'),
    );
    const hit = vscode.languages.getDiagnostics(doc.uri).find(
      (d) => diagnosticCode(d) === 'pine-forge/deprecated-when',
    );
    assert.ok(hit, 'Expected pine-forge/deprecated-when diagnostic');
    assert.ok(/when/i.test(hit!.message));
  });

  test('Migration: code action on transp= offers quick-fix', async () => {
    const { doc } = await openFixture('v6-migration-transp.pine');
    await waitForDiagnostics(
      doc.uri,
      (ds) => ds.some((d) => diagnosticCode(d) === 'pine-forge/deprecated-transp'),
    );
    const full = new vscode.Range(0, 0, doc.lineCount, 0);
    const actions = await vscode.commands.executeCommand<(vscode.CodeAction | vscode.Command)[]>(
      'vscode.executeCodeActionProvider', doc.uri, full, vscode.CodeActionKind.QuickFix.value,
    );
    const titles = (actions ?? []).map((a) => ('title' in a ? a.title : ''));
    assert.ok(titles.some((t) => /transp/i.test(t)), `Quick fix titles: ${titles.join(' | ')}`);
  });

  // ── Signature help for common functions ──────────────────────────────────
  test('SignatureHelp: ta.sma shows signature', async () => {
    const { doc } = await openFixture('v6-functions-ta.pine');
    await sleep(1000);
    const idx = doc.getText().indexOf('ta.sma(close, 14)');
    assert.ok(idx >= 0);
    const pos = doc.positionAt(idx + 'ta.sma('.length);
    const sig = await vscode.commands.executeCommand<vscode.SignatureHelp>(
      'vscode.executeSignatureHelpProvider', doc.uri, pos, '(',
    );
    if (sig?.signatures?.length) {
      assert.ok(/sma/i.test(sig.signatures[0].label), `Expected sma in sig label`);
    }
  });

  // ── Format: v6 fixtures ───────────────────────────────────────────────────
  test('Format: v6-keywords.pine formats without errors', async () => {
    const { editor } = await openFixture('v6-keywords.pine');
    await sleep(400);
    await vscode.commands.executeCommand('editor.action.formatDocument');
    const text = editor.document.getText();
    assert.ok(!text.includes('\t'), 'Expected no tabs after format');
    assert.ok(text.endsWith('\n'), 'Expected trailing newline');
  });

  // ── Workspace symbols across v6 fixtures ─────────────────────────────────
  test('WorkspaceSymbols: searching "Candle" finds UDT across open docs', async () => {
    await openFixture('v6-udt-enum-method.pine');
    await sleep(1200);
    const syms = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
      'vscode.executeWorkspaceSymbolProvider', 'Candle',
    );
    assert.ok(Array.isArray(syms));
    assert.ok(
      syms!.some((s) => s.name === 'Candle'),
      `Expected Candle in workspace symbols, got: ${syms!.map((s) => s.name).join(', ')}`,
    );
  });

  test('WorkspaceSymbols: searching "Point" finds UDT from v6-types fixture', async () => {
    await openFixture('v6-types.pine');
    await sleep(1200);
    const syms = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
      'vscode.executeWorkspaceSymbolProvider', 'Point',
    );
    assert.ok(Array.isArray(syms));
    assert.ok(
      syms!.some((s) => s.name === 'Point'),
      `Expected Point in workspace symbols`,
    );
  });
});
