import type { Expression, CallExpr } from '../ast';
import { calleeDisplayName } from '../parser/parsedDocumentFromProgram';
import type { InferredType } from './pineTypeModel';
import { literalType, unify, UNKNOWN_SERIES } from './pineTypeModel';

/** Built-ins that evaluate to series float in typical Pine usage. */
const SERIES_FLOAT_IDS = new Set([
  'open',
  'high',
  'low',
  'close',
  'volume',
  'time',
  'bar_index',
  'hl2',
  'hlc3',
  'ohlc4',
]);

/** Call names whose result is treated as series float when unknown arity. */
const DEFAULT_SERIES_FLOAT_CALL_PREFIXES = ['ta.', 'math.'];

function callReturnsSeriesFloat(name: string): boolean {
  if (name === 'nz' || name === 'fixnan' || name === 'na') return false;
  for (const p of DEFAULT_SERIES_FLOAT_CALL_PREFIXES) {
    if (name.startsWith(p)) return true;
  }
  return false;
}

export type LocalTypeEnv = Map<string, InferredType>;

export function inferExpressionType(expr: Expression, locals: LocalTypeEnv): InferredType {
  switch (expr.type) {
    case 'NumberLiteral':
      return literalType(Number.isInteger(expr.value) ? 'int' : 'float', false);
    case 'BoolLiteral':
      return literalType('bool', false);
    case 'StringLiteral':
      return literalType('string', false);
    case 'ColorLiteral':
      return literalType('color', false);
    case 'NALiteral':
      return { base: 'unknown', isSeries: false };
    case 'Identifier': {
      const id = expr.name;
      const bound = locals.get(id);
      if (bound) return bound;
      if (SERIES_FLOAT_IDS.has(id)) return { base: 'float', isSeries: true };
      return UNKNOWN_SERIES;
    }
    case 'UnaryExpr': {
      const t = inferExpressionType(expr.operand, locals);
      if (expr.operator === 'not') return { base: 'bool', isSeries: t.isSeries };
      return t;
    }
    case 'BinaryExpr': {
      const L = inferExpressionType(expr.left, locals);
      const R = inferExpressionType(expr.right, locals);
      if (expr.operator === 'and' || expr.operator === 'or') {
        return { base: 'bool', isSeries: L.isSeries || R.isSeries };
      }
      return unify(L, R);
    }
    case 'TernaryExpr': {
      const c = inferExpressionType(expr.condition, locals);
      const a = inferExpressionType(expr.consequent, locals);
      const b = inferExpressionType(expr.alternate, locals);
      return unify(unify(c, a), b);
    }
    case 'IndexExpr': {
      const obj = inferExpressionType(expr.object, locals);
      const idx = inferExpressionType(expr.index, locals);
      return unify(obj, idx);
    }
    case 'MemberExpr':
      return inferExpressionType(expr.object, locals);
    case 'TupleExpr':
      return expr.elements.length
        ? inferExpressionType(expr.elements[0], locals)
        : UNKNOWN_SERIES;
    case 'CallExpr':
      return inferCallExprType(expr, locals);
    case 'LambdaExpr':
      return UNKNOWN_SERIES;
    default:
      return UNKNOWN_SERIES;
  }
}

function inferCallExprType(call: CallExpr, locals: LocalTypeEnv): InferredType {
  const name = calleeDisplayName(call.callee);
  if (!name) return UNKNOWN_SERIES;
  if (name === 'na' || name === 'nz' || name === 'fixnan') {
    const a0 = call.args[0]?.value;
    if (a0) return inferExpressionType(a0, locals);
    return UNKNOWN_SERIES;
  }
  if (name.startsWith('input.')) {
    if (name === 'input.bool') return { base: 'bool', isSeries: false };
    if (name === 'input.string' || name === 'input.text_area') return { base: 'string', isSeries: false };
    if (name === 'input.color') return { base: 'color', isSeries: false };
    if (name === 'input.int') return { base: 'int', isSeries: false };
    return { base: 'float', isSeries: false };
  }
  if (callReturnsSeriesFloat(name)) return { base: 'float', isSeries: true };
  for (const arg of call.args) {
    const t = inferExpressionType(arg.value, locals);
    if (t.isSeries) return { base: t.base, isSeries: true };
  }
  return { base: 'unknown', isSeries: false };
}
