import type { ExtensionContext, OutputChannel, WorkspaceConfiguration } from 'vscode';
import * as vscode from 'vscode';
import { createOllamaClient, readOllamaExtensionConfig } from './client';

export async function appendOllamaChatToOutput(
  context: ExtensionContext,
  output: OutputChannel,
  getConfiguration: () => WorkspaceConfiguration,
  userContent: string,
  banner: string,
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

  output.clear();
  output.show(true);
  output.appendLine(banner);
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
