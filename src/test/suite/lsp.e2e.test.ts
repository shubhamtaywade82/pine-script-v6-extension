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

suite('PineForge LSP (integration)', function () {
  this.timeout(90_000);

  suiteSetup(async () => {
    await activatePineForge();
  });

  suiteTeardown(async () => {
    await resetPineForgeWorkspaceSettings();
  });

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('opens a .pine fixture with pinescript language mode', async () => {
    const { doc } = await openFixture('clean.pine');
    assert.match(doc.getText(), /\/\/@version=6/);
  });

  test('surface rule: invalid then + semicolon produces pine-forge diagnostic', async () => {
    const { doc } = await openFixture('surface-semicolon.pine');
    const diags = await waitForDiagnostics(doc.uri, (ds) =>
      ds.some((d) => diagnosticCode(d) === 'pine-forge/invalid-then-semicolon'),
    );
    const hit = diags.find((d) => diagnosticCode(d) === 'pine-forge/invalid-then-semicolon');
    assert.ok(hit);
    assert.strictEqual(hit!.source, 'pine-forge');
    assert.ok(hit!.message.includes('only one statement') || hit!.message.includes('semicolon'));
  });

  test('reference rule: unknown call produces pine-forge/unknown-call', async () => {
    const { doc } = await openFixture('unknown-call.pine');
    const diags = await waitForDiagnostics(doc.uri, (ds) =>
      ds.some((d) => diagnosticCode(d) === 'pine-forge/unknown-call'),
    );
    const hit = diags.find((d) => diagnosticCode(d) === 'pine-forge/unknown-call');
    assert.ok(hit);
    assert.ok(hit!.message.includes('pineForgeE2eUnknown999') || hit!.message.includes('Unknown'));
  });

  test('version rule: missing //@version produces pine-forge/version-missing', async () => {
    const { doc } = await openFixture('version-missing.pine');
    const diags = await waitForDiagnostics(doc.uri, (ds) =>
      ds.some((d) => diagnosticCode(d) === 'pine-forge/version-missing'),
    );
    const hit = diags.find((d) => diagnosticCode(d) === 'pine-forge/version-missing');
    assert.ok(hit);
  });

  test('clean script has no structural-parse or then-semicolon diagnostics', async () => {
    const { doc } = await openFixture('clean.pine');
    await sleep(2500);
    const diags = vscode.languages.getDiagnostics(doc.uri);
    const codes = diags.map((d) => diagnosticCode(d)).filter(Boolean) as string[];
    assert.ok(!codes.includes('pine-forge/structural-parse'));
    assert.ok(!codes.includes('pine-forge/invalid-then-semicolon'));
  });

  test('completion provider returns ta.sma for prefix ta.', async () => {
    const { doc } = await openFixture('completions-trigger.pine');
    await waitForDiagnostics(doc.uri, () => true, 8000, 80);
    const pos = new vscode.Position(2, 3);
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider',
      doc.uri,
      pos,
      '.',
    );
    assert.ok(list, 'Expected a completion list');
    const items = list!.items ?? [];
    assert.ok(items.length > 0, 'Expected at least one completion item');
    const labels = items.map((i) => (typeof i.label === 'string' ? i.label : i.label.label));
    assert.ok(labels.some((l) => l.includes('sma')), `Expected ta.sma-like label, got sample: ${labels.slice(0, 8).join(', ')}`);
  });

  test('document symbols include user function myFnE2e', async () => {
    const { doc } = await openFixture('symbols.pine');
    await waitForDiagnostics(doc.uri, () => true, 8000, 80);
    const syms = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      doc.uri,
    );
    assert.ok(Array.isArray(syms) && syms.length > 0);
    const flat = (nodes: vscode.DocumentSymbol[]): vscode.DocumentSymbol[] =>
      nodes.flatMap((s) => [s, ...(s.children ? flat(s.children) : [])]);
    const names = flat(syms!).map((s) => s.name);
    assert.ok(names.includes('myFnE2e'), `Expected myFnE2e in symbols, got: ${names.join(', ')}`);
  });

  test('format document removes trailing whitespace and normalizes tabs', async () => {
    const { editor } = await openFixture('format-me.pine');
    await sleep(400);
    await vscode.commands.executeCommand('editor.action.formatDocument');
    const text = editor.document.getText();
    assert.ok(!text.includes('\t'), 'Expected tabs expanded to spaces');
    assert.ok(text.includes('indicator'), `Expected indicator call preserved, got: ${text.slice(0, 120)}`);
    assert.ok(text.includes('plot(close)'));
    const indLine = text.split('\n').find((l) => l.includes('indicator'));
    assert.ok(indLine && !/\s$/.test(indLine), 'Expected no trailing whitespace on indicator line');
  });

  test('hover on plot includes TradingView reference content', async () => {
    const { doc } = await openFixture('clean.pine');
    await sleep(800);
    const text = doc.getText();
    const plotIdx = text.indexOf('plot');
    assert.ok(plotIdx >= 0);
    const pos = doc.positionAt(plotIdx + 1);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      doc.uri,
      pos,
    );
    assert.ok(hovers && hovers.length > 0);
    const md = hovers![0]!.contents.map((c) => (typeof c === 'string' ? c : c.value)).join('\n');
    assert.ok(/plot/i.test(md));
    assert.ok(md.includes('TradingView') || md.includes('tradingview'), md.slice(0, 200));
  });

  test('definition provider returns TradingView v6 reference URL for plot', async () => {
    const { doc } = await openFixture('clean.pine');
    await sleep(800);
    const plotIdx = doc.getText().indexOf('plot');
    const pos = doc.positionAt(plotIdx + 1);
    const loc = await vscode.commands.executeCommand<vscode.Location | vscode.LocationLink[]>(
      'vscode.executeDefinitionProvider',
      doc.uri,
      pos,
    );
    assert.ok(loc);
    const first = Array.isArray(loc) ? loc[0] : loc;
    assert.ok(first);
    const targetUri =
      'targetUri' in first! && first.targetUri
        ? first.targetUri.toString()
        : (first as vscode.Location).uri.toString();
    assert.ok(
      targetUri.startsWith('https://www.tradingview.com/pine-script-reference/v6/'),
      targetUri,
    );
  });

  test('workspace symbol provider finds myFnE2e', async () => {
    await openFixture('symbols.pine');
    await sleep(800);
    const syms = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
      'vscode.executeWorkspaceSymbolProvider',
      'myFnE2e',
    );
    assert.ok(Array.isArray(syms));
    assert.ok(syms!.some((s) => s.name === 'myFnE2e'), `Got: ${syms!.map((s) => s.name).join(', ')}`);
  });

  test('reference provider finds declaration and use of myVarE2eRefs', async () => {
    const { doc } = await openFixture('refs-rename.pine');
    await sleep(800);
    const linePlot = doc.getText().split('\n').findIndex((l) => l.includes('plot(myVarE2eRefs)'));
    assert.ok(linePlot >= 0);
    const ch = doc.lineAt(linePlot).text.indexOf('myVarE2eRefs');
    const pos = new vscode.Position(linePlot, ch);
    const refs = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeReferenceProvider',
      doc.uri,
      pos,
      { includeDeclaration: true },
    );
    assert.ok(Array.isArray(refs) && refs.length >= 2, `Expected >=2 refs, got ${refs?.length}`);
    assert.ok(refs!.every((r) => r.uri.toString() === doc.uri.toString()));
  });

  test('document highlights cover myVarE2eRefs occurrences', async () => {
    const { doc } = await openFixture('refs-rename.pine');
    await sleep(800);
    const linePlot = doc.getText().split('\n').findIndex((l) => l.includes('plot(myVarE2eRefs)'));
    const ch = doc.lineAt(linePlot).text.indexOf('myVarE2eRefs');
    const pos = new vscode.Position(linePlot, ch);
    const highs = await vscode.commands.executeCommand<vscode.DocumentHighlight[]>(
      'vscode.executeDocumentHighlights',
      doc.uri,
      pos,
    );
    assert.ok(Array.isArray(highs) && highs.length >= 2, `Expected >=2 highlights, got ${highs?.length}`);
  });

  test('signature help for plot( shows PineForge signature', async () => {
    const { doc } = await openFixture('signature-help.pine');
    await sleep(800);
    const linePlot = doc.getText().split('\n').findIndex((l) => l.trimStart().startsWith('plot('));
    assert.ok(linePlot >= 0);
    const insideArgs = doc.lineAt(linePlot).text.indexOf('close');
    const pos = new vscode.Position(linePlot, insideArgs);
    const sig = await vscode.commands.executeCommand<vscode.SignatureHelp>(
      'vscode.executeSignatureHelpProvider',
      doc.uri,
      pos,
      '(',
    );
    assert.ok(sig?.signatures?.length, 'Expected signature help');
    assert.ok(/plot/i.test(sig!.signatures[0].label));
  });

  test('prepareRename and document rename edit user symbol myVarE2eRefs', async () => {
    const { doc } = await openFixture('refs-rename.pine');
    await sleep(800);
    const lineDecl = doc.getText().split('\n').findIndex((l) => l.includes('myVarE2eRefs ='));
    const ch = doc.lineAt(lineDecl).text.indexOf('myVarE2eRefs');
    const pos = new vscode.Position(lineDecl, ch);
    const prep = await vscode.commands.executeCommand<vscode.Range | { range: vscode.Range; placeholder: string }>(
      'vscode.prepareRename',
      doc.uri,
      pos,
    );
    assert.ok(prep && 'range' in prep && prep.placeholder === 'myVarE2eRefs');
    const edit = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
      'vscode.executeDocumentRenameProvider',
      doc.uri,
      pos,
      'myVarE2eRenamed',
    );
    assert.ok(edit);
    const changes = edit!.get(doc.uri);
    assert.ok(changes && changes.length >= 2);
  });

  test('code action: Insert //@version=6 for version-missing diagnostic', async () => {
    const { doc } = await openFixture('version-missing.pine');
    await waitForDiagnostics(doc.uri, (ds) => ds.some((d) => diagnosticCode(d) === 'pine-forge/version-missing'));
    const full = new vscode.Range(0, 0, doc.lineCount, 0);
    const actions = await vscode.commands.executeCommand<(vscode.CodeAction | vscode.Command)[]>(
      'vscode.executeCodeActionProvider',
      doc.uri,
      full,
      vscode.CodeActionKind.QuickFix.value,
    );
    assert.ok(actions && actions.length > 0);
    const titles = actions!.map((a) => ('title' in a ? a.title : ''));
    assert.ok(titles.some((t) => t.includes('//@version=6')), `Quick fixes: ${titles.join(' | ')}`);
  });

  test('code action: Remove deprecated transp for plot(transp=…)', async () => {
    const { doc } = await openFixture('deprecated-transp.pine');
    await waitForDiagnostics(doc.uri, (ds) =>
      ds.some((d) => diagnosticCode(d) === 'pine-forge/deprecated-transp'),
    );
    const full = new vscode.Range(0, 0, doc.lineCount, 0);
    const actions = await vscode.commands.executeCommand<(vscode.CodeAction | vscode.Command)[]>(
      'vscode.executeCodeActionProvider',
      doc.uri,
      full,
      vscode.CodeActionKind.QuickFix.value,
    );
    assert.ok(actions && actions.length > 0);
    const titles = actions!.map((a) => ('title' in a ? a.title : ''));
    assert.ok(titles.some((t) => /transp/i.test(t)), `Quick fixes: ${titles.join(' | ')}`);
  });

  test('code action: Set //@version=6 for version-below-6 diagnostic', async () => {
    const { doc } = await openFixture('version-below-6.pine');
    await waitForDiagnostics(doc.uri, (ds) =>
      ds.some((d) => diagnosticCode(d) === 'pine-forge/version-below-6'),
    );
    const full = new vscode.Range(0, 0, doc.lineCount, 0);
    const actions = await vscode.commands.executeCommand<(vscode.CodeAction | vscode.Command)[]>(
      'vscode.executeCodeActionProvider',
      doc.uri,
      full,
      vscode.CodeActionKind.QuickFix.value,
    );
    assert.ok(actions && actions.length > 0);
    const titles = actions!.map((a) => ('title' in a ? a.title : ''));
    assert.ok(titles.some((t) => /version.*6/i.test(t)), `Quick fixes: ${titles.join(' | ')}`);
  });

  test('format range trims whitespace on selected lines', async () => {
    const { doc } = await openFixture('format-range.pine');
    await sleep(400);
    const r = new vscode.Range(2, 0, 3, doc.lineAt(3).text.length);
    const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
      'vscode.executeFormatRangeProvider',
      doc.uri,
      r,
      { tabSize: 4, insertSpaces: true },
    );
    assert.ok(Array.isArray(edits) && edits.length > 0);
  });

  test('TV manual hint: bare if identifier emits pine-forge/TV-CE10101', async () => {
    const { doc } = await openFixture('bare-if-ce10101.pine');
    await waitForDiagnostics(doc.uri, (ds) => ds.some((d) => diagnosticCode(d) === 'pine-forge/TV-CE10101'));
  });

  test('alertcondition: non-const message emits pine-forge/alertcondition-message-not-const', async () => {
    const { doc } = await openFixture('alertcondition-bad.pine');
    await waitForDiagnostics(doc.uri, (ds) =>
      ds.some((d) => diagnosticCode(d) === 'pine-forge/alertcondition-message-not-const'),
    );
  });

  test('alertcondition: non-const title emits pine-forge/alertcondition-title-not-const', async () => {
    const { doc } = await openFixture('alertcondition-title-bad.pine');
    await waitForDiagnostics(doc.uri, (ds) =>
      ds.some((d) => diagnosticCode(d) === 'pine-forge/alertcondition-title-not-const'),
    );
  });
});
