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
  /** `false` = switch focus to Output so the PineForge AI channel is actually visible (preserveFocus was hiding it for many users). */
  output.show(false);
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
      let wrote = false;
      let n = 0;
      for await (const part of stream) {
        const msg = part.message;
        const thinking = msg?.thinking ?? '';
        const chunk = msg?.content ?? '';
        if (thinking) {
          output.append(thinking);
          wrote = true;
        }
        if (chunk) {
          output.append(chunk);
          wrote = true;
        }
        n += 1;
        if (n % 32 === 0) await new Promise<void>((r) => setImmediate(r));
      }
      output.appendLine('');
      if (!wrote) {
        output.appendLine(
          '(No streamed text in `message.content` / `message.thinking`. Try `pineForge.ollama.stream`: false, confirm the model name with `ollama list`, or check the Ollama server log.)',
        );
      }
    } else {
      const response = await ollama.chat({
        model: cfg.model,
        messages,
        stream: false,
      });
      const msg = response.message;
      const thinking = msg?.thinking ?? '';
      const body = msg?.content ?? '';
      if (thinking) output.appendLine(thinking);
      if (body) output.appendLine(body);
      if (!thinking && !body) {
        output.appendLine(
          '(Empty reply. Check model id, host reachability, and that the model is pulled / available on this host.)',
        );
      }
    }
    output.appendLine('--- end ---');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    output.appendLine(`Error: ${msg}`);
    void vscode.window.showErrorMessage(`PineForge AI: ${msg}`);
  }
}
