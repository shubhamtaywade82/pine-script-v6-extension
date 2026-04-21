import type { ExtensionContext, OutputChannel, WorkspaceConfiguration } from 'vscode';
import * as vscode from 'vscode';
import { createOllamaClient, readOllamaExtensionConfig } from './client';
import { explainSelectionUserMessage } from './explainPrompt';

function showCfgError(message: string): void {
  void vscode.window.showWarningMessage(`PineForge AI: ${message}`);
}

export async function runExplainSelection(
  context: ExtensionContext,
  output: OutputChannel,
  getConfiguration: () => WorkspaceConfiguration,
): Promise<void> {
  const cfg = readOllamaExtensionConfig(getConfiguration);
  if (!cfg.enabled) {
    showCfgError('Enable `pineForge.ollama.enabled` to use Ollama.');
    return;
  }
  if (!cfg.model) {
    showCfgError('Set `pineForge.ollama.model` (e.g. llama3.1).');
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    showCfgError('Open a file first.');
    return;
  }
  if (editor.document.languageId !== 'pinescript') {
    showCfgError('Active editor must be a Pine Script (.pine) file.');
    return;
  }

  const selection = editor.document.getText(editor.selection);
  if (!selection.trim()) {
    void vscode.window.showInformationMessage('PineForge AI: select code to explain.');
    return;
  }

  const fileLabel = vscode.workspace.asRelativePath(editor.document.uri, false);
  const userContent = explainSelectionUserMessage(selection, fileLabel);

  output.clear();
  output.show(true);
  output.appendLine('--- PineForge AI (Ollama) ---');
  output.appendLine(`Model: ${cfg.model} | Host: ${cfg.host}`);
  output.appendLine('');

  try {
    const ollama = await createOllamaClient(context, getConfiguration);
    const messages = [{ role: 'user' as const, content: userContent }];

    if (cfg.stream) {
      const stream = await ollama.chat({
        model: cfg.model,
        messages,
        stream: true,
      });
      for await (const part of stream) {
        const chunk = part.message?.content ?? '';
        if (chunk) output.append(chunk);
      }
      output.appendLine('');
    } else {
      const response = await ollama.chat({
        model: cfg.model,
        messages,
        stream: false,
      });
      output.appendLine(response.message.content ?? '');
    }
    output.appendLine('--- end ---');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    output.appendLine(`Error: ${msg}`);
    void vscode.window.showErrorMessage(`PineForge AI: ${msg}`);
  }
}
