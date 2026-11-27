/**
 * Tests for CALC Mode (fx-570EX Calculate)
 *
 * Verifies:
 * 1. CALC mode metadata and status indicator
 * 2. Stored Ans and post-calculation continuity via AUTO_ANS_KEY_CLASS:
 *    - Binary operators (+, -, ×, ÷, nPr, nCr, ×10^x, ^) auto-insert Ans first
 *    - Postfix operators (x², x³, x⁻¹, x!, %, °) auto-insert Ans first
 *    - Functions (sin, cos, tan, inverses, log, ln, log_□, √, ³√, x√) start fresh (no Ans)
 *    - Templates (■/□, ∫dx, d/dx, Σ, Pol(, Rec() start fresh (no Ans)
 *    - Digits, (, (-), π, e, variables (including C with VAR), Ans start fresh (no Ans)
 *    - Normal editing applies once expression is no longer just evaluated
 */

import { calcModeModule } from '../calcMode';
import { evaluateMathExpression } from '../../calcEngine';
import {
  classifyAutoAnsKey,
  shouldAutoInsertAns,
} from '../../autoAns';
import {
  createInitialAstState,
  insertToken,
  insertPostfix,
  insertFraction,
  insertLogBase,
  insertIntegral,
  insertPower,
  insertScientificTenPower,
  astToExpression,
  parseStringToAst,
} from '../../mathAst';

export function runCalcModeTests(): { name: string; passed: boolean; details?: string }[] {
  const simulatePostEvalTransition = (key: string, tokenType?: 'DEFAULT' | 'OP_NPR' | 'OP_NCR' | 'VAR' | 'FUNC') =>
    shouldAutoInsertAns(key, tokenType) ? parseStringToAst('Ans') : createInitialAstState();

  const tests = [
    {
      name: 'CALC mode metadata is intact',
      test: () => calcModeModule.id === 'CALC' && calcModeModule.isImplemented,
    },
    {
      name: 'CALC status indicator is empty string (no override)',
      test: () => calcModeModule.getIndicator(calcModeModule.getInitialState()) === '',
    },
    {
      name: 'CALC keymap has zero overrides (all keys fall through)',
      test: () => Object.keys(calcModeModule.keymap.overrides).length === 0,
    },

    // Binary operators after '='
    {
      name: '2+3= then +4 → Ans+4 = 9',
      test: () => {
        const r1 = evaluateMathExpression('2+3', 'DEG', {}, 0);
        if (!r1.success || r1.result !== 5) return false;
        let ast = simulatePostEvalTransition('+');
        ast = insertToken(ast, '+');
        ast = insertToken(ast, '4');
        if (astToExpression(ast.root) !== 'Ans+4') return false;
        const r2 = evaluateMathExpression(astToExpression(ast.root), 'DEG', {}, r1.result);
        return r2.success && r2.result === 9;
      },
    },
    {
      name: '= then ÷ puts Ans in numerator and cursor in denominator',
      test: () => {
        let ast = simulatePostEvalTransition('÷');
        ast = insertFraction(ast);
        return (
          ast.root.length === 1 &&
          ast.root[0].type === 'frac' &&
          astToExpression(ast.root[0].num) === 'Ans' &&
          ast.root[0].den.length === 0 &&
          ast.cursor.slotId === `${ast.root[0].id}_den`
        );
      },
    },
    {
      name: '= then ^ (x^□) puts Ans in base and cursor in exponent',
      test: () => {
        let ast = simulatePostEvalTransition('^');
        ast = insertPower(ast);
        return (
          ast.root.length === 1 &&
          ast.root[0].type === 'power' &&
          astToExpression(ast.root[0].base) === 'Ans' &&
          ast.cursor.slotId === `${ast.root[0].id}_exp`
        );
      },
    },
    {
      name: '= then ×10^x produces Ans×10^□',
      test: () => {
        let ast = simulatePostEvalTransition('×10^x');
        ast = insertScientificTenPower(ast);
        return (
          ast.root.length === 3 &&
          ast.root[0].type === 'token' &&
          ast.root[0].val === 'Ans' &&
          ast.root[1].type === 'token' &&
          ast.root[1].val === '×' &&
          ast.root[2].type === 'power' &&
          ast.cursor.slotId === `${ast.root[2].id}_exp`
        );
      },
    },
    {
      name: '5= then nPr 2 → 20 and 5= then nCr 2 → 10',
      test: () => {
        let astP = simulatePostEvalTransition('P', 'OP_NPR');
        astP = insertToken(astP, 'P', 'OP_NPR');
        astP = insertToken(astP, '2');
        const rP = evaluateMathExpression(astToExpression(astP.root), 'DEG', {}, 5);

        let astC = simulatePostEvalTransition('C', 'OP_NCR');
        astC = insertToken(astC, 'C', 'OP_NCR');
        astC = insertToken(astC, '2');
        const rC = evaluateMathExpression(astToExpression(astC.root), 'DEG', {}, 5);

        return rP.success && rP.result === 20 && rC.success && rC.result === 10;
      },
    },

    // Postfix operators after '='
    {
      name: '5= then x² → Ans² = 25',
      test: () => {
        let ast = simulatePostEvalTransition('²');
        ast = insertPostfix(ast, '²');
        const expr = astToExpression(ast.root);
        const r2 = evaluateMathExpression(expr, 'DEG', {}, 5);
        return expr === '((Ans)^2)' && r2.success && r2.result === 25;
      },
    },
    {
      name: '5= then x⁻¹ → Ans⁻¹ = 0.2',
      test: () => {
        let ast = simulatePostEvalTransition('⁻¹');
        ast = insertPostfix(ast, '⁻¹');
        const expr = astToExpression(ast.root);
        const r2 = evaluateMathExpression(expr, 'DEG', {}, 5);
        return expr === '((Ans)^(-1))' && r2.success && Math.abs(r2.result! - 0.2) < 1e-9;
      },
    },
    {
      name: '= then °′″ wraps Ans as Ans°',
      test: () => {
        let ast = simulatePostEvalTransition('°');
        ast = insertPostfix(ast, '°');
        return astToExpression(ast.root) === '(Ans)°';
      },
    },
    {
      name: 'All binary and postfix classifications match lookup table',
      test: () =>
        ['+', '-', '×', '÷', 'nPr', 'nCr', '×10^x', '^'].every(
          (k) => classifyAutoAnsKey(k) === 'binary'
        ) &&
        ['²', '³', '⁻¹', '!', '%', '°'].every(
          (k) => classifyAutoAnsKey(k) === 'postfix'
        ),
    },

    // Keys that start fresh (NO Ans)
    {
      name: '= then log_□ gives empty log_□(□) with cursor in base slot and no Ans',
      test: () => {
        let ast = simulatePostEvalTransition('log_□');
        ast = insertLogBase(ast);
        return (
          ast.root.length === 1 &&
          ast.root[0].type === 'logBase' &&
          ast.root[0].base.length === 0 &&
          ast.root[0].arg.length === 0 &&
          ast.cursor.slotId === `${ast.root[0].id}_base`
        );
      },
    },
    {
      name: '= then ∫dx gives empty integral with cursor in integrand and no Ans',
      test: () => {
        let ast = simulatePostEvalTransition('∫dx');
        ast = insertIntegral(ast);
        return (
          ast.root.length === 1 &&
          ast.root[0].type === 'int' &&
          ast.root[0].integrand.length === 0 &&
          ast.cursor.slotId === `${ast.root[0].id}_integrand`
        );
      },
    },
    {
      name: '= then ■/□ gives empty fraction with cursor in numerator and no Ans',
      test: () => {
        let ast = simulatePostEvalTransition('■/□');
        ast = insertFraction(ast);
        return (
          ast.root.length === 1 &&
          ast.root[0].type === 'frac' &&
          ast.root[0].num.length === 0 &&
          ast.root[0].den.length === 0 &&
          ast.cursor.slotId === `${ast.root[0].id}_num`
        );
      },
    },
    {
      name: '= then sin(30) starts fresh (no Ans in front)',
      test: () => {
        let ast = simulatePostEvalTransition('sin(');
        ast = insertToken(ast, 'sin(');
        ast = insertToken(ast, '30');
        ast = insertToken(ast, ')');
        const expr = astToExpression(ast.root);
        const r = evaluateMathExpression(expr, 'DEG', {}, 5);
        return expr === 'sin(30)' && r.success && Math.abs(r.result! - 0.5) < 1e-9;
      },
    },
    {
      name: '= then functions, templates, digits, variables (incl. C VAR), constants, Ans start fresh',
      test: () => {
        const prefixKeys = [
          'sin(', 'cos(', 'tan(', 'sin⁻¹(', 'cos⁻¹(', 'tan⁻¹(',
          'log(', 'ln(', 'log_□', '√', '³√(', 'x√',
          '■/□', '∫dx', 'd/dx', 'Σ(', 'Pol(', 'Rec(',
          '0', '5', '(', '(-', 'π', 'e', 'Ans', 'A', 'x',
        ];
        return (
          prefixKeys.every((k) => classifyAutoAnsKey(k) === 'prefix' && !shouldAutoInsertAns(k)) &&
          !shouldAutoInsertAns('C', 'VAR') &&
          shouldAutoInsertAns('C', 'OP_NCR')
        );
      },
    },
  ];

  return tests.map((t) => {
    try {
      const passed = t.test();
      return { name: t.name, passed };
    } catch (e: any) {
      return { name: t.name, passed: false, details: e.message };
    }
  });
}
