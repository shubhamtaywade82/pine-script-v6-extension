import * as assert from 'assert';
import * as vscode from 'vscode';

suite('PineForge extension (integration)', () => {
  test('extension is installed for this test run', () => {
    const ext = vscode.extensions.getExtension('shubhamtaywade82.pine-forge');
    assert.ok(ext, 'Expected shubhamtaywade82.pine-forge to be the development extension under test');
  });

  test('PineForge commands are registered after activation', async () => {
    const ext = vscode.extensions.getExtension('shubhamtaywade82.pine-forge');
    assert.ok(ext);
    await ext.activate();
    const cmds = await vscode.commands.getCommands(true);
    assert.ok(cmds.includes('pineForge.openReference'), 'pineForge.openReference should be contributed');
    assert.ok(cmds.includes('pineForge.ollama.explainSelection'), 'Ollama command should be contributed');
  });
});
