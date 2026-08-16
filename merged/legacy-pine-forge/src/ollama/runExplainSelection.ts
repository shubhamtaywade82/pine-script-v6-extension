import type { ExtensionContext, OutputChannel, WorkspaceConfiguration } from 'vscode';
import * as vscode from 'vscode';
import { appendOllamaChatToOutput } from './chatToOutput';
import { readOllamaExtensionConfig } from './client';
import { explainSelectionUserMessage } from './explainPrompt';

export async function runExplainSelection(
  context: ExtensionContext,
  output: OutputChannel,
  getConfiguration: () => WorkspaceConfiguration,
): Promise<void> {
  const cfg = readOllamaExtensionConfig(getConfiguration);
  if (!cfg.enabled) {
    void vscode.window.showWarningMessage('PineForge AI: Enable `pineForge.ollama.enabled`.');
    return;
  }
  if (!cfg.model) {
    void vscode.window.showWarningMessage('PineForge AI: Set `pineForge.ollama.model`.');
    return;
  }

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
    void vscode.window.showInformationMessage('PineForge AI: select code to explain.');
    return;
  }

  const fileLabel = vscode.workspace.asRelativePath(editor.document.uri, false);
  const userContent = explainSelectionUserMessage(selection, fileLabel);
  await appendOllamaChatToOutput(context, output, getConfiguration, userContent, '--- PineForge AI (Ollama) ---');
}
