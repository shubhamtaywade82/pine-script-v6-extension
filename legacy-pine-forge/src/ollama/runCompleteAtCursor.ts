import type { ExtensionContext, OutputChannel, WorkspaceConfiguration } from 'vscode';
import * as vscode from 'vscode';
import { appendOllamaChatToOutput } from './chatToOutput';
import { readOllamaExtensionConfig } from './client';
import { inlineContinuationUserMessage } from './inlineContinuationPrompt';

export async function runCompleteAtCursor(
  context: ExtensionContext,
  output: OutputChannel,
  getConfiguration: () => WorkspaceConfiguration,
): Promise<void> {
  const cfg = readOllamaExtensionConfig(getConfiguration);
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage('PineForge AI: open a file first.');
    return;
  }
  if (editor.document.languageId !== 'pinescript') {
    void vscode.window.showWarningMessage('PineForge AI: active editor must be Pine Script.');
    return;
  }

  const position = editor.selection.active;
  const before = editor.document.getText(new vscode.Range(new vscode.Position(0, 0), position));
  const after = editor.document.getText(
    new vscode.Range(position, editor.document.lineAt(editor.document.lineCount - 1).range.end),
  );
  const beforeLines = before.split('\n');
  const pb = beforeLines.slice(Math.max(0, beforeLines.length - cfg.inlineContextLines)).join('\n');
  const afterLines = after.split('\n');
  const sfx = afterLines.slice(0, cfg.inlineContextLines).join('\n');

  const user = inlineContinuationUserMessage(pb, sfx);
  await appendOllamaChatToOutput(
    context,
    output,
    getConfiguration,
    user,
    '--- PineForge AI (complete at cursor) ---',
  );
}
