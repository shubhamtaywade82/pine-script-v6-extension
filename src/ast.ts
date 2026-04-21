/** Structural AST types (lexer + tree parser). */

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface ASTNode {
  type: string;
  range: Range;
}

export interface Program extends ASTNode {
  type: 'Program';
  version: number | null;
  versionRange: Range | null;
  body: Statement[];
  errors: ParseError[];
}

export interface ParseError {
  message: string;
  range: Range;
}

export type Statement =
  | VarDecl
  | FunctionDecl
  | Assignment
  | IfStmt
  | ForStmt
  | WhileStmt
  | SwitchStmt
  | ReturnStmt
  | BreakStmt
  | ContinueStmt
  | ExprStmt;

export interface VarDecl extends ASTNode {
  type: 'VarDecl';
  modifier: 'var' | 'varip' | null;
  typeAnnotation: TypeAnnotation | null;
  name: string;
  nameRange: Range;
  init: Expression | null;
}

export interface TypeAnnotation extends ASTNode {
  type: 'TypeAnnotation';
  qualifier: 'series' | 'simple' | 'const' | 'input' | null;
  baseType: string;
}

export interface FunctionDecl extends ASTNode {
  type: 'FunctionDecl';
  name: string;
  nameRange: Range;
  params: Param[];
  body: Statement[];
  isMethod: boolean;
}

export interface Param extends ASTNode {
  type: 'Param';
  name: string;
  typeAnnotation: TypeAnnotation | null;
  defaultValue: Expression | null;
}

export interface Assignment extends ASTNode {
  type: 'Assignment';
  operator: string;
  target: Expression;
  value: Expression;
}

export interface IfStmt extends ASTNode {
  type: 'IfStmt';
  condition: Expression;
  consequent: Statement[];
  alternate: Statement[] | IfStmt | null;
}

export interface ForStmt extends ASTNode {
  type: 'ForStmt';
  variable: string;
  variableRange: Range;
  from: Expression;
  to: Expression;
  by: Expression | null;
  body: Statement[];
}

export interface WhileStmt extends ASTNode {
  type: 'WhileStmt';
  condition: Expression;
  body: Statement[];
}

export interface SwitchStmt extends ASTNode {
  type: 'SwitchStmt';
  subject: Expression | null;
  cases: SwitchCase[];
  defaultBody: Statement[] | null;
}

export interface SwitchCase extends ASTNode {
  type: 'SwitchCase';
  value: Expression;
  body: Statement[];
}

export interface ReturnStmt extends ASTNode {
  type: 'ReturnStmt';
  value: Expression | null;
}

export interface BreakStmt extends ASTNode {
  type: 'BreakStmt';
}

export interface ContinueStmt extends ASTNode {
  type: 'ContinueStmt';
}

export interface ExprStmt extends ASTNode {
  type: 'ExprStmt';
  expression: Expression;
}

export type Expression =
  | Identifier
  | NumberLiteral
  | StringLiteral
  | BoolLiteral
  | NALiteral
  | ColorLiteral
  | CallExpr
  | BinaryExpr
  | UnaryExpr
  | TernaryExpr
  | IndexExpr
  | MemberExpr
  | TupleExpr
  | LambdaExpr;

export interface Identifier extends ASTNode {
  type: 'Identifier';
  name: string;
}

export interface NumberLiteral extends ASTNode {
  type: 'NumberLiteral';
  value: number;
  raw: string;
}

export interface StringLiteral extends ASTNode {
  type: 'StringLiteral';
  value: string;
}

export interface BoolLiteral extends ASTNode {
  type: 'BoolLiteral';
  value: boolean;
}

export interface NALiteral extends ASTNode {
  type: 'NALiteral';
}

export interface ColorLiteral extends ASTNode {
  type: 'ColorLiteral';
  value: string;
}

export interface CallExpr extends ASTNode {
  type: 'CallExpr';
  callee: Expression;
  args: Argument[];
}

export interface Argument extends ASTNode {
  type: 'Argument';
  name: string | null;
  value: Expression;
}

export interface BinaryExpr extends ASTNode {
  type: 'BinaryExpr';
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpr extends ASTNode {
  type: 'UnaryExpr';
  operator: string;
  operand: Expression;
}

export interface TernaryExpr extends ASTNode {
  type: 'TernaryExpr';
  condition: Expression;
  consequent: Expression;
  alternate: Expression;
}

export interface IndexExpr extends ASTNode {
  type: 'IndexExpr';
  object: Expression;
  index: Expression;
}

export interface MemberExpr extends ASTNode {
  type: 'MemberExpr';
  object: Expression;
  property: string;
  propertyRange: Range;
}

export interface TupleExpr extends ASTNode {
  type: 'TupleExpr';
  elements: Expression[];
}

export interface LambdaExpr extends ASTNode {
  type: 'LambdaExpr';
  params: Param[];
  body: Statement[] | Expression;
}
