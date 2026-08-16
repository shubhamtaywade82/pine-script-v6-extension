import * as assert from 'assert';
import * as vscode from 'vscode';

const EXTENSION_ID = 'shubhamtaywade82.pine-forge';

export function diagnosticCode(d: vscode.Diagnostic): string | undefined {
  const c = d.code;
  if (typeof c === 'string') return c;
  if (c && typeof c === 'object' && 'value' in c) return String((c as { value: string }).value);
  return undefined;
}

export function workspaceFixtureRoot(): vscode.Uri {
  const folders = vscode.workspace.workspaceFolders;
  assert.ok(folders?.length, 'Expected a workspace folder (launchArgs in runTest.ts)');
  return folders![0].uri;
}

export function fixtureUri(fileName: string): vscode.Uri {
  return vscode.Uri.joinPath(workspaceFixtureRoot(), fileName);
}

export async function activatePineForge(): Promise<vscode.Extension<any>> {
  const ext = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(ext, `Expected ${EXTENSION_ID}`);
  await ext.activate();
  return ext;
}

export async function openFixture(fileName: string): Promise<{ doc: vscode.TextDocument; editor: vscode.TextEditor }> {
  const uri = fixtureUri(fileName);
  const doc = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(doc);
  assert.strictEqual(doc.languageId, 'pinescript', `${fileName} should use pinescript language id`);
  return { doc, editor };
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export function workspaceFolder(): vscode.WorkspaceFolder {
  const folders = vscode.workspace.workspaceFolders;
  assert.ok(folders?.length, 'Expected a workspace folder');
  return folders![0];
}

/** Keys we override in e2e; cleared so defaults apply (see `defaultPineForgeSettings`). */
const PINEFORGE_WORKSPACE_KEYS_RESET = [
  'enable',
  'strictImplicitBoolIf',
  'limitationHints',
  'styleTradingViewHints',
] as const;

export async function resetPineForgeWorkspaceSettings(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('pineForge');
  for (const key of PINEFORGE_WORKSPACE_KEYS_RESET) {
    await cfg.update(key, undefined, vscode.ConfigurationTarget.Workspace);
  }
  await sleep(300);
}

export async function setPineForgeWorkspaceSetting(key: string, value: unknown): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('pineForge');
  await cfg.update(key, value, vscode.ConfigurationTarget.Workspace);
  await sleep(250);
}

/**
 * Polls until predicate holds or timeout (LSP diagnostics arrive asynchronously).
 */
export async function waitForDiagnostics(
  uri: vscode.Uri,
  predicate: (diagnostics: vscode.Diagnostic[]) => boolean,
  timeoutMs = 25_000,
  pollMs = 120,
): Promise<vscode.Diagnostic[]> {
  const deadline = Date.now() + timeoutMs;
  let last = vscode.languages.getDiagnostics(uri);
  while (Date.now() < deadline) {
    if (predicate(last)) return last;
    await sleep(pollMs);
    last = vscode.languages.getDiagnostics(uri);
  }
  assert.ok(predicate(last), `Timed out after ${timeoutMs}ms; last diagnostics: ${JSON.stringify(last.map((d) => diagnosticCode(d)))}`);
  return last;
}
