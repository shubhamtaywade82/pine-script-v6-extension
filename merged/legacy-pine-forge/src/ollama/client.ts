import { Ollama } from 'ollama';
import type { ExtensionContext, WorkspaceConfiguration } from 'vscode';
import { authHeadersFromApiKey } from './authHeaders';
import { DEFAULT_OLLAMA_MODEL, OLLAMA_API_SECRET_KEY } from './constants';

export interface OllamaExtensionConfig {
  enabled: boolean;
  host: string;
  model: string;
  stream: boolean;
  inlineCompletions: boolean;
  inlineDebounceMs: number;
  inlineContextLines: number;
  inlineMaxPromptChars: number;
  inlineTimeoutMs: number;
  codeActionsInLightbulb: boolean;
  completionAskAiItem: boolean;
}

export function readOllamaExtensionConfig(getConfiguration: () => WorkspaceConfiguration): OllamaExtensionConfig {
  const c = getConfiguration();
  return {
    enabled: c.get<boolean>('ollama.enabled', true),
    host: c.get<string>('ollama.host', 'http://127.0.0.1:11434') || 'http://127.0.0.1:11434',
    model: (c.get<string>('ollama.model', DEFAULT_OLLAMA_MODEL) ?? '').trim(),
    stream: c.get<boolean>('ollama.stream', true),
    inlineCompletions: c.get<boolean>('ollama.inlineCompletions', true),
    inlineDebounceMs: Math.max(0, c.get<number>('ollama.inlineDebounceMs', 400)),
    inlineContextLines: Math.max(1, c.get<number>('ollama.inlineContextLines', 40)),
    inlineMaxPromptChars: Math.max(2000, c.get<number>('ollama.inlineMaxPromptChars', 12000)),
    inlineTimeoutMs: Math.max(1000, c.get<number>('ollama.inlineTimeoutMs', 12000)),
    codeActionsInLightbulb: c.get<boolean>('ollama.codeActionsInLightbulb', true),
    completionAskAiItem: c.get<boolean>('ollama.completionAskAiItem', true),
  };
}

export async function createOllamaClient(
  context: ExtensionContext,
  getConfiguration: () => WorkspaceConfiguration,
): Promise<Ollama> {
  const cfg = readOllamaExtensionConfig(getConfiguration);
  const apiKey = await context.secrets.get(OLLAMA_API_SECRET_KEY);
  const headers = authHeadersFromApiKey(apiKey ?? undefined);
  const host = cfg.host.trim().replace(/\/+$/, '');
  return new Ollama({ host, ...(headers ? { headers } : {}) });
}
