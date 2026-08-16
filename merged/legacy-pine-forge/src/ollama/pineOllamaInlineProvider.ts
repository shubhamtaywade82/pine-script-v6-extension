import type { ExtensionContext, WorkspaceConfiguration } from 'vscode';
import * as vscode from 'vscode';
import { createOllamaClient, readOllamaExtensionConfig } from './client';
import { inlineContinuationUserMessage } from './inlineContinuationPrompt';
import { sanitizeModelInsertText } from './sanitizeModelInsertText';
import { withTimeout } from './withTimeout';

function debounce(ms: number, token: vscode.CancellationToken): Promise<void> {
  if (ms <= 0) {
    return token.isCancellationRequested ? Promise.reject(new Error('Cancelled')) : Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    if (token.isCancellationRequested) {
      reject(new Error('Cancelled'));
      return;
    }
    let settled = false;
    const handle = setTimeout(() => finish(() => resolve()), ms);
    const sub = token.onCancellationRequested(() => finish(() => reject(new Error('Cancelled'))));
    function finish(fn: () => void): void {
      if (settled) return;
      settled = true;
      clearTimeout(handle);
      sub.dispose();
      fn();
    }
  });
}

export function registerPineOllamaInlineCompletionProvider(
  context: ExtensionContext,
  getConfiguration: () => WorkspaceConfiguration,
): vscode.Disposable {
  const provider: vscode.InlineCompletionItemProvider = {
    async provideInlineCompletionItems(document, position, _ctx, token) {
      const cfg = readOllamaExtensionConfig(getConfiguration);
      if (
        document.languageId !== 'pinescript' ||
        !cfg.enabled ||
        !cfg.inlineCompletions ||
        !cfg.model
      ) {
        return;
      }

      try {
        if (cfg.inlineDebounceMs > 0) await debounce(cfg.inlineDebounceMs, token);
      } catch {
        return;
      }
      if (token.isCancellationRequested) return;

      const before = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
      const after = document.getText(
        new vscode.Range(position, document.lineAt(document.lineCount - 1).range.end),
      );
      const beforeLines = before.split('\n');
      const pb = beforeLines.slice(Math.max(0, beforeLines.length - cfg.inlineContextLines)).join('\n');
      const afterLines = after.split('\n');
      const sfx = afterLines.slice(0, cfg.inlineContextLines).join('\n');

      let promptPrefix = pb;
      let promptSuffix = sfx;
      const max = cfg.inlineMaxPromptChars;
      if (promptPrefix.length + promptSuffix.length > max) {
        const half = Math.floor(max / 2);
        promptPrefix = promptPrefix.slice(-half);
        promptSuffix = promptSuffix.slice(0, half);
      }

      const userContent = inlineContinuationUserMessage(promptPrefix, promptSuffix);

      try {
        const ollama = await createOllamaClient(context, getConfiguration);
        const chatPromise = ollama.chat({
          model: cfg.model,
          messages: [{ role: 'user', content: userContent }],
          stream: false,
        });
        const res = await withTimeout(
          chatPromise,
          cfg.inlineTimeoutMs,
          'PineForge AI: inline completion timed out',
        );
        const text = sanitizeModelInsertText(res.message?.content ?? '');
        if (!text || token.isCancellationRequested) return;

        return [new vscode.InlineCompletionItem(text)];
      } catch (e) {
        if (token.isCancellationRequested) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === 'Cancelled') return;
        void vscode.window.showWarningMessage(`PineForge AI (inline): ${msg}`);
        return;
      }
    },
  };

  return vscode.languages.registerInlineCompletionItemProvider(
    { scheme: 'file', language: 'pinescript' },
    provider,
  );
}
