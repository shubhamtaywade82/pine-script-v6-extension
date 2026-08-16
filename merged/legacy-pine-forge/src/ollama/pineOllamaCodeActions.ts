import type { WorkspaceConfiguration } from 'vscode';
import * as vscode from 'vscode';
import { readOllamaExtensionConfig } from './client';

const AI_FIX = vscode.CodeActionKind.Refactor.append('pineForgeOllamaFix');

export function registerPineOllamaCodeActions(
  getConfiguration: () => WorkspaceConfiguration,
): vscode.Disposable {
  return vscode.languages.registerCodeActionsProvider(
    { scheme: 'file', language: 'pinescript' },
    {
      provideCodeActions(document, range, context) {
        const cfg = readOllamaExtensionConfig(getConfiguration);
        if (!cfg.enabled || !cfg.model || !cfg.codeActionsInLightbulb) return;

        if (context.only !== undefined && !context.only.contains(AI_FIX)) return;

        const action = new vscode.CodeAction(
          'PineForge AI: Suggest fix for range (Ollama)',
          AI_FIX,
        );
        action.command = {
          command: 'pineForge.ollama.fixRange',
          title: 'Run',
          arguments: [
            document.uri.toString(),
            {
              start: { line: range.start.line, character: range.start.character },
              end: { line: range.end.line, character: range.end.character },
            },
          ],
        };
        return [action];
      },
    },
    { providedCodeActionKinds: [AI_FIX] },
  );
}
