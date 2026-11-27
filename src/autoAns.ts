import type { TokenType } from './mathAst';

export type AutoAnsKeyClass = 'binary' | 'postfix' | 'prefix';

/**
 * Single lookup table for post-'=' auto-Ans key behavior.
 *
 * - 'binary':  Needs a left operand -> auto-inserts "Ans", then the key.
 * - 'postfix': Needs a left operand -> auto-inserts "Ans", then wraps it with the postfix operator.
 * - 'prefix':  Starts a new expression -> clears old expression and inserts the key fresh (no Ans).
 *
 * Any unlisted key defaults to 'prefix'.
 */
export const AUTO_ANS_KEY_CLASS: Record<string, AutoAnsKeyClass> = {
  // Binary operators (need left operand -> Ans first)
  '+': 'binary',
  '-': 'binary',
  '−': 'binary',
  '×': 'binary',
  '÷': 'binary',
  nPr: 'binary',
  nCr: 'binary',
  '×10^x': 'binary',
  '^': 'binary', // x^□
  '^(': 'binary', // SHIFT + x^□ currently emits '^('

  // Postfix operators (need left operand -> wraps Ans)
  '²': 'postfix',
  '³': 'postfix',
  '⁻¹': 'postfix',
  '!': 'postfix',
  '%': 'postfix',
  '°': 'postfix', // °′″ angle conversion

  // Functions (start fresh, no Ans)
  'sin(': 'prefix',
  'cos(': 'prefix',
  'tan(': 'prefix',
  'sin⁻¹(': 'prefix',
  'cos⁻¹(': 'prefix',
  'tan⁻¹(': 'prefix',
  'sinh(': 'prefix',
  'cosh(': 'prefix',
  'tanh(': 'prefix',
  'sinh⁻¹(': 'prefix',
  'cosh⁻¹(': 'prefix',
  'tanh⁻¹(': 'prefix',
  'log(': 'prefix',
  'ln(': 'prefix',
  'log_□': 'prefix',
  '√': 'prefix',
  '³√(': 'prefix',
  'x√': 'prefix',
  'Abs(': 'prefix',
  'Rnd(': 'prefix',

  // Templates (start fresh, no Ans)
  '■/□': 'prefix',
  '∫dx': 'prefix',
  'd/dx': 'prefix',
  'Σ(': 'prefix',
  'Pol(': 'prefix',
  'Rec(': 'prefix',
  '10^□': 'prefix',
  'e^□': 'prefix',

  // Digits, brackets, signs, constants, variables, Ans (start fresh, no Ans)
  '0': 'prefix',
  '1': 'prefix',
  '2': 'prefix',
  '3': 'prefix',
  '4': 'prefix',
  '5': 'prefix',
  '6': 'prefix',
  '7': 'prefix',
  '8': 'prefix',
  '9': 'prefix',
  '.': 'prefix',
  '(': 'prefix',
  ')': 'prefix',
  '(-': 'prefix',
  π: 'prefix',
  e: 'prefix',
  i: 'prefix',
  Ans: 'prefix',
  ',': 'prefix',
  ':': 'prefix',
  '=': 'prefix',
  x: 'prefix',
  A: 'prefix',
  B: 'prefix',
  C: 'prefix',
  D: 'prefix',
  E: 'prefix',
  F: 'prefix',
  X: 'prefix',
  Y: 'prefix',
  M: 'prefix',
};

export function resolveAutoAnsLookupKey(key: string, tokenType?: TokenType): string {
  if (tokenType === 'OP_NPR') return 'nPr';
  if (tokenType === 'OP_NCR') return 'nCr';
  return key;
}

export function classifyAutoAnsKey(key: string, tokenType?: TokenType): AutoAnsKeyClass {
  const lookupKey = resolveAutoAnsLookupKey(key, tokenType);
  return AUTO_ANS_KEY_CLASS[lookupKey] ?? 'prefix';
}

export function shouldAutoInsertAns(key: string, tokenType?: TokenType): boolean {
  const cls = classifyAutoAnsKey(key, tokenType);
  return cls === 'binary' || cls === 'postfix';
}
