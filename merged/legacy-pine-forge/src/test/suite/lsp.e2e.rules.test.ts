import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  activatePineForge,
  diagnosticCode,
  openFixture,
  resetPineForgeWorkspaceSettings,
  setPineForgeWorkspaceSetting,
  sleep,
  waitForDiagnostics,
} from './testUtils';

suite('PineForge rules & settings (e2e)', function () {
  this.timeout(90_000);

  suiteSetup(async () => {
    await activatePineForge();
  });

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  suiteTeardown(async () => {
    await resetPineForgeWorkspaceSettings();
  });

  teardown(async () => {
    await resetPineForgeWorkspaceSettings();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('strictImplicitBoolIf: bare if close emits pine-forge/implicit-bool-cast', async () => {
    await setPineForgeWorkspaceSetting('strictImplicitBoolIf', true);
    const { doc } = await openFixture('implicit-bool-if.pine');
    await waitForDiagnostics(doc.uri, (ds) =>
      ds.some((d) => diagnosticCode(d) === 'pine-forge/implicit-bool-cast'),
    );
  });

  test('styleTradingViewHints: input.int LHS without Input suffix', async () => {
    await setPineForgeWorkspaceSetting('styleTradingViewHints', true);
    const { doc } = await openFixture('style-input-suffix.pine');
    await waitForDiagnostics(doc.uri, (ds) =>
      ds.some((d) => diagnosticCode(d) === 'pine-forge/style-input-suffix'),
    );
  });

  test('styleTradingViewHints: indicator before //@version emits style-version-order', async () => {
    await setPineForgeWorkspaceSetting('styleTradingViewHints', true);
    const { doc } = await openFixture('style-version-order.pine');
    await waitForDiagnostics(doc.uri, (ds) =>
      ds.some((d) => diagnosticCode(d) === 'pine-forge/style-version-order'),
    );
  });

  test('limitationHints: many plot() sites emit limit-plot-budget-est', async () => {
    await setPineForgeWorkspaceSetting('limitationHints', true);
    const { doc } = await openFixture('limit-plots.pine');
    await waitForDiagnostics(doc.uri, (ds) =>
      ds.some((d) => diagnosticCode(d) === 'pine-forge/limit-plot-budget-est'),
    );
  });

  test('limitationHints: many request.security sites emit limit-request-density', async () => {
    await setPineForgeWorkspaceSetting('limitationHints', true);
    const { doc } = await openFixture('limit-requests.pine');
    await waitForDiagnostics(doc.uri, (ds) =>
      ds.some((d) => diagnosticCode(d) === 'pine-forge/limit-request-density'),
    );
  });

  test('pineForge.enable false clears diagnostics for a rule-heavy file', async () => {
    const { doc } = await openFixture('surface-semicolon.pine');
    await waitForDiagnostics(doc.uri, (ds) =>
      ds.some((d) => diagnosticCode(d) === 'pine-forge/invalid-then-semicolon'),
    );
    await setPineForgeWorkspaceSetting('enable', false);
    await sleep(800);
    const cleared = vscode.languages.getDiagnostics(doc.uri);
    assert.strictEqual(cleared.length, 0, `Expected no diagnostics when disabled, got ${cleared.length}`);
  });
});
