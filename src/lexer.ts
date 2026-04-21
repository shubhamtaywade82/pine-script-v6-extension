import type { Position, Range } from './ast';

export enum TokenType {
  // Literals
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  COLOR = 'COLOR',

  // Keywords — control flow
  KW_IF = 'KW_IF',
  KW_ELSE = 'KW_ELSE',
  KW_FOR = 'KW_FOR',
  KW_TO = 'KW_TO',
  KW_BY = 'KW_BY',
  KW_WHILE = 'KW_WHILE',
  KW_SWITCH = 'KW_SWITCH',
  KW_BREAK = 'KW_BREAK',
  KW_CONTINUE = 'KW_CONTINUE',
  KW_RETURN = 'KW_RETURN',

  // Keywords — declarations
  KW_VAR = 'KW_VAR',
  KW_VARIP = 'KW_VARIP',
  KW_IMPORT = 'KW_IMPORT',
  KW_EXPORT = 'KW_EXPORT',
  KW_METHOD = 'KW_METHOD',
  KW_TYPE = 'KW_TYPE',
  KW_ENUM = 'KW_ENUM',

  // Literals as keywords
  KW_TRUE = 'KW_TRUE',
  KW_FALSE = 'KW_FALSE',
  KW_NA = 'KW_NA',

  // Type keywords
  KW_INT = 'KW_INT',
  KW_FLOAT = 'KW_FLOAT',
  KW_BOOL = 'KW_BOOL',
  KW_COLOR_TYPE = 'KW_COLOR_TYPE',
  KW_STRING_TYPE = 'KW_STRING_TYPE',
  KW_LINE = 'KW_LINE',
  KW_LABEL = 'KW_LABEL',
  KW_BOX = 'KW_BOX',
  KW_TABLE = 'KW_TABLE',
  KW_ARRAY = 'KW_ARRAY',
  KW_MATRIX = 'KW_MATRIX',
  KW_MAP = 'KW_MAP',
  KW_POLYLINE = 'KW_POLYLINE',

  // Type qualifiers
  KW_SERIES = 'KW_SERIES',
  KW_SIMPLE = 'KW_SIMPLE',
  KW_CONST = 'KW_CONST',
  KW_INPUT = 'KW_INPUT',

  // Logical operators
  KW_AND = 'KW_AND',
  KW_OR = 'KW_OR',
  KW_NOT = 'KW_NOT',

  // Identifier
  IDENT = 'IDENT',

  // Compound assignment
  WALRUS = 'WALRUS',
  PLUS_EQ = 'PLUS_EQ',
  MINUS_EQ = 'MINUS_EQ',
  STAR_EQ = 'STAR_EQ',
  SLASH_EQ = 'SLASH_EQ',
  PERCENT_EQ = 'PERCENT_EQ',

  // Comparison
  EQ_EQ = 'EQ_EQ',
  BANG_EQ = 'BANG_EQ',
  LT_EQ = 'LT_EQ',
  GT_EQ = 'GT_EQ',
  LT = 'LT',
  GT = 'GT',

  // Assignment
  EQ = 'EQ',

  // Arithmetic
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  STAR = 'STAR',
  SLASH = 'SLASH',
  PERCENT = 'PERCENT',
  CARET = 'CARET',

  // Misc
  QUESTION = 'QUESTION',
  COLON = 'COLON',
  ARROW = 'ARROW',
  DOT = 'DOT',
  COMMA = 'COMMA',

  // Delimiters
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',

  // Structural
  ANNOTATION = 'ANNOTATION',
  NEWLINE = 'NEWLINE',
  INDENT = 'INDENT',
  DEDENT = 'DEDENT',
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  range: Range;
}

const KEYWORDS: Record<string, TokenType> = {
  if: TokenType.KW_IF,
  else: TokenType.KW_ELSE,
  for: TokenType.KW_FOR,
  to: TokenType.KW_TO,
  by: TokenType.KW_BY,
  while: TokenType.KW_WHILE,
  switch: TokenType.KW_SWITCH,
  break: TokenType.KW_BREAK,
  continue: TokenType.KW_CONTINUE,
  return: TokenType.KW_RETURN,
  var: TokenType.KW_VAR,
  varip: TokenType.KW_VARIP,
  import: TokenType.KW_IMPORT,
  export: TokenType.KW_EXPORT,
  method: TokenType.KW_METHOD,
  type: TokenType.KW_TYPE,
  enum: TokenType.KW_ENUM,
  true: TokenType.KW_TRUE,
  false: TokenType.KW_FALSE,
  na: TokenType.KW_NA,
  int: TokenType.KW_INT,
  float: TokenType.KW_FLOAT,
  bool: TokenType.KW_BOOL,
  color: TokenType.KW_COLOR_TYPE,
  string: TokenType.KW_STRING_TYPE,
  line: TokenType.KW_LINE,
  label: TokenType.KW_LABEL,
  box: TokenType.KW_BOX,
  table: TokenType.KW_TABLE,
  array: TokenType.KW_ARRAY,
  matrix: TokenType.KW_MATRIX,
  map: TokenType.KW_MAP,
  polyline: TokenType.KW_POLYLINE,
  series: TokenType.KW_SERIES,
  simple: TokenType.KW_SIMPLE,
  const: TokenType.KW_CONST,
  input: TokenType.KW_INPUT,
  and: TokenType.KW_AND,
  or: TokenType.KW_OR,
  not: TokenType.KW_NOT,
};

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const lines = source.split('\n');
  const indentStack: number[] = [0];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    const lineTokens = lexLine(rawLine, lineIdx, indentStack);
    tokens.push(...lineTokens);
  }

  while (indentStack.length > 1) {
    indentStack.pop();
    const dedentPos: Position = { line: lines.length, character: 0 };
    tokens.push(makeToken(TokenType.DEDENT, '', { start: dedentPos, end: dedentPos }));
  }

  const eofPos: Position = { line: lines.length, character: 0 };
  tokens.push(makeToken(TokenType.EOF, '', { start: eofPos, end: eofPos }));
  return tokens;
}

function lexLine(line: string, lineIdx: number, indentStack: number[]): Token[] {
  const tokens: Token[] = [];

  let col = 0;
  while (col < line.length && (line[col] === ' ' || line[col] === '\t')) {
    col += line[col] === '\t' ? 4 : 1;
  }

  const isBlank =
    col >= line.length || line.trim() === '' || isLineOnlyComment(line.trim());

  if (!isBlank) {
    const currentIndent = indentStack[indentStack.length - 1];
    if (col > currentIndent) {
      indentStack.push(col);
      tokens.push(makeToken(TokenType.INDENT, '', pos(lineIdx, 0)));
    } else {
      while (indentStack.length > 1 && indentStack[indentStack.length - 1] > col) {
        indentStack.pop();
        tokens.push(makeToken(TokenType.DEDENT, '', pos(lineIdx, 0)));
      }
    }
  }

  let i = skipWhitespace(line, 0);
  while (i < line.length) {
    const ch = line[i];

    if (ch === '/' && line[i + 1] === '/') {
      if (line[i + 2] === '@') {
        const start = i;
        const end = line.length;
        tokens.push(
          makeToken(TokenType.ANNOTATION, line.slice(start, end), posRange(lineIdx, start, lineIdx, end)),
        );
      }
      break;
    }

    if (ch === '#' && /[0-9A-Fa-f]/.test(line[i + 1] || '')) {
      const start = i;
      i++;
      while (i < line.length && /[0-9A-Fa-f]/.test(line[i])) i++;
      tokens.push(makeToken(TokenType.COLOR, line.slice(start, i), posRange(lineIdx, start, lineIdx, i)));
      i = skipWhitespace(line, i);
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i++;
      while (i < line.length && line[i] !== quote) {
        if (line[i] === '\\') i++;
        i++;
      }
      if (i < line.length) i++;
      const raw = line.slice(start, i);
      const inner = raw.length >= 2 ? raw.slice(1, -1) : raw;
      tokens.push(makeToken(TokenType.STRING, inner, posRange(lineIdx, start, lineIdx, i)));
      i = skipWhitespace(line, i);
      continue;
    }

    if (/\d/.test(ch) || (ch === '.' && /\d/.test(line[i + 1] || ''))) {
      const start = i;
      if (ch === '0' && (line[i + 1] === 'x' || line[i + 1] === 'X')) {
        i += 2;
        while (i < line.length && /[0-9A-Fa-f]/.test(line[i])) i++;
      } else {
        while (i < line.length && /\d/.test(line[i])) i++;
        if (i < line.length && line[i] === '.') {
          i++;
          while (i < line.length && /\d/.test(line[i])) i++;
        }
        if (i < line.length && /[eE]/.test(line[i])) {
          i++;
          if (i < line.length && /[+-]/.test(line[i])) i++;
          while (i < line.length && /\d/.test(line[i])) i++;
        }
      }
      tokens.push(makeToken(TokenType.NUMBER, line.slice(start, i), posRange(lineIdx, start, lineIdx, i)));
      i = skipWhitespace(line, i);
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      i++;
      while (i < line.length && /[a-zA-Z0-9_.]/.test(line[i])) i++;
      const word = line.slice(start, i);
      const kw = KEYWORDS[word];
      tokens.push(makeToken(kw ?? TokenType.IDENT, word, posRange(lineIdx, start, lineIdx, i)));
      i = skipWhitespace(line, i);
      continue;
    }

    if (ch === ':') {
      if (line[i + 1] === '=') {
        tokens.push(makeToken(TokenType.WALRUS, ':=', posRange(lineIdx, i, lineIdx, i + 2)));
        i += 2;
        i = skipWhitespace(line, i);
        continue;
      }
      tokens.push(makeToken(TokenType.COLON, ':', pos(lineIdx, i)));
      i++;
      i = skipWhitespace(line, i);
      continue;
    }
    if (ch === '=') {
      if (line[i + 1] === '=') {
        tokens.push(makeToken(TokenType.EQ_EQ, '==', posRange(lineIdx, i, lineIdx, i + 2)));
        i += 2;
        i = skipWhitespace(line, i);
        continue;
      }
      if (line[i + 1] === '>') {
        tokens.push(makeToken(TokenType.ARROW, '=>', posRange(lineIdx, i, lineIdx, i + 2)));
        i += 2;
        i = skipWhitespace(line, i);
        continue;
      }
      tokens.push(makeToken(TokenType.EQ, '=', pos(lineIdx, i)));
      i++;
      i = skipWhitespace(line, i);
      continue;
    }
    if (ch === '!') {
      if (line[i + 1] === '=') {
        tokens.push(makeToken(TokenType.BANG_EQ, '!=', posRange(lineIdx, i, lineIdx, i + 2)));
        i += 2;
        i = skipWhitespace(line, i);
        continue;
      }
    }
    if (ch === '<') {
      if (line[i + 1] === '=') {
        tokens.push(makeToken(TokenType.LT_EQ, '<=', posRange(lineIdx, i, lineIdx, i + 2)));
        i += 2;
        i = skipWhitespace(line, i);
        continue;
      }
      tokens.push(makeToken(TokenType.LT, '<', pos(lineIdx, i)));
      i++;
      i = skipWhitespace(line, i);
      continue;
    }
    if (ch === '>') {
      if (line[i + 1] === '=') {
        tokens.push(makeToken(TokenType.GT_EQ, '>=', posRange(lineIdx, i, lineIdx, i + 2)));
        i += 2;
        i = skipWhitespace(line, i);
        continue;
      }
      tokens.push(makeToken(TokenType.GT, '>', pos(lineIdx, i)));
      i++;
      i = skipWhitespace(line, i);
      continue;
    }
    if (ch === '+') {
      if (line[i + 1] === '=') {
        tokens.push(makeToken(TokenType.PLUS_EQ, '+=', posRange(lineIdx, i, lineIdx, i + 2)));
        i += 2;
        i = skipWhitespace(line, i);
        continue;
      }
      tokens.push(makeToken(TokenType.PLUS, '+', pos(lineIdx, i)));
      i++;
      i = skipWhitespace(line, i);
      continue;
    }
    if (ch === '-') {
      if (line[i + 1] === '=') {
        tokens.push(makeToken(TokenType.MINUS_EQ, '-=', posRange(lineIdx, i, lineIdx, i + 2)));
        i += 2;
        i = skipWhitespace(line, i);
        continue;
      }
      tokens.push(makeToken(TokenType.MINUS, '-', pos(lineIdx, i)));
      i++;
      i = skipWhitespace(line, i);
      continue;
    }
    if (ch === '*') {
      if (line[i + 1] === '=') {
        tokens.push(makeToken(TokenType.STAR_EQ, '*=', posRange(lineIdx, i, lineIdx, i + 2)));
        i += 2;
        i = skipWhitespace(line, i);
        continue;
      }
      tokens.push(makeToken(TokenType.STAR, '*', pos(lineIdx, i)));
      i++;
      i = skipWhitespace(line, i);
      continue;
    }
    if (ch === '/') {
      if (line[i + 1] === '=') {
        tokens.push(makeToken(TokenType.SLASH_EQ, '/=', posRange(lineIdx, i, lineIdx, i + 2)));
        i += 2;
        i = skipWhitespace(line, i);
        continue;
      }
      tokens.push(makeToken(TokenType.SLASH, '/', pos(lineIdx, i)));
      i++;
      i = skipWhitespace(line, i);
      continue;
    }
    if (ch === '%') {
      if (line[i + 1] === '=') {
        tokens.push(makeToken(TokenType.PERCENT_EQ, '%=', posRange(lineIdx, i, lineIdx, i + 2)));
        i += 2;
        i = skipWhitespace(line, i);
        continue;
      }
      tokens.push(makeToken(TokenType.PERCENT, '%', pos(lineIdx, i)));
      i++;
      i = skipWhitespace(line, i);
      continue;
    }

    const single: Record<string, TokenType> = {
      '^': TokenType.CARET,
      '?': TokenType.QUESTION,
      '.': TokenType.DOT,
      ',': TokenType.COMMA,
      '(': TokenType.LPAREN,
      ')': TokenType.RPAREN,
      '[': TokenType.LBRACKET,
      ']': TokenType.RBRACKET,
    };
    if (single[ch]) {
      tokens.push(makeToken(single[ch], ch, pos(lineIdx, i)));
      i++;
      i = skipWhitespace(line, i);
      continue;
    }

    i++;
  }

  if (!isBlank) {
    tokens.push(makeToken(TokenType.NEWLINE, '\n', pos(lineIdx, line.length)));
  }

  return tokens;
}

function isLineOnlyComment(trimmed: string): boolean {
  return trimmed.startsWith('//');
}

function skipWhitespace(line: string, i: number): number {
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i++;
  return i;
}

function pos(line: number, char: number): Range {
  return {
    start: { line, character: char },
    end: { line, character: char + 1 },
  };
}

function posRange(startLine: number, startChar: number, endLine: number, endChar: number): Range {
  return {
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
  };
}

function makeToken(type: TokenType, value: string, range: Range): Token {
  return { type, value, range };
}
