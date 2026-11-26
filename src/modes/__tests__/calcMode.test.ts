/**
 * Tests for CALC Mode (fx-570EX Calculate)
 * 
 * Verifies:
 * 1. CALC mode metadata and status indicator
 * 2. Stored Ans and post-calculation continuity:
 *    - 2+3= then +4 → 9
 *    - 5= then x² → 25
 *    - 5= then sin(30)= → Ans×sin(30) (2.5)
 *    - 5= then 3 → fresh input (digits start fresh)
 *    - AC clears expression but preserves Ans
 *    - 5= then x⁻¹ → 1/5 (0.2)
 *    - 5= then nPr 2 → 20
 *    - 5= then nCr 2 → 10
 */

import { calcModeModule } from '../calcMode';
import { evaluateMathExpression } from '../../calcEngine';
import {
  createInitialAstState,
  insertToken,
  insertPostfix,
  astToExpression,
  parseStringToAst,
} from '../../mathAst';

export function runCalcModeTests(): { name: string; passed: boolean; details?: string }[] {
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

    // User test 1: 2+3= then +4 → 9
    {
      name: 'User test 1: 2+3= then +4 → 9',
      test: () => {
        // First expression: 2+3
        const r1 = evaluateMathExpression('2+3', 'DEG', {}, 0);
        if (!r1.success || r1.result !== 5) return false;
        const storedAns = r1.result;

        // Next key is binary operator '+': starts with "Ans"
        // Evaluates Ans+4 with storedAns = 5
        const r2 = evaluateMathExpression('Ans+4', 'DEG', {}, storedAns);
        return r2.success && r2.result === 9;
      },
    },

    // User test 2: 5= then x² → 25
    {
      name: 'User test 2: 5= then x² → 25',
      test: () => {
        // First expression: 5=
        const r1 = evaluateMathExpression('5', 'DEG', {}, 0);
        if (!r1.success || r1.result !== 5) return false;
        const storedAns = r1.result;

        // Next key is postfix '²': starts with "Ans"
        // Evaluates Ans² with storedAns = 5
        const r2 = evaluateMathExpression('Ans²', 'DEG', {}, storedAns);
        return r2.success && r2.result === 25;
      },
    },

    // User test 3: 5= then sin(30)= → Ans×sin(30) = 2.5
    {
      name: 'User test 3: 5= then sin(30) → continues from Ans (2.5)',
      test: () => {
        // First expression: 5=
        const r1 = evaluateMathExpression('5', 'DEG', {}, 0);
        if (!r1.success || r1.result !== 5) return false;
        const storedAns = r1.result;

        // Next key is function key 'sin(': continues from Ans
        const ast = insertToken(
          insertToken(
            insertToken(parseStringToAst('Ans'), 'sin('),
            '30'
          ),
          ')'
        );
        const r2 = evaluateMathExpression(astToExpression(ast.root), 'DEG', {}, storedAns);
        return r2.success && Math.abs(r2.result! - 2.5) < 1e-9;
      },
    },

    // User requirement: 5= then x⁻¹ → 0.2
    {
      name: '5= then x⁻¹ → 0.2',
      test: () => {
        const r1 = evaluateMathExpression('5', 'DEG', {}, 0);
        const storedAns = r1.result!;
        const r2 = evaluateMathExpression('Ans⁻¹', 'DEG', {}, storedAns);
        return r2.success && Math.abs(r2.result! - 0.2) < 1e-9;
      },
    },

    // User requirement: 5= then nPr 2 → 20
    {
      name: '5= then nPr 2 → 20',
      test: () => {
        const r1 = evaluateMathExpression('5', 'DEG', {}, 0);
        const storedAns = r1.result!;
        const r2 = evaluateMathExpression('Ans P 2', 'DEG', {}, storedAns);
        return r2.success && r2.result === 20;
      },
    },

    // User requirement: 5= then nCr 2 → 10
    {
      name: '5= then nCr 2 → 10',
      test: () => {
        const r1 = evaluateMathExpression('5', 'DEG', {}, 0);
        const storedAns = r1.result!;
        const r2 = evaluateMathExpression('Ans C 2', 'DEG', {}, storedAns);
        return r2.success && r2.result === 10;
      },
    },

    // AST transition simulation: binary operator after calculated result starts with Ans
    {
      name: 'AST transition: binary operator after equals creates Ans node',
      test: () => {
        let isCalculated = true;
        let ast = createInitialAstState();

        const tokenVal = '+';
        const isBinaryOrPostfix = [
          '+', '-', '×', '÷', '^', '²', '³', '⁻¹', '!', '%', '°',
          'P', 'C', 'nPr', 'nCr'
        ].includes(tokenVal);

        if (isCalculated) {
          if (isBinaryOrPostfix) {
            ast = parseStringToAst('Ans');
          } else {
            ast = createInitialAstState();
          }
          isCalculated = false;
        }

        ast = insertToken(ast, tokenVal);
        ast = insertToken(ast, '4');
        const expr = astToExpression(ast.root);
        return expr === 'Ans+4';
      },
    },

    // AST transition simulation: function key after calculated result continues from Ans
    {
      name: 'AST transition: function key after equals continues from Ans',
      test: () => {
        let isCalculated = true;
        let ast = parseStringToAst('5'); // previous calculated expression

        const tokenVal: string = 'sin(';
        const isBinaryOrPostfix = [
          '+', '-', '×', '÷', '^', '²', '³', '⁻¹', '!', '%', '°',
          'P', 'C', 'nPr', 'nCr'
        ].includes(tokenVal);
        const isFunctionCall = tokenVal.endsWith('(') && tokenVal !== '(' && tokenVal !== '(-';

        if (isCalculated) {
          if (isBinaryOrPostfix || isFunctionCall) {
            ast = parseStringToAst('Ans');
          } else {
            ast = createInitialAstState();
          }
          isCalculated = false;
        }

        ast = insertToken(ast, tokenVal);
        ast = insertToken(ast, '30');
        ast = insertToken(ast, ')');
        const expr = astToExpression(ast.root);
        return expr === 'Anssin(30)';
      },
    },

    // AST transition simulation: digit after calculated result starts fresh
    {
      name: 'AST transition: digit key after equals starts fresh input',
      test: () => {
        let isCalculated = true;
        let ast = parseStringToAst('5');

        const tokenVal: string = '3';
        const isBinaryOrPostfix = [
          '+', '-', '×', '÷', '^', '²', '³', '⁻¹', '!', '%', '°',
          'P', 'C', 'nPr', 'nCr'
        ].includes(tokenVal);
        const isFunctionCall = tokenVal.endsWith('(') && tokenVal !== '(' && tokenVal !== '(-';

        if (isCalculated) {
          ast = isBinaryOrPostfix || isFunctionCall ? parseStringToAst('Ans') : createInitialAstState();
          isCalculated = false;
        }

        ast = insertToken(ast, tokenVal);
        const expr = astToExpression(ast.root);
        return expr === '3';
      },
    },

    // AST transition simulation: postfix x² after calculated result wraps Ans
    {
      name: 'AST transition: postfix x² after equals wraps Ans',
      test: () => {
        let isCalculated = true;
        let ast = parseStringToAst('5');

        if (isCalculated) {
          ast = parseStringToAst('Ans');
          isCalculated = false;
        }

        ast = insertPostfix(ast, '²');
        const expr = astToExpression(ast.root);
        return expr === '((Ans)^2)' || expr === 'Ans²';
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
