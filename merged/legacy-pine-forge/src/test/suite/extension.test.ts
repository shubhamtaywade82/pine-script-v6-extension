import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const EXTENSION_ID = 'shubhamtaywade82.pine-forge';

suite('PineForge extension (integration)', () => {
  test('extension is installed for this test run', () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `Expected ${EXTENSION_ID} to be the development extension under test`);
  });

  test('PineForge commands are registered after activation', async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    await ext.activate();
    const cmds = await vscode.commands.getCommands(true);
    assert.ok(cmds.includes('pineForge.openReference'), 'pineForge.openReference should be contributed');
    assert.ok(cmds.includes('pineForge.ollama.explainSelection'), 'Ollama command should be contributed');
  });

  test('every contributes.commands entry from package.json is registered', async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    await ext.activate();
    const pkgPath = path.join(ext.extensionPath, 'package.json');
    const manifest = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      contributes?: { commands?: { command: string }[] };
    };
    const contributed = (manifest.contributes?.commands ?? []).map((c) => c.command);
    assert.ok(contributed.length > 0, 'Expected contributes.commands in package.json');
    const cmds = await vscode.commands.getCommands(true);
    for (const id of contributed) {
      assert.ok(cmds.includes(id), `Missing registered command: ${id}`);
    }
  });
});
