import { authHeadersFromApiKey } from '../ollama/authHeaders';
import { explainSelectionUserMessage } from '../ollama/explainPrompt';
import { inlineContinuationUserMessage } from '../ollama/inlineContinuationPrompt';
import { refactorSelectionUserMessage } from '../ollama/refactorPrompt';
import { sanitizeModelInsertText } from '../ollama/sanitizeModelInsertText';
import { suggestFixUserMessage } from '../ollama/suggestFixPrompt';

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

describe('sanitizeModelInsertText', () => {
  it('returns trimmed plain text', () => {
    expect(sanitizeModelInsertText('  ta.sma(close, 14)  ')).toBe('ta.sma(close, 14)');
  });

  it('unwraps fenced pine blocks', () => {
    expect(sanitizeModelInsertText('```pine\nta.sma(close,14)\n```')).toBe('ta.sma(close,14)');
  });
});

describe('inlineContinuationUserMessage', () => {
  it('embeds prefix and suffix', () => {
    const m = inlineContinuationUserMessage('a', 'b');
    expect(m).toContain('a');
    expect(m).toContain('b');
    expect(m).toContain('prefix');
  });
});

describe('suggestFixUserMessage', () => {
  it('includes diagnostics when provided', () => {
    const m = suggestFixUserMessage('x', 'f.pine', ['L1: bad']);
    expect(m).toContain('L1: bad');
    expect(m).toContain('f.pine');
    expect(m).toContain('x');
  });
});

describe('refactorSelectionUserMessage', () => {
  it('includes instruction', () => {
    const m = refactorSelectionUserMessage('plot(close)', 'x.pine', 'use v6 style');
    expect(m).toContain('use v6 style');
    expect(m).toContain('plot(close)');
  });
});
