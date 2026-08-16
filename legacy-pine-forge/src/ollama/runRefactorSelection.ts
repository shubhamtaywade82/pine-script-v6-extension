import type { ExtensionContext, OutputChannel, WorkspaceConfiguration } from 'vscode';
import * as vscode from 'vscode';
import { appendOllamaChatToOutput } from './chatToOutput';
import { refactorSelectionUserMessage } from './refactorPrompt';

export async function runRefactorSelection(
  context: ExtensionContext,
  output: OutputChannel,
  getConfiguration: () => WorkspaceConfiguration,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage('PineForge AI: open a file first.');
    return;
  }
  if (editor.document.languageId !== 'pinescript') {
    void vscode.window.showWarningMessage('PineForge AI: active editor must be Pine Script.');
    return;
  }

  const selection = editor.document.getText(editor.selection);
  if (!selection.trim()) {
    void vscode.window.showInformationMessage('PineForge AI: select code to refactor.');
    return;
  }

  const instruction = await vscode.window.showInputBox({
    title: 'PineForge — Ollama refactor',
    prompt: 'Describe how you want this code changed.',
    ignoreFocusOut: true,
  });
  if (instruction === undefined) return;
  if (!instruction.trim()) {
    void vscode.window.showInformationMessage('PineForge AI: instruction was empty.');
    return;
  }

  const fileLabel = vscode.workspace.asRelativePath(editor.document.uri, false);
  const user = refactorSelectionUserMessage(selection, fileLabel, instruction);
  await appendOllamaChatToOutput(context, output, getConfiguration, user, '--- PineForge AI (refactor) ---');
}
