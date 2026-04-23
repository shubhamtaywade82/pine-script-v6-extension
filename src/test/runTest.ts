import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    const workspaceDir = path.join(extensionDevelopmentPath, 'src', 'test', 'fixtures', 'workspace');
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [workspaceDir],
    });
  } catch {
    console.error('Failed to run VS Code integration tests');
    process.exit(1);
  }
}

void main();
