import type { MathNode } from 'mathjs';
import { Dual, dConst, add, sub, mul, div, pow, neg, sin, cos, exp, log, sqrt, abs } from './dual';

/** Environment: variable name → its dual (seeded value + derivative). */
export type DualEnv = Record<string, Dual>;

/** Named constants that parse as SymbolNode in math.js. */
const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
};

/** Elementary single-argument functions (FunctionNode). */
const UNARY_FNS: Record<string, (a: Dual) => Dual> = {
  sin,
  cos,
  exp,
  log,
  sqrt,
  abs,
};

/**
 * Recursively evaluate a parsed math.js AST node with dual-number arithmetic.
 * Dispatch is on node.type, and for OperatorNode on node.fn (a STRING:
 * 'add'/'subtract'/'multiply'/'divide'/'pow'/'unaryMinus'). Note the asymmetry:
 * OperatorNode.fn is a string, but FunctionNode.fn is an object — read its name
 * via FunctionNode.name. pi/e/tau are SymbolNodes resolved as constants.
 */
export function evalDual(node: MathNode, env: DualEnv): Dual {
  switch (node.type) {
    case 'ConstantNode':
      return dConst((node as unknown as { value: number }).value);

    case 'SymbolNode': {
      const name = (node as unknown as { name: string }).name;
      if (name in env) return env[name];
      if (name in CONSTANTS) return dConst(CONSTANTS[name]);
      throw new Error(`Unknown symbol: ${name}`);
    }

    case 'ParenthesisNode':
      return evalDual((node as unknown as { content: MathNode }).content, env);

    case 'OperatorNode': {
      const op = node as unknown as { fn: string; args: MathNode[] };
      if (op.fn === 'unaryMinus') {
        return neg(evalDual(op.args[0], env));
      }
      const a = evalDual(op.args[0], env);
      const b = evalDual(op.args[1], env);
      switch (op.fn) {
        case 'add':
          return add(a, b);
        case 'subtract':
          return sub(a, b);
        case 'multiply':
          return mul(a, b);
        case 'divide':
          return div(a, b);
        case 'pow':
          return pow(a, b);
        default:
          throw new Error(`Unsupported operator: ${op.fn}`);
      }
    }

    case 'FunctionNode': {
      const fn = node as unknown as { name: string; args: MathNode[] };
      const impl = UNARY_FNS[fn.name];
      if (!impl) throw new Error(`Unsupported function: ${fn.name}`);
      if (fn.args.length !== 1) {
        throw new Error(`Function ${fn.name} expects 1 argument, got ${fn.args.length}`);
      }
      return impl(evalDual(fn.args[0], env));
    }

    default:
      throw new Error(`Unsupported node type: ${node.type}`);
  }
}
