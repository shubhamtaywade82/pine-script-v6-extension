import { Ollama } from 'ollama';
import type { ExtensionContext, WorkspaceConfiguration } from 'vscode';
import { authHeadersFromApiKey } from './authHeaders';
import { OLLAMA_API_SECRET_KEY } from './constants';

export interface OllamaExtensionConfig {
  enabled: boolean;
  host: string;
  model: string;
  stream: boolean;
}

export function readOllamaExtensionConfig(getConfiguration: () => WorkspaceConfiguration): OllamaExtensionConfig {
  const c = getConfiguration();
  return {
    enabled: c.get<boolean>('ollama.enabled', false),
    host: c.get<string>('ollama.host', 'http://127.0.0.1:11434') || 'http://127.0.0.1:11434',
    model: (c.get<string>('ollama.model', '') ?? '').trim(),
    stream: c.get<boolean>('ollama.stream', true),
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
