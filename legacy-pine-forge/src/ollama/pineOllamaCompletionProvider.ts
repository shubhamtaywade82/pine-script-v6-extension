import type { WorkspaceConfiguration } from 'vscode';
import * as vscode from 'vscode';
import { readOllamaExtensionConfig } from './client';

export function registerPineOllamaAskAiCompletionItem(
  getConfiguration: () => WorkspaceConfiguration,
): vscode.Disposable {
  const provider: vscode.CompletionItemProvider = {
    provideCompletionItems(document, _position, _token, _ctx) {
      const cfg = readOllamaExtensionConfig(getConfiguration);
      if (document.languageId !== 'pinescript' || !cfg.enabled || !cfg.model || !cfg.completionAskAiItem) {
        return undefined;
      }

      const item = new vscode.CompletionItem('Ask PineForge AI (cursor context)', vscode.CompletionItemKind.Text);
      item.insertText = '';
      item.sortText = '\uffff';
      item.detail = 'Runs Ollama with text before/after the cursor (see PineForge AI output)';
      item.documentation = new vscode.MarkdownString(
        'Uses the same context window as inline AI settings (`pineForge.ollama.inlineContextLines`).',
      );
      item.command = {
        command: 'pineForge.ollama.completeAtCursor',
        title: 'Ask PineForge AI',
      };
      return [item];
    },
  };

  return vscode.languages.registerCompletionItemProvider(
    { scheme: 'file', language: 'pinescript' },
    provider,
  );
}
