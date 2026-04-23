import { tokenize, type Token, TokenType } from '../lexer';
import type {
  Program,
  Statement,
  Expression,
  ParseError,
  VarDecl,
  FunctionDecl,
  Assignment,
  IfStmt,
  ForStmt,
  WhileStmt,
  SwitchStmt,
  SwitchCase,
  ReturnStmt,
  BreakStmt,
  ContinueStmt,
  ExprStmt,
  Param,
  TypeAnnotation,
  Identifier,
  NumberLiteral,
  StringLiteral,
  BoolLiteral,
  NALiteral,
  ColorLiteral,
  CallExpr,
  Argument,
  BinaryExpr,
  UnaryExpr,
  TernaryExpr,
  IndexExpr,
  MemberExpr,
  TupleExpr,
  Range,
  TypeDecl,
  EnumDecl,
  ExportDecl,
  ImportDecl,
  TypeField,
  EnumMember,
} from '../ast';

export interface ParseResult {
  program: Program;
}

const TYPE_KEYWORDS = new Set([
  TokenType.KW_INT,
  TokenType.KW_FLOAT,
  TokenType.KW_BOOL,
  TokenType.KW_COLOR_TYPE,
  TokenType.KW_STRING_TYPE,
  TokenType.KW_LINE,
  TokenType.KW_LABEL,
  TokenType.KW_BOX,
  TokenType.KW_TABLE,
  TokenType.KW_ARRAY,
  TokenType.KW_MATRIX,
  TokenType.KW_MAP,
  TokenType.KW_POLYLINE,
]);

const QUALIFIERS = new Set([
  TokenType.KW_SERIES,
  TokenType.KW_SIMPLE,
  TokenType.KW_CONST,
  TokenType.KW_INPUT,
]);

class Parser {
  private tokens: Token[];
  private pos = 0;
  private errors: ParseError[] = [];
  private version: number | null = null;
  private versionRange: Range | null = null;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Program {
    this.skipNewlines();
    this.extractAnnotations();
    const body = this.parseStatements(0);
    const endPos = this.tokens[this.tokens.length - 1]?.range.end ?? {
      line: 0,
      character: 0,
    };
    return {
      type: 'Program',
      version: this.version,
      versionRange: this.versionRange,
      body,
      errors: this.errors,
      range: { start: { line: 0, character: 0 }, end: endPos },
    };
  }

  private extractAnnotations(): void {
    for (const tok of this.tokens) {
      if (tok.type !== TokenType.ANNOTATION) continue;
      const m = tok.value.match(/\/\/\s*@version\s*=\s*(\d+)/);
      if (!m) continue;
      const v = parseInt(m[1], 10);
      if (!Number.isFinite(v)) continue;
      this.version = v;
      this.versionRange = tok.range;
      break;
    }
  }

  private parseStatements(depth: number): Statement[] {
    const stmts: Statement[] = [];
    while (!this.isAtEnd()) {
      this.skipNewlines();
      if (this.isAtEnd()) break;
      if (this.check(TokenType.DEDENT) || this.check(TokenType.EOF)) break;
      try {
        const s = this.parseStatement(depth);
        if (s) stmts.push(s);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.errors.push({ message: msg, range: this.current().range });
        this.syncToNewline();
      }
    }
    return stmts;
  }

  private parseStatement(depth: number): Statement | null {
    const cur = this.current();

    if (cur.type === TokenType.KW_IF) return this.parseIf(depth);
    if (cur.type === TokenType.KW_FOR) return this.parseFor(depth);
    if (cur.type === TokenType.KW_WHILE) return this.parseWhile(depth);
    if (cur.type === TokenType.KW_SWITCH) return this.parseSwitch(depth);
    if (cur.type === TokenType.KW_RETURN) return this.parseReturn();
    if (cur.type === TokenType.KW_BREAK) {
      this.advance();
      this.consumeNewline();
      return { type: 'BreakStmt', range: cur.range } as BreakStmt;
    }
    if (cur.type === TokenType.KW_CONTINUE) {
      this.advance();
      this.consumeNewline();
      return { type: 'ContinueStmt', range: cur.range } as ContinueStmt;
    }
    if (cur.type === TokenType.ANNOTATION) {
      this.advance();
      this.consumeNewline();
      return null;
    }
    if (cur.type === TokenType.KW_EXPORT) {
      return this.parseExportDecl(depth);
    }
    if (cur.type === TokenType.KW_IMPORT) {
      return this.parseImportDecl(depth);
    }
    if (cur.type === TokenType.KW_TYPE) {
      return this.parseTypeDecl(depth);
    }
    if (cur.type === TokenType.KW_ENUM) {
      return this.parseEnumDecl(depth);
    }

    if (cur.type === TokenType.KW_METHOD) return this.parseFunctionDecl(depth, true);

    if (cur.type === TokenType.KW_VAR || cur.type === TokenType.KW_VARIP) {
      return this.parseVarDecl();
    }

    if (cur.type === TokenType.IDENT) {
      return this.parseIdentifierLed(depth);
    }

    if (this.isTypeStart()) {
      return this.parseTypedDecl();
    }

    return this.parseExprStmt();
  }

  private parseIdentifierLed(depth: number): Statement {
    if (this.isFunctionDeclAhead()) {
      return this.parseFunctionDecl(depth, false);
    }
    return this.parseExprOrAssignment();
  }

  private isFunctionDeclAhead(): boolean {
    let i = this.pos;
    if (this.tokens[i]?.type !== TokenType.IDENT) return false;
    i++;
    if (this.tokens[i]?.type !== TokenType.LPAREN) return false;
    let depth = 1;
    i++;
    while (i < this.tokens.length && depth > 0) {
      if (this.tokens[i].type === TokenType.LPAREN) depth++;
      else if (this.tokens[i].type === TokenType.RPAREN) depth--;
      i++;
    }
    return this.tokens[i]?.type === TokenType.ARROW;
  }

  private parseVarDecl(): VarDecl {
    const start = this.current().range.start;
    const modTok = this.advance();
    const modifier: 'var' | 'varip' =
      modTok.type === TokenType.KW_VARIP ? 'varip' : 'var';

    let typeAnnotation: TypeAnnotation | null = null;
    if (this.isTypeStart()) {
      typeAnnotation = this.parseTypeAnnotation();
    }

    const nameToken = this.expect(TokenType.IDENT, 'variable name');
    let init: Expression | null = null;
    if (this.check(TokenType.EQ)) {
      this.advance();
      init = this.parseExpression();
    }
    this.consumeNewline();
    return {
      type: 'VarDecl',
      modifier,
      typeAnnotation,
      name: nameToken.value,
      nameRange: nameToken.range,
      init,
      range: { start, end: this.prevRange().end },
    };
  }

  private parseTypedDecl(): VarDecl {
    const start = this.current().range.start;
    const typeAnnotation = this.parseTypeAnnotation();
    const nameToken = this.expect(TokenType.IDENT, 'variable name');
    let init: Expression | null = null;
    if (this.check(TokenType.EQ)) {
      this.advance();
      init = this.parseExpression();
    }
    this.consumeNewline();
    return {
      type: 'VarDecl',
      modifier: null,
      typeAnnotation,
      name: nameToken.value,
      nameRange: nameToken.range,
      init,
      range: { start, end: this.prevRange().end },
    };
  }

  private parseTypeAnnotation(): TypeAnnotation {
    const start = this.current().range.start;
    let qualifier: TypeAnnotation['qualifier'] = null;
    if (QUALIFIERS.has(this.current().type)) {
      qualifier = this.advance().value as TypeAnnotation['qualifier'];
    }
    const baseTok = this.advance();
    const baseType = baseTok.value;
    if (this.check(TokenType.LT)) {
      this.advance();
      while (!this.check(TokenType.GT) && !this.isAtEnd()) {
        this.advance();
      }
      this.expect(TokenType.GT, '>');
    }
    return {
      type: 'TypeAnnotation',
      qualifier,
      baseType,
      range: { start, end: this.prevRange().end },
    };
  }

  private parseTypeDecl(depth: number): TypeDecl {
    const start = this.current().range.start;
    this.expect(TokenType.KW_TYPE, 'type');
    const nameToken = this.expect(TokenType.IDENT, 'type name');
    this.consumeNewline();
    this.expect(TokenType.INDENT, 'indented block after type declaration');
    const fields: TypeField[] = [];
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check(TokenType.DEDENT) || this.isAtEnd()) break;
      const fieldStart = this.current().range.start;
      let typeAnnotation: TypeAnnotation | null = null;
      if (this.isTypeStart()) {
        typeAnnotation = this.parseTypeAnnotation();
      }
      const fieldName = this.expect(TokenType.IDENT, 'field name');
      let defaultValue: Expression | null = null;
      if (this.check(TokenType.EQ)) {
        this.advance();
        defaultValue = this.parseExpression();
      }
      this.consumeNewline();
      fields.push({
        type: 'TypeField',
        name: fieldName.value,
        typeAnnotation,
        defaultValue,
        range: { start: fieldStart, end: this.prevRange().end },
      });
    }
    if (this.check(TokenType.DEDENT)) this.advance();
    return {
      type: 'TypeDecl',
      name: nameToken.value,
      nameRange: nameToken.range,
      fields,
      range: { start, end: this.prevRange().end },
    };
  }

  private parseEnumDecl(depth: number): EnumDecl {
    const start = this.current().range.start;
    this.expect(TokenType.KW_ENUM, 'enum');
    const nameToken = this.expect(TokenType.IDENT, 'enum name');
    this.consumeNewline();
    this.expect(TokenType.INDENT, 'indented block after enum declaration');
    const members: EnumMember[] = [];
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check(TokenType.DEDENT) || this.isAtEnd()) break;
      const memberStart = this.current().range.start;
      const memberName = this.expect(TokenType.IDENT, 'enum member');
      let value: Expression | null = null;
      if (this.check(TokenType.EQ)) {
        this.advance();
        value = this.parseExpression();
      }
      this.consumeNewline();
      members.push({
        type: 'EnumMember',
        name: memberName.value,
        value,
        range: { start: memberStart, end: this.prevRange().end },
      });
    }
    if (this.check(TokenType.DEDENT)) this.advance();
    return {
      type: 'EnumDecl',
      name: nameToken.value,
      nameRange: nameToken.range,
      members,
      range: { start, end: this.prevRange().end },
    };
  }

  private parseExportDecl(depth: number): ExportDecl {
    const start = this.current().range.start;
    this.expect(TokenType.KW_EXPORT, 'export');
    const decl = this.parseStatement(depth);
    if (!decl) {
      throw new Error("Expected declaration after export");
    }
    return {
      type: 'ExportDecl',
      declaration: decl,
      range: { start, end: this.prevRange().end },
    };
  }

  private parseImportDecl(depth: number): ImportDecl {
    const start = this.current().range.start;
    this.expect(TokenType.KW_IMPORT, 'import');
    
    // Path can be multiple idents separated by slashes, let's just collect until 'as' or newline
    let path = '';
    while (!this.isAtEnd() && !this.check(TokenType.NEWLINE) && !this.check(TokenType.IDENT) && this.current().value !== 'as') {
      path += this.advance().value;
    }
    // Also if it's an IDENT but not 'as', it's part of the path
    while (!this.isAtEnd() && !this.check(TokenType.NEWLINE) && this.current().value !== 'as') {
      path += this.advance().value;
    }
    
    let alias: string | null = null;
    if (this.current().value === 'as') {
      this.advance(); // consume 'as'
      alias = this.expect(TokenType.IDENT, 'alias').value;
    }
    this.consumeNewline();
    
    return {
      type: 'ImportDecl',
      path: path.trim(),
      alias,
      range: { start, end: this.prevRange().end },
    };
  }

  private parseFunctionDecl(depth: number, isMethod: boolean): FunctionDecl {
    const start = this.current().range.start;
    if (isMethod) this.advance();
    const nameToken = this.expect(TokenType.IDENT, 'function name');
    this.expect(TokenType.LPAREN, '(');
    const params = this.parseParams();
    this.expect(TokenType.RPAREN, ')');
    this.expect(TokenType.ARROW, '=>');

    let body: Statement[];
    if (this.check(TokenType.NEWLINE)) {
      this.advance();
      this.expect(TokenType.INDENT, 'indented block');
      body = this.parseStatements(depth + 1);
      if (this.check(TokenType.DEDENT)) this.advance();
    } else {
      const expr = this.parseExpression();
      body = [{ type: 'ReturnStmt', value: expr, range: expr.range } as ReturnStmt];
      this.consumeNewline();
    }

    return {
      type: 'FunctionDecl',
      name: nameToken.value,
      nameRange: nameToken.range,
      params,
      body,
      isMethod,
      range: { start, end: this.prevRange().end },
    };
  }

  private parseParams(): Param[] {
    const params: Param[] = [];
    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      const start = this.current().range.start;
      let typeAnnotation: TypeAnnotation | null = null;
      if (this.isTypeStart()) {
        typeAnnotation = this.parseTypeAnnotation();
      }
      const name = this.expect(TokenType.IDENT, 'parameter name');
      let defaultValue: Expression | null = null;
      if (this.check(TokenType.EQ)) {
        this.advance();
        defaultValue = this.parseExpression();
      }
      params.push({
        type: 'Param',
        name: name.value,
        typeAnnotation,
        defaultValue,
        range: { start, end: this.prevRange().end },
      });
      if (this.check(TokenType.RPAREN)) break;
      if (!this.check(TokenType.COMMA)) break;
      this.advance();
    }
    return params;
  }

  private parseIf(depth: number): IfStmt {
    const start = this.current().range.start;
    this.expect(TokenType.KW_IF, 'if');
    const condition = this.parseExpression();
    this.consumeNewline();
    this.expect(TokenType.INDENT, 'indented block after if');
    const consequent = this.parseStatements(depth + 1);
    if (this.check(TokenType.DEDENT)) this.advance();

    let alternate: IfStmt['alternate'] = null;
    this.skipNewlines();
    if (this.check(TokenType.KW_ELSE)) {
      this.advance();
      if (this.check(TokenType.KW_IF)) {
        alternate = this.parseIf(depth);
      } else {
        this.consumeNewline();
        this.expect(TokenType.INDENT, 'indented block after else');
        alternate = this.parseStatements(depth + 1);
        if (this.check(TokenType.DEDENT)) this.advance();
      }
    }

    return {
      type: 'IfStmt',
      condition,
      consequent,
      alternate,
      range: { start, end: this.prevRange().end },
    };
  }

  private parseFor(depth: number): ForStmt {
    const start = this.current().range.start;
    this.expect(TokenType.KW_FOR, 'for');
    const varToken = this.expect(TokenType.IDENT, 'loop variable');
    this.expect(TokenType.EQ, '=');
    const from = this.parseExpression();
    this.expect(TokenType.KW_TO, 'to');
    const to = this.parseExpression();
    let by: Expression | null = null;
    if (this.check(TokenType.KW_BY)) {
      this.advance();
      by = this.parseExpression();
    }
    this.consumeNewline();
    this.expect(TokenType.INDENT, 'indented block after for');
    const body = this.parseStatements(depth + 1);
    if (this.check(TokenType.DEDENT)) this.advance();
    return {
      type: 'ForStmt',
      variable: varToken.value,
      variableRange: varToken.range,
      from,
      to,
      by,
      body,
      range: { start, end: this.prevRange().end },
    };
  }

  private parseWhile(depth: number): WhileStmt {
    const start = this.current().range.start;
    this.expect(TokenType.KW_WHILE, 'while');
    const condition = this.parseExpression();
    this.consumeNewline();
    this.expect(TokenType.INDENT, 'indented block after while');
    const body = this.parseStatements(depth + 1);
    if (this.check(TokenType.DEDENT)) this.advance();
    return { type: 'WhileStmt', condition, body, range: { start, end: this.prevRange().end } };
  }

  private parseSwitch(depth: number): SwitchStmt {
    const start = this.current().range.start;
    this.expect(TokenType.KW_SWITCH, 'switch');
    let subject: Expression | null = null;
    if (!this.check(TokenType.NEWLINE)) {
      subject = this.parseExpression();
    }
    this.consumeNewline();
    this.expect(TokenType.INDENT, 'indented block after switch');
    const cases: SwitchCase[] = [];
    const defaultBody: Statement[] | null = null;

    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check(TokenType.DEDENT) || this.isAtEnd()) break;
      const caseExpr = this.parseExpression();
      this.expect(TokenType.ARROW, '=>');
      this.consumeNewline();
      let body: Statement[];
      if (this.check(TokenType.INDENT)) {
        this.advance();
        body = this.parseStatements(depth + 2);
        if (this.check(TokenType.DEDENT)) this.advance();
      } else {
        const e = this.parseExpression();
        this.consumeNewline();
        body = [{ type: 'ExprStmt', expression: e, range: e.range } as ExprStmt];
      }
      cases.push({
        type: 'SwitchCase',
        value: caseExpr,
        body,
        range: { start: caseExpr.range.start, end: this.prevRange().end },
      });
    }
    if (this.check(TokenType.DEDENT)) this.advance();

    return {
      type: 'SwitchStmt',
      subject,
      cases,
      defaultBody,
      range: { start, end: this.prevRange().end },
    };
  }

  private parseReturn(): ReturnStmt {
    const start = this.current().range.start;
    this.expect(TokenType.KW_RETURN, 'return');
    let value: Expression | null = null;
    if (!this.check(TokenType.NEWLINE) && !this.isAtEnd()) {
      value = this.parseExpression();
    }
    this.consumeNewline();
    return { type: 'ReturnStmt', value, range: { start, end: this.prevRange().end } };
  }

  private parseExprOrAssignment(): Statement {
    const expr = this.parseExpression();
    if (
      this.check(TokenType.WALRUS) ||
      this.check(TokenType.PLUS_EQ) ||
      this.check(TokenType.MINUS_EQ) ||
      this.check(TokenType.STAR_EQ) ||
      this.check(TokenType.SLASH_EQ) ||
      this.check(TokenType.PERCENT_EQ)
    ) {
      const opTok = this.advance();
      const value = this.parseExpression();
      this.consumeNewline();
      return {
        type: 'Assignment',
        operator: opTok.value,
        target: expr,
        value,
        range: { start: expr.range.start, end: value.range.end },
      } as Assignment;
    }
    if (this.check(TokenType.EQ)) {
      this.advance();
      const value = this.parseExpression();
      this.consumeNewline();
      if (expr.type === 'Identifier') {
        return {
          type: 'VarDecl',
          modifier: null,
          typeAnnotation: null,
          name: expr.name,
          nameRange: expr.range,
          init: value,
          range: { start: expr.range.start, end: value.range.end },
        } as VarDecl;
      }
    }
    this.consumeNewline();
    return { type: 'ExprStmt', expression: expr, range: expr.range } as ExprStmt;
  }

  private parseExprStmt(): ExprStmt {
    const expr = this.parseExpression();
    this.consumeNewline();
    return { type: 'ExprStmt', expression: expr, range: expr.range };
  }

  private parseExpression(): Expression {
    return this.parseTernary();
  }

  private parseTernary(): Expression {
    const expr = this.parseOr();
    if (this.check(TokenType.QUESTION)) {
      const start = expr.range.start;
      this.advance();
      const consequent = this.parseTernary();
      this.expect(TokenType.COLON, ':');
      const alternate = this.parseTernary();
      return {
        type: 'TernaryExpr',
        condition: expr,
        consequent,
        alternate,
        range: { start, end: alternate.range.end },
      } as TernaryExpr;
    }
    return expr;
  }

  private parseOr(): Expression {
    let left = this.parseAnd();
    while (this.check(TokenType.KW_OR)) {
      const op = this.advance().value;
      const right = this.parseAnd();
      left = {
        type: 'BinaryExpr',
        operator: op,
        left,
        right,
        range: { start: left.range.start, end: right.range.end },
      } as BinaryExpr;
    }
    return left;
  }

  private parseAnd(): Expression {
    let left = this.parseNot();
    while (this.check(TokenType.KW_AND)) {
      const op = this.advance().value;
      const right = this.parseNot();
      left = {
        type: 'BinaryExpr',
        operator: op,
        left,
        right,
        range: { start: left.range.start, end: right.range.end },
      } as BinaryExpr;
    }
    return left;
  }

  private parseNot(): Expression {
    if (this.check(TokenType.KW_NOT)) {
      const start = this.current().range.start;
      this.advance();
      const operand = this.parseNot();
      return {
        type: 'UnaryExpr',
        operator: 'not',
        operand,
        range: { start, end: operand.range.end },
      } as UnaryExpr;
    }
    return this.parseComparison();
  }

  private parseComparison(): Expression {
    let left = this.parseAddSub();
    const CMP = new Set([
      TokenType.EQ_EQ,
      TokenType.BANG_EQ,
      TokenType.LT,
      TokenType.GT,
      TokenType.LT_EQ,
      TokenType.GT_EQ,
    ]);
    while (CMP.has(this.current().type)) {
      const op = this.advance().value;
      const right = this.parseAddSub();
      left = {
        type: 'BinaryExpr',
        operator: op,
        left,
        right,
        range: { start: left.range.start, end: right.range.end },
      } as BinaryExpr;
    }
    return left;
  }

  private parseAddSub(): Expression {
    let left = this.parseMulDiv();
    while (this.check(TokenType.PLUS) || this.check(TokenType.MINUS)) {
      const op = this.advance().value;
      const right = this.parseMulDiv();
      left = {
        type: 'BinaryExpr',
        operator: op,
        left,
        right,
        range: { start: left.range.start, end: right.range.end },
      } as BinaryExpr;
    }
    return left;
  }

  private parseMulDiv(): Expression {
    let left = this.parseUnary();
    while (this.check(TokenType.STAR) || this.check(TokenType.SLASH) || this.check(TokenType.PERCENT)) {
      const op = this.advance().value;
      const right = this.parseUnary();
      left = {
        type: 'BinaryExpr',
        operator: op,
        left,
        right,
        range: { start: left.range.start, end: right.range.end },
      } as BinaryExpr;
    }
    return left;
  }

  private parseUnary(): Expression {
    if (this.check(TokenType.MINUS) || this.check(TokenType.PLUS)) {
      const start = this.current().range.start;
      const op = this.advance().value;
      const operand = this.parseUnary();
      return {
        type: 'UnaryExpr',
        operator: op,
        operand,
        range: { start, end: operand.range.end },
      } as UnaryExpr;
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expression {
    let expr = this.parsePrimary();

    while (true) {
      if (this.check(TokenType.LBRACKET)) {
        const start = expr.range.start;
        this.advance();
        const index = this.parseExpression();
        this.expect(TokenType.RBRACKET, ']');
        expr = {
          type: 'IndexExpr',
          object: expr,
          index,
          range: { start, end: this.prevRange().end },
        } as IndexExpr;
      } else if (this.check(TokenType.DOT)) {
        const start = expr.range.start;
        this.advance();
        const propToken = this.expect(TokenType.IDENT, 'property name');
        if (this.check(TokenType.LPAREN)) {
          this.advance();
          const args = this.parseArgs();
          this.expect(TokenType.RPAREN, ')');
          const callee: MemberExpr = {
            type: 'MemberExpr',
            object: expr,
            property: propToken.value,
            propertyRange: propToken.range,
            range: { start, end: propToken.range.end },
          };
          expr = {
            type: 'CallExpr',
            callee,
            args,
            range: { start, end: this.prevRange().end },
          } as CallExpr;
        } else {
          expr = {
            type: 'MemberExpr',
            object: expr,
            property: propToken.value,
            propertyRange: propToken.range,
            range: { start, end: propToken.range.end },
          } as MemberExpr;
        }
      } else if (this.check(TokenType.LPAREN)) {
        const start = expr.range.start;
        this.advance();
        const args = this.parseArgs();
        this.expect(TokenType.RPAREN, ')');
        expr = {
          type: 'CallExpr',
          callee: expr,
          args,
          range: { start, end: this.prevRange().end },
        } as CallExpr;
      } else {
        break;
      }
    }

    return expr;
  }

  private parseArgs(): Argument[] {
    const args: Argument[] = [];
    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      let name: string | null = null;
      if (this.check(TokenType.IDENT) && this.peek(1)?.type === TokenType.EQ) {
        name = this.advance().value;
        this.advance();
      }
      const value = this.parseExpression();
      args.push({
        type: 'Argument',
        name,
        value,
        range: { start: value.range.start, end: value.range.end },
      });
      if (this.check(TokenType.RPAREN)) break;
      if (!this.check(TokenType.COMMA)) break;
      this.advance();
    }
    return args;
  }

  private parsePrimary(): Expression {
    const cur = this.current();
    const range = cur.range;

    if (cur.type === TokenType.KW_TRUE) {
      this.advance();
      return { type: 'BoolLiteral', value: true, range } as BoolLiteral;
    }
    if (cur.type === TokenType.KW_FALSE) {
      this.advance();
      return { type: 'BoolLiteral', value: false, range } as BoolLiteral;
    }
    if (cur.type === TokenType.KW_NA) {
      this.advance();
      return { type: 'NALiteral', range } as NALiteral;
    }
    if (cur.type === TokenType.NUMBER) {
      this.advance();
      return {
        type: 'NumberLiteral',
        value: parseFloat(cur.value),
        raw: cur.value,
        range,
      } as NumberLiteral;
    }
    if (cur.type === TokenType.STRING) {
      this.advance();
      return { type: 'StringLiteral', value: cur.value, range } as StringLiteral;
    }
    if (cur.type === TokenType.COLOR) {
      this.advance();
      return { type: 'ColorLiteral', value: cur.value, range } as ColorLiteral;
    }
    if (cur.type === TokenType.IDENT) {
      this.advance();
      return { type: 'Identifier', name: cur.value, range } as Identifier;
    }
    if (TYPE_KEYWORDS.has(cur.type) || QUALIFIERS.has(cur.type)) {
      this.advance();
      return { type: 'Identifier', name: cur.value, range } as Identifier;
    }

    if (cur.type === TokenType.LPAREN) {
      this.advance();
      const expr = this.parseExpression();
      if (this.check(TokenType.COMMA)) {
        const elements: Expression[] = [expr];
        while (this.check(TokenType.COMMA)) {
          this.advance();
          elements.push(this.parseExpression());
        }
        this.expect(TokenType.RPAREN, ')');
        return {
          type: 'TupleExpr',
          elements,
          range: { start: range.start, end: this.prevRange().end },
        } as TupleExpr;
      }
      this.expect(TokenType.RPAREN, ')');
      return expr;
    }

    const errMsg = `Unexpected token '${cur.value}' (${cur.type})`;
    this.errors.push({ message: errMsg, range: cur.range });
    this.advance();
    return { type: 'NALiteral', range: cur.range } as NALiteral;
  }

  private isTypeStart(): boolean {
    const t = this.current().type;
    if (QUALIFIERS.has(t)) {
      const n = this.peek(1)?.type;
      return n !== undefined && TYPE_KEYWORDS.has(n);
    }
    return TYPE_KEYWORDS.has(t);
  }

  private skipNewlines(): void {
    while (
      this.check(TokenType.NEWLINE) ||
      this.check(TokenType.INDENT) ||
      this.check(TokenType.DEDENT)
    ) {
      this.advance();
    }
  }

  private consumeNewline(): void {
    if (this.check(TokenType.NEWLINE)) this.advance();
  }

  private syncToNewline(): void {
    while (!this.isAtEnd() && !this.check(TokenType.NEWLINE) && !this.check(TokenType.DEDENT)) {
      this.advance();
    }
    this.consumeNewline();
  }

  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  private advance(): Token {
    const tok = this.tokens[this.pos];
    if (this.pos < this.tokens.length - 1) this.pos++;
    return tok;
  }

  private expect(type: TokenType, desc: string): Token {
    if (!this.check(type)) {
      const cur = this.current();
      throw new Error(
        `Expected ${desc} but got '${cur.value}' (${cur.type}) at ${cur.range.start.line}:${cur.range.start.character}`,
      );
    }
    return this.advance();
  }

  private current(): Token {
    return this.tokens[Math.min(this.pos, this.tokens.length - 1)];
  }

  private prevRange(): Range {
    const prev = this.tokens[Math.max(0, this.pos - 1)];
    return prev ? prev.range : { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
  }

  private peek(offset: number): Token | undefined {
    return this.tokens[this.pos + offset];
  }

  private isAtEnd(): boolean {
    return this.current().type === TokenType.EOF;
  }
}

export function parseProgram(source: string): ParseResult {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  return { program: parser.parse() };
}
