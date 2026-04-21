/** Build Ollama `headers` when an API token is stored (cloud or authenticated self-host). */
export function authHeadersFromApiKey(apiKey: string | undefined): Record<string, string> | undefined {
  if (!apiKey?.trim()) return undefined;
  return { Authorization: `Bearer ${apiKey.trim()}` };
}
