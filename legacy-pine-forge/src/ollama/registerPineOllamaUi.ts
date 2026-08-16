import type { ExtensionContext, OutputChannel, WorkspaceConfiguration } from 'vscode';
import * as vscode from 'vscode';
import { registerPineOllamaAskAiCompletionItem } from './pineOllamaCompletionProvider';
import { registerPineOllamaCodeActions } from './pineOllamaCodeActions';
import { registerPineOllamaInlineCompletionProvider } from './pineOllamaInlineProvider';
import { runCompleteAtCursor } from './runCompleteAtCursor';
import { runExplainSelection } from './runExplainSelection';
import { runFixRange, runSuggestFixSelection, type PineForgeOllamaPlainRange } from './runSuggestFix';
import { runRefactorSelection } from './runRefactorSelection';

/** Ollama UX that stays in the extension host (never touches the LSP server). */
export function registerPineOllamaUi(
  context: ExtensionContext,
  aiOutput: OutputChannel,
  getConfiguration: () => WorkspaceConfiguration,
): void {
  context.subscriptions.push(registerPineOllamaInlineCompletionProvider(context, getConfiguration));
  context.subscriptions.push(registerPineOllamaCodeActions(getConfiguration));
  context.subscriptions.push(registerPineOllamaAskAiCompletionItem(getConfiguration));

  context.subscriptions.push(
    vscode.commands.registerCommand('pineForge.ollama.explainSelection', () =>
      runExplainSelection(context, aiOutput, getConfiguration),
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('pineForge.ollama.suggestFixSelection', () =>
      runSuggestFixSelection(context, aiOutput, getConfiguration),
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('pineForge.ollama.refactorSelection', () =>
      runRefactorSelection(context, aiOutput, getConfiguration),
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('pineForge.ollama.completeAtCursor', () =>
      runCompleteAtCursor(context, aiOutput, getConfiguration),
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('pineForge.ollama.fixRange', (uriStr?: string, plain?: PineForgeOllamaPlainRange) =>
      runFixRange(context, aiOutput, getConfiguration, uriStr, plain),
    ),
  );
}
