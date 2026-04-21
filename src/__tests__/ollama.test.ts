import { authHeadersFromApiKey } from '../ollama/authHeaders';
import { explainSelectionUserMessage } from '../ollama/explainPrompt';

describe('authHeadersFromApiKey', () => {
  it('returns undefined when key missing', () => {
    expect(authHeadersFromApiKey(undefined)).toBeUndefined();
    expect(authHeadersFromApiKey('')).toBeUndefined();
    expect(authHeadersFromApiKey('   ')).toBeUndefined();
  });

  it('returns Bearer header when key present', () => {
    expect(authHeadersFromApiKey('abc')).toEqual({ Authorization: 'Bearer abc' });
  });

  it('trims key whitespace', () => {
    expect(authHeadersFromApiKey('  tok  ')).toEqual({ Authorization: 'Bearer tok' });
  });
});

describe('explainSelectionUserMessage', () => {
  it('includes fenced selection and file label', () => {
    const msg = explainSelectionUserMessage('plot(close)', 'demo.pine');
    expect(msg).toContain('demo.pine');
    expect(msg).toContain('```pine');
    expect(msg).toContain('plot(close)');
  });
});
