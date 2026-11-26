/**
 * Casio fx-570EX 2D Math AST Template System
 * Implements Natural-V.P.A.M. 2D templates for Fractions, Definite Integrals,
 * Radicals (Square Root), Logarithms with Custom Base, Powers, and Postfix operators
 * with dynamic placeholders, operand wrapping rules, and D-Pad navigation.
 */

export type PostfixOp = '²' | '³' | '⁻¹' | '!' | '°' | '%';

export type TokenType = 'DEFAULT' | 'OP_NPR' | 'OP_NCR' | 'VAR' | 'FUNC';

export type MathNode =
  | { type: 'token'; id: string; val: string; tokenType?: TokenType }
  | { type: 'value'; id: string; numericVal: number; display: string; exactResult?: string }
  | { type: 'frac'; id: string; num: MathNode[]; den: MathNode[] }
  | { type: 'int'; id: string; integrand: MathNode[]; lower: MathNode[]; upper: MathNode[]; variable?: string }
  | { type: 'deriv'; id: string; expr: MathNode[]; at: MathNode[]; variable?: string }
  | { type: 'sqrt'; id: string; content: MathNode[] }
  | { type: 'power'; id: string; base: MathNode[]; exp: MathNode[] }
  | { type: 'postfix'; id: string; op: PostfixOp; target: MathNode[] }
  | { type: 'logBase'; id: string; base: MathNode[]; arg: MathNode[] };

export interface CursorPosition {
  slotId: string;
  offset: number;
}

export interface MathAstState {
  root: MathNode[];
  cursor: CursorPosition;
  pendingDeleteTemplateId: string | null;
}

let nextIdCounter = 1;
export function generateUniqueId(prefix = 'node'): string {
  return `${prefix}_${Date.now().toString(36)}_${(nextIdCounter++).toString(36)}`;
}

export function createInitialAstState(): MathAstState {
  return {
    root: [],
    cursor: { slotId: 'root', offset: 0 },
    pendingDeleteTemplateId: null,
  };
}

// Find a slot's nodes array by its slotId
export function getSlotNodes(root: MathNode[], slotId: string): MathNode[] | null {
  if (slotId === 'root') return root;

  for (const node of root) {
    if (node.type === 'frac') {
      if (`${node.id}_num` === slotId) return node.num;
      if (`${node.id}_den` === slotId) return node.den;
      const sub = getSlotNodes(node.num, slotId) || getSlotNodes(node.den, slotId);
      if (sub) return sub;
    } else if (node.type === 'int') {
      if (`${node.id}_integrand` === slotId) return node.integrand;
      if (`${node.id}_lower` === slotId) return node.lower;
      if (`${node.id}_upper` === slotId) return node.upper;
      const sub =
        getSlotNodes(node.integrand, slotId) ||
        getSlotNodes(node.lower, slotId) ||
        getSlotNodes(node.upper, slotId);
      if (sub) return sub;
    } else if (node.type === 'deriv') {
      if (`${node.id}_expr` === slotId) return node.expr;
      if (`${node.id}_at` === slotId) return node.at;
      const sub = getSlotNodes(node.expr, slotId) || getSlotNodes(node.at, slotId);
      if (sub) return sub;
    } else if (node.type === 'sqrt') {
      if (`${node.id}_content` === slotId) return node.content;
      const sub = getSlotNodes(node.content, slotId);
      if (sub) return sub;
    } else if (node.type === 'power') {
      if (`${node.id}_base` === slotId) return node.base;
      if (`${node.id}_exp` === slotId) return node.exp;
      const sub = getSlotNodes(node.base, slotId) || getSlotNodes(node.exp, slotId);
      if (sub) return sub;
    } else if (node.type === 'postfix') {
      if (`${node.id}_target` === slotId) return node.target;
      const sub = getSlotNodes(node.target, slotId);
      if (sub) return sub;
    } else if (node.type === 'logBase') {
      if (`${node.id}_base` === slotId) return node.base;
      if (`${node.id}_arg` === slotId) return node.arg;
      const sub = getSlotNodes(node.base, slotId) || getSlotNodes(node.arg, slotId);
      if (sub) return sub;
    }
  }
  return null;
}

export interface SlotParentInfo {
  parentNode: MathNode | null; // null if in root
  parentSlotId: string;
  parentIndex: number;
}

// Find the template node containing a given slotId, and its index in the parent slot
export function findSlotParentInfo(
  root: MathNode[],
  targetSlotId: string,
  parentSlotId = 'root'
): SlotParentInfo | null {
  const nodes = getSlotNodes(root, parentSlotId);
  if (!nodes) return null;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === 'frac') {
      if (`${node.id}_num` === targetSlotId || `${node.id}_den` === targetSlotId) {
        return { parentNode: node, parentSlotId, parentIndex: i };
      }
      const deeper =
        findSlotParentInfo(root, targetSlotId, `${node.id}_num`) ||
        findSlotParentInfo(root, targetSlotId, `${node.id}_den`);
      if (deeper) return deeper;
    } else if (node.type === 'int') {
      if (
        `${node.id}_integrand` === targetSlotId ||
        `${node.id}_lower` === targetSlotId ||
        `${node.id}_upper` === targetSlotId
      ) {
        return { parentNode: node, parentSlotId, parentIndex: i };
      }
      const deeper =
        findSlotParentInfo(root, targetSlotId, `${node.id}_integrand`) ||
        findSlotParentInfo(root, targetSlotId, `${node.id}_lower`) ||
        findSlotParentInfo(root, targetSlotId, `${node.id}_upper`);
      if (deeper) return deeper;
    } else if (node.type === 'deriv') {
      if (`${node.id}_expr` === targetSlotId || `${node.id}_at` === targetSlotId) {
        return { parentNode: node, parentSlotId, parentIndex: i };
      }
      const deeper =
        findSlotParentInfo(root, targetSlotId, `${node.id}_expr`) ||
        findSlotParentInfo(root, targetSlotId, `${node.id}_at`);
      if (deeper) return deeper;
    } else if (node.type === 'sqrt') {
      if (`${node.id}_content` === targetSlotId) {
        return { parentNode: node, parentSlotId, parentIndex: i };
      }
      const deeper = findSlotParentInfo(root, targetSlotId, `${node.id}_content`);
      if (deeper) return deeper;
    } else if (node.type === 'power') {
      if (`${node.id}_base` === targetSlotId || `${node.id}_exp` === targetSlotId) {
        return { parentNode: node, parentSlotId, parentIndex: i };
      }
      const deeper =
        findSlotParentInfo(root, targetSlotId, `${node.id}_base`) ||
        findSlotParentInfo(root, targetSlotId, `${node.id}_exp`);
      if (deeper) return deeper;
    } else if (node.type === 'postfix') {
      if (`${node.id}_target` === targetSlotId) {
        return { parentNode: node, parentSlotId, parentIndex: i };
      }
      const deeper = findSlotParentInfo(root, targetSlotId, `${node.id}_target`);
      if (deeper) return deeper;
    } else if (node.type === 'logBase') {
      if (`${node.id}_base` === targetSlotId || `${node.id}_arg` === targetSlotId) {
        return { parentNode: node, parentSlotId, parentIndex: i };
      }
      const deeper =
        findSlotParentInfo(root, targetSlotId, `${node.id}_base`) ||
        findSlotParentInfo(root, targetSlotId, `${node.id}_arg`);
      if (deeper) return deeper;
    }
  }
  return null;
}

// Deep clone AST
export function cloneAst(root: MathNode[]): MathNode[] {
  return JSON.parse(JSON.stringify(root));
}

export interface ExtractedOperand {
  startIndex: number;
  endIndex: number;
  nodes: MathNode[];
  hasImpliedMult: boolean;
}

function isOperandTokenNode(node: MathNode): boolean {
  if (node.type !== 'token') return false;
  if (node.tokenType === 'OP_NCR' || node.tokenType === 'OP_NPR') return false;
  if (node.tokenType === 'VAR') return true;
  return /^[0-9.]+$/.test(node.val) || /^([a-zA-Zπe]|Ans)$/.test(node.val);
}

/**
 * Extract the previous operand before current cursor:
 * 3a. Walks back over all postfix wrappers (x², x³, x⁻¹, x!, °, %, and completed power nodes).
 * 3b. Takes the primary beneath them: a number (whole, including decimal), a bracket group,
 *     a function call with its argument (sin(30)), a root, or a fraction.
 * 3e. Identifies implied multiplication before the operand: e.g. (6)2 -> implied mult before 2.
 * Returns null if the token right before the cursor is an operator or opening delimiter.
 */
export function extractPreviousOperand(
  slotNodes: MathNode[],
  offset: number
): ExtractedOperand | null {
  if (offset <= 0 || slotNodes.length === 0) return null;

  const endIndex = Math.min(offset - 1, slotNodes.length - 1);
  const lastNode = slotNodes[endIndex];

  let startIndex = endIndex;
  let hasImpliedMult = false;

  // Case 1: Structured non-token node (postfix, power, frac, sqrt, int, deriv, logBase)
  if (lastNode.type !== 'token') {
    startIndex = endIndex;
  }
  // Case 2: Closing parenthesis ')'
  else if (lastNode.val === ')') {
    let depth = 0;
    let foundStart = -1;
    for (let i = endIndex; i >= 0; i--) {
      const node = slotNodes[i];
      if (node.type === 'token') {
        if (node.val === ')') {
          depth++;
        } else if (node.val === '(' || node.val === '(-' || node.val.endsWith('(')) {
          depth--;
          if (depth === 0) {
            foundStart = i;
            break;
          }
        }
      }
    }

    if (foundStart !== -1) {
      startIndex = foundStart;
      // Check if preceding token is a function name like 'sin', 'cos', 'tan', etc.
      if (
        slotNodes[foundStart].type === 'token' &&
        (slotNodes[foundStart] as { type: 'token'; val: string }).val === '(' &&
        startIndex > 0 &&
        slotNodes[startIndex - 1].type === 'token'
      ) {
        const prevVal = (slotNodes[startIndex - 1] as { type: 'token'; val: string }).val;
        if (/^(sin|cos|tan|sin⁻¹|cos⁻¹|tan⁻¹|ln|log|sinh|cosh|tanh|Abs|Pol|Rec|d\/dx)$/.test(prevVal)) {
          startIndex--;
        }
      }
    } else {
      return null;
    }
  }
  // Case 3: Number sequence (digits and decimal point)
  else if (/^[0-9.]+$/.test(lastNode.val)) {
    let i = endIndex;
    while (
      i >= 0 &&
      slotNodes[i].type === 'token' &&
      /^[0-9.]+$/.test((slotNodes[i] as { type: 'token'; val: string }).val)
    ) {
      i--;
    }
    startIndex = i + 1;
  }
  // Case 4: Standalone identifier, variable, or constant (x, y, A-F, M, X, Y, π, e, Ans)
  else if (isOperandTokenNode(lastNode)) {
    startIndex = endIndex;
  }
  // Case 5: Operator (+, -, ×, ÷, ^, nCr, nPr) or opening delimiter ('(', '(-', 'sin(', '×10^(', ',', etc.)
  else {
    return null;
  }

  // Check if there was implied multiplication immediately preceding startIndex:
  // e.g. (6)2 -> startIndex is at '2', preceding node is ')'!
  // or 2(3) -> startIndex is at '(', preceding node is '2'!
  // Never emit implied multiplication if extracted node starts with a legacy binary '×10^(' token.
  const firstExtracted = slotNodes[startIndex];
  const startsWithBinaryTimes =
    firstExtracted?.type === 'token' && firstExtracted.val === '×10^(';

  if (startIndex > 0 && !startsWithBinaryTimes) {
    const prevNode = slotNodes[startIndex - 1];
    if (prevNode.type !== 'token') {
      hasImpliedMult = true;
    } else if (prevNode.val === ')' || isOperandTokenNode(prevNode)) {
      hasImpliedMult = true;
    }
  }

  const nodes = slotNodes.slice(startIndex, endIndex + 1);
  return { startIndex, endIndex, nodes, hasImpliedMult };
}

/**
 * Insert a token (number, operator, variable, etc.) at current cursor
 */
export function insertToken(state: MathAstState, tokenVal: string, tokenType?: TokenType): MathAstState {
  const newRoot = cloneAst(state.root);
  const slotNodes = getSlotNodes(newRoot, state.cursor.slotId);
  if (!slotNodes) return state;

  const newNode: MathNode = {
    type: 'token',
    id: generateUniqueId('tok'),
    val: tokenVal,
    ...(tokenType ? { tokenType } : {}),
  };

  const offset = Math.min(Math.max(0, state.cursor.offset), slotNodes.length);
  slotNodes.splice(offset, 0, newNode);

  return {
    root: newRoot,
    cursor: {
      slotId: state.cursor.slotId,
      offset: offset + 1,
    },
    pendingDeleteTemplateId: null,
  };
}

/**
 * Insert an atomic full-precision history/result value node at the current cursor
 */
export function insertValueNode(
  state: MathAstState,
  numericVal: number,
  display: string,
  exactResult?: string
): MathAstState {
  const newRoot = cloneAst(state.root);
  const slotNodes = getSlotNodes(newRoot, state.cursor.slotId) || newRoot;
  const targetSlotId = getSlotNodes(newRoot, state.cursor.slotId) ? state.cursor.slotId : 'root';

  const newNode: MathNode = {
    type: 'value',
    id: generateUniqueId('val'),
    numericVal,
    display,
    ...(exactResult !== undefined ? { exactResult } : {}),
  };

  const offset = Math.min(Math.max(0, state.cursor.offset), slotNodes.length);
  slotNodes.splice(offset, 0, newNode);

  return {
    root: newRoot,
    cursor: {
      slotId: targetSlotId,
      offset: offset + 1,
    },
    pendingDeleteTemplateId: null,
  };
}

/**
 * Rule 1: POSTFIX KEYS: x², x³, x⁻¹, x!, °, % are postfix operators.
 * Pressing one wraps the previous operand in a postfix node and leaves the cursor
 * AFTER the node (not inside the exponent). They chain: (6)²! is a postfix of a postfix.
 */
export function insertPostfix(state: MathAstState, op: PostfixOp): MathAstState {
  const newRoot = cloneAst(state.root);
  const slotNodes = getSlotNodes(newRoot, state.cursor.slotId);
  if (!slotNodes) return state;

  const offset = Math.min(Math.max(0, state.cursor.offset), slotNodes.length);
  const operandInfo = extractPreviousOperand(slotNodes, offset);

  let targetNodes: MathNode[] = [];
  let insertIndex = offset;

  if (operandInfo && operandInfo.nodes.length > 0) {
    targetNodes = operandInfo.nodes;
    slotNodes.splice(operandInfo.startIndex, operandInfo.nodes.length);
    insertIndex = operandInfo.startIndex;
  } else {
    // If no previous operand, e.g. at start, default to Ans
    targetNodes = [{ type: 'token', id: generateUniqueId('tok'), val: 'Ans' }];
  }

  const postfixNode: MathNode = {
    type: 'postfix',
    id: generateUniqueId('post'),
    op,
    target: targetNodes,
  };

  slotNodes.splice(insertIndex, 0, postfixNode);

  // Leaves the cursor AFTER the node (not inside any exponent)
  return {
    root: newRoot,
    cursor: { slotId: state.cursor.slotId, offset: insertIndex + 1 },
    pendingDeleteTemplateId: null,
  };
}

/**
 * Rule 2: POWER KEY (x□): creates a power node with the cursor inside the empty exponent slot.
 * Any key typed goes into the exponent, including ÷ (fraction inside the exponent).
 * The right arrow exits the slot to after the power node.
 */
export function insertPower(state: MathAstState): MathAstState {
  const newRoot = cloneAst(state.root);
  const slotNodes = getSlotNodes(newRoot, state.cursor.slotId);
  if (!slotNodes) return state;

  const offset = Math.min(Math.max(0, state.cursor.offset), slotNodes.length);
  const operandInfo = extractPreviousOperand(slotNodes, offset);

  let baseNodes: MathNode[] = [];
  let insertIndex = offset;

  if (operandInfo && operandInfo.nodes.length > 0) {
    baseNodes = operandInfo.nodes;
    slotNodes.splice(operandInfo.startIndex, operandInfo.nodes.length);
    insertIndex = operandInfo.startIndex;
  } else {
    baseNodes = [{ type: 'token', id: generateUniqueId('tok'), val: 'Ans' }];
  }

  const powerId = generateUniqueId('power');
  const powerNode: MathNode = {
    type: 'power',
    id: powerId,
    base: baseNodes,
    exp: [],
  };

  slotNodes.splice(insertIndex, 0, powerNode);

  // Focus empty exponent slot
  return {
    root: newRoot,
    cursor: { slotId: `${powerId}_exp`, offset: 0 },
    pendingDeleteTemplateId: null,
  };
}

/**
 * Insert a structured constant-base exponent template (e.g. e^□ or 10^□) at the cursor
 * without wrapping the preceding operand, so 2 e^□ 3 produces implicit multiplication 2×e^3.
 */
export function insertConstantPower(state: MathAstState, baseTokenVals: string[]): MathAstState {
  const newRoot = cloneAst(state.root);
  const slotNodes = getSlotNodes(newRoot, state.cursor.slotId);
  if (!slotNodes) return state;

  const offset = Math.min(Math.max(0, state.cursor.offset), slotNodes.length);
  const powerId = generateUniqueId('power');
  const baseNodes: MathNode[] = baseTokenVals.map((val) => ({
    type: 'token',
    id: generateUniqueId('tok'),
    val,
  }));

  const powerNode: MathNode = {
    type: 'power',
    id: powerId,
    base: baseNodes,
    exp: [],
  };

  slotNodes.splice(offset, 0, powerNode);

  return {
    root: newRoot,
    cursor: { slotId: `${powerId}_exp`, offset: 0 },
    pendingDeleteTemplateId: null,
  };
}

/**
 * Insert scientific notation ×10^□ as a binary '×' token followed by a structured
 * power(base=['1','0'], exp=[]) node, focusing the superscript exponent slot.
 */
export function insertScientificTenPower(state: MathAstState): MathAstState {
  const newRoot = cloneAst(state.root);
  const slotNodes = getSlotNodes(newRoot, state.cursor.slotId);
  if (!slotNodes) return state;

  const offset = Math.min(Math.max(0, state.cursor.offset), slotNodes.length);
  const powerId = generateUniqueId('power');
  const timesNode: MathNode = {
    type: 'token',
    id: generateUniqueId('tok'),
    val: '×',
  };
  const powerNode: MathNode = {
    type: 'power',
    id: powerId,
    base: [
      { type: 'token', id: generateUniqueId('tok'), val: '1' },
      { type: 'token', id: generateUniqueId('tok'), val: '0' },
    ],
    exp: [],
  };

  slotNodes.splice(offset, 0, timesNode, powerNode);

  return {
    root: newRoot,
    cursor: { slotId: `${powerId}_exp`, offset: 0 },
    pendingDeleteTemplateId: null,
  };
}

/**
 * Rule 3: FRACTION KEY OPERAND: on ÷ (and the a b/c key), take the previous operand:
 * a. Walk back over all postfix wrappers (x², x³, x⁻¹, x!, °, %, and completed power nodes).
 * b. Take the primary beneath them: a number (whole, including decimal), a bracket group,
 *    a function call with its argument (sin(30)), a root, or a fraction.
 * c. Put that whole thing in the numerator; cursor goes into the empty denominator (or numerator if empty).
 * d. Drop outer brackets only if the bracket group is the entire operand. If a postfix wraps it, keep them.
 * e. Implied multiplication stays outside: (6)2÷ gives (6)×(2/□).
 */
export function insertFraction(state: MathAstState): MathAstState {
  const newRoot = cloneAst(state.root);
  const slotNodes = getSlotNodes(newRoot, state.cursor.slotId);
  if (!slotNodes) return state;

  const fracId = generateUniqueId('frac');
  const offset = Math.min(Math.max(0, state.cursor.offset), slotNodes.length);

  const operandInfo = extractPreviousOperand(slotNodes, offset);

  let numNodes: MathNode[] = [];
  let insertIndex = offset;

  if (operandInfo && operandInfo.nodes.length > 0) {
    const rawNodes = operandInfo.nodes;
    const firstNode = rawNodes[0];
    const lastNode = rawNodes[rawNodes.length - 1];

    // Guard legacy '×10^(exp)' token groups: leave '×' outside and move only 10^(exp) into numerator.
    let splitLeadingTimes = false;
    if (
      rawNodes.length >= 2 &&
      firstNode.type === 'token' &&
      firstNode.val === '×10^(' &&
      lastNode.type === 'token' &&
      lastNode.val === ')'
    ) {
      splitLeadingTimes = true;
      numNodes = [
        {
          type: 'power',
          id: generateUniqueId('power'),
          base: [
            { type: 'token', id: generateUniqueId('tok'), val: '1' },
            { type: 'token', id: generateUniqueId('tok'), val: '0' },
          ],
          exp: rawNodes.slice(1, -1),
        },
      ];
    } else {
      // Rule 3d: Drop outer brackets ONLY if the bracket group is the entire operand.
      // If a postfix wraps it, keep them.
      let isPlainBracketGroup = false;
      if (
        rawNodes.length >= 2 &&
        firstNode.type === 'token' &&
        firstNode.val === '(' &&
        lastNode.type === 'token' &&
        lastNode.val === ')'
      ) {
        let depth = 0;
        let matchedAtEnd = false;
        for (let i = 0; i < rawNodes.length; i++) {
          const n = rawNodes[i];
          if (n.type === 'token') {
            if (n.val === '(') depth++;
            else if (n.val === ')') {
              depth--;
              if (depth === 0 && i === rawNodes.length - 1) {
                matchedAtEnd = true;
              }
            }
          }
        }
        if (matchedAtEnd) {
          isPlainBracketGroup = true;
        }
      }

      if (isPlainBracketGroup) {
        // Drop outer brackets
        numNodes = rawNodes.slice(1, -1);
      } else {
        numNodes = rawNodes;
      }
    }

    // Remove extracted operand from slotNodes
    slotNodes.splice(operandInfo.startIndex, operandInfo.nodes.length);
    insertIndex = operandInfo.startIndex;

    if (splitLeadingTimes) {
      slotNodes.splice(insertIndex, 0, {
        type: 'token',
        id: generateUniqueId('tok'),
        val: '×',
      });
      insertIndex++;
    } else if (operandInfo.hasImpliedMult) {
      // Rule 3e: Implied multiplication stays outside: (6)2÷ gives (6)×(2/□)
      const timesToken: MathNode = {
        type: 'token',
        id: generateUniqueId('tok'),
        val: '×',
      };
      slotNodes.splice(insertIndex, 0, timesToken);
      insertIndex++;
    }
  }

  const fracNode: MathNode = {
    type: 'frac',
    id: fracId,
    num: numNodes,
    den: [],
  };

  slotNodes.splice(insertIndex, 0, fracNode);

  // If a numerator was captured, focus the empty denominator; otherwise focus the empty numerator.
  const targetSlot = numNodes.length > 0 ? `${fracId}_den` : `${fracId}_num`;
  return {
    root: newRoot,
    cursor: { slotId: targetSlot, offset: 0 },
    pendingDeleteTemplateId: null,
  };
}

/**
 * Natural Display: Integral Key (∫dx)
 * Insert full definite integral structure: \int_{[\quad]}^{[\quad]} ([\vert])\,dx
 */
export function insertIntegral(state: MathAstState): MathAstState {
  const newRoot = cloneAst(state.root);
  const slotNodes = getSlotNodes(newRoot, state.cursor.slotId);
  if (!slotNodes) return state;

  const intId = generateUniqueId('int');
  const offset = Math.min(Math.max(0, state.cursor.offset), slotNodes.length);

  const intNode: MathNode = {
    type: 'int',
    id: intId,
    integrand: [],
    lower: [],
    upper: [],
    variable: 'x',
  };

  slotNodes.splice(offset, 0, intNode);

  return {
    root: newRoot,
    cursor: { slotId: `${intId}_integrand`, offset: 0 },
    pendingDeleteTemplateId: null,
  };
}

/**
 * Natural Display: Derivative Key (d/dx)
 * Insert structured derivative template: d/dx(□)|_{x=□}
 */
export function insertDerivative(state: MathAstState): MathAstState {
  const newRoot = cloneAst(state.root);
  const slotNodes = getSlotNodes(newRoot, state.cursor.slotId);
  if (!slotNodes) return state;

  const derivId = generateUniqueId('deriv');
  const offset = Math.min(Math.max(0, state.cursor.offset), slotNodes.length);

  const derivNode: MathNode = {
    type: 'deriv',
    id: derivId,
    expr: [],
    at: [],
    variable: 'x',
  };

  slotNodes.splice(offset, 0, derivNode);

  return {
    root: newRoot,
    cursor: { slotId: `${derivId}_expr`, offset: 0 },
    pendingDeleteTemplateId: null,
  };
}

/**
 * Natural Display: Square Root (√■)
 */
export function insertSqrt(state: MathAstState): MathAstState {
  const newRoot = cloneAst(state.root);
  const slotNodes = getSlotNodes(newRoot, state.cursor.slotId);
  if (!slotNodes) return state;

  const sqrtId = generateUniqueId('sqrt');
  const offset = Math.min(Math.max(0, state.cursor.offset), slotNodes.length);

  const sqrtNode: MathNode = {
    type: 'sqrt',
    id: sqrtId,
    content: [],
  };

  slotNodes.splice(offset, 0, sqrtNode);

  return {
    root: newRoot,
    cursor: { slotId: `${sqrtId}_content`, offset: 0 },
    pendingDeleteTemplateId: null,
  };
}

/**
 * Natural Display: Log Base (log□■)
 */
export function insertLogBase(state: MathAstState): MathAstState {
  const newRoot = cloneAst(state.root);
  const slotNodes = getSlotNodes(newRoot, state.cursor.slotId);
  if (!slotNodes) return state;

  const logId = generateUniqueId('log');
  const offset = Math.min(Math.max(0, state.cursor.offset), slotNodes.length);

  const logNode: MathNode = {
    type: 'logBase',
    id: logId,
    base: [],
    arg: [],
  };

  slotNodes.splice(offset, 0, logNode);

  return {
    root: newRoot,
    cursor: { slotId: `${logId}_base`, offset: 0 },
    pendingDeleteTemplateId: null,
  };
}

/**
 * D-Pad Navigation Engine:
 * Maps LEFT, RIGHT, UP, DOWN across active template child boxes.
 * Pressing RIGHT when at the end of a denominator or power exponent breaks out of template into main line flow.
 */
export function navigateAst(state: MathAstState, direction: 'left' | 'right' | 'up' | 'down'): MathAstState {
  const { root, cursor } = state;
  const currentSlot = getSlotNodes(root, cursor.slotId);
  if (!currentSlot) return state;

  const slotId = cursor.slotId;
  const offset = cursor.offset;

  const slotEndOffset = (targetSlotId: string) => (getSlotNodes(root, targetSlotId) || []).length;

  // Walk ancestor slots to find an enclosing template (e.g. int or deriv) that has a vertical neighbor
  const findAncestorVerticalTarget = (dir: 'up' | 'down'): string | null => {
    let walkSlotId = slotId;
    while (walkSlotId !== 'root') {
      const info = findSlotParentInfo(root, walkSlotId);
      if (!info || !info.parentNode) break;
      const pNode = info.parentNode;
      if (pNode.type === 'int') {
        if (dir === 'up' && (walkSlotId === `${pNode.id}_integrand` || walkSlotId === `${pNode.id}_lower`)) {
          return `${pNode.id}_upper`;
        }
        if (dir === 'down' && (walkSlotId === `${pNode.id}_integrand` || walkSlotId === `${pNode.id}_upper`)) {
          return `${pNode.id}_lower`;
        }
      } else if (pNode.type === 'deriv') {
        if (dir === 'up' && walkSlotId === `${pNode.id}_at`) {
          return `${pNode.id}_expr`;
        }
        if (dir === 'down' && walkSlotId === `${pNode.id}_expr`) {
          return `${pNode.id}_at`;
        }
      }
      walkSlotId = info.parentSlotId;
    }
    return null;
  };

  if (direction === 'up') {
    const immediateParent = findSlotParentInfo(root, slotId);
    // 1. Fraction: In denominator, UP moves to numerator
    if (slotId.endsWith('_den')) {
      const baseId = slotId.replace(/_den$/, '');
      const target = `${baseId}_num`;
      return { ...state, cursor: { slotId: target, offset: slotEndOffset(target) }, pendingDeleteTemplateId: null };
    }
    // 2. Integral: In integrand or lower limit, UP moves to upper limit
    if (slotId.endsWith('_integrand') || slotId.endsWith('_lower')) {
      const baseId = slotId.replace(/_(integrand|lower)$/, '');
      const target = `${baseId}_upper`;
      return { ...state, cursor: { slotId: target, offset: slotEndOffset(target) }, pendingDeleteTemplateId: null };
    }
    // 3. Derivative: In evaluation point (_at), UP moves to expression (_expr)
    if (slotId.endsWith('_at')) {
      const baseId = slotId.replace(/_at$/, '');
      const target = `${baseId}_expr`;
      return { ...state, cursor: { slotId: target, offset: slotEndOffset(target) }, pendingDeleteTemplateId: null };
    }
    // 4. Power / LogBase: distinguish via parent node type
    if (slotId.endsWith('_base')) {
      const baseId = slotId.replace(/_base$/, '');
      if (immediateParent?.parentNode?.type === 'logBase') {
        const target = `${baseId}_arg`;
        return { ...state, cursor: { slotId: target, offset: slotEndOffset(target) }, pendingDeleteTemplateId: null };
      }
      const target = `${baseId}_exp`;
      return { ...state, cursor: { slotId: target, offset: slotEndOffset(target) }, pendingDeleteTemplateId: null };
    }
    // 5. Escaping nested templates (e.g. power exp, frac num, sqrt content) to enclosing int/deriv vertical neighbor
    const ancestorUp = findAncestorVerticalTarget('up');
    if (ancestorUp) {
      return { ...state, cursor: { slotId: ancestorUp, offset: slotEndOffset(ancestorUp) }, pendingDeleteTemplateId: null };
    }
    return state;
  }

  if (direction === 'down') {
    // 1. Fraction: In numerator, DOWN moves to denominator
    if (slotId.endsWith('_num')) {
      const baseId = slotId.replace(/_num$/, '');
      const target = `${baseId}_den`;
      return { ...state, cursor: { slotId: target, offset: slotEndOffset(target) }, pendingDeleteTemplateId: null };
    }
    // 2. Integral: In integrand or upper limit, DOWN moves to lower limit
    if (slotId.endsWith('_integrand') || slotId.endsWith('_upper')) {
      const baseId = slotId.replace(/_(integrand|upper)$/, '');
      const target = `${baseId}_lower`;
      return { ...state, cursor: { slotId: target, offset: slotEndOffset(target) }, pendingDeleteTemplateId: null };
    }
    // 3. Derivative: In expression (_expr), DOWN moves to evaluation point (_at)
    if (slotId.endsWith('_expr')) {
      const baseId = slotId.replace(/_expr$/, '');
      const target = `${baseId}_at`;
      return { ...state, cursor: { slotId: target, offset: slotEndOffset(target) }, pendingDeleteTemplateId: null };
    }
    // 4. Nested template inside int/deriv (e.g. x^2 or 1/x inside integrand/expr): jump to enclosing int_lower or deriv_at
    const ancestorDown = findAncestorVerticalTarget('down');
    if (ancestorDown) {
      return { ...state, cursor: { slotId: ancestorDown, offset: slotEndOffset(ancestorDown) }, pendingDeleteTemplateId: null };
    }
    // 5. Power at top-level or non-int/deriv parent: DOWN breaks out to parent slot after power node
    if (slotId.endsWith('_exp')) {
      const parentInfo = findSlotParentInfo(root, slotId);
      if (parentInfo) {
        return {
          ...state,
          cursor: { slotId: parentInfo.parentSlotId, offset: parentInfo.parentIndex + 1 },
          pendingDeleteTemplateId: null,
        };
      }
    }
    return state;
  }

  if (direction === 'right') {
    // If not at the end of the current slot, step forward or into the child template
    if (offset < currentSlot.length) {
      const nextNode = currentSlot[offset];
      if (nextNode.type === 'frac') {
        return { ...state, cursor: { slotId: `${nextNode.id}_num`, offset: 0 }, pendingDeleteTemplateId: null };
      }
      if (nextNode.type === 'int') {
        return { ...state, cursor: { slotId: `${nextNode.id}_lower`, offset: 0 }, pendingDeleteTemplateId: null };
      }
      if (nextNode.type === 'deriv') {
        return { ...state, cursor: { slotId: `${nextNode.id}_expr`, offset: 0 }, pendingDeleteTemplateId: null };
      }
      if (nextNode.type === 'sqrt') {
        return { ...state, cursor: { slotId: `${nextNode.id}_content`, offset: 0 }, pendingDeleteTemplateId: null };
      }
      if (nextNode.type === 'power') {
        return { ...state, cursor: { slotId: `${nextNode.id}_exp`, offset: 0 }, pendingDeleteTemplateId: null };
      }
      if (nextNode.type === 'logBase') {
        return { ...state, cursor: { slotId: `${nextNode.id}_base`, offset: 0 }, pendingDeleteTemplateId: null };
      }
      return { ...state, cursor: { slotId, offset: offset + 1 }, pendingDeleteTemplateId: null };
    }

    // At the end of the current slot: Break out or transition to next sibling slot
    if (slotId === 'root') {
      return state;
    }

    // Fraction:
    if (slotId.endsWith('_num')) {
      const baseId = slotId.replace(/_num$/, '');
      return { ...state, cursor: { slotId: `${baseId}_den`, offset: 0 }, pendingDeleteTemplateId: null };
    }
    if (slotId.endsWith('_den')) {
      const parentInfo = findSlotParentInfo(root, slotId);
      if (parentInfo) {
        return {
          ...state,
          cursor: { slotId: parentInfo.parentSlotId, offset: parentInfo.parentIndex + 1 },
          pendingDeleteTemplateId: null,
        };
      }
    }

    // Power: Rule 2 specifies "The right arrow exits the slot to after the power node"
    if (slotId.endsWith('_exp')) {
      const parentInfo = findSlotParentInfo(root, slotId);
      if (parentInfo) {
        return {
          ...state,
          cursor: { slotId: parentInfo.parentSlotId, offset: parentInfo.parentIndex + 1 },
          pendingDeleteTemplateId: null,
        };
      }
    }

    // Derivative: _expr -> _at -> breakout
    if (slotId.endsWith('_expr')) {
      const baseId = slotId.replace(/_expr$/, '');
      return { ...state, cursor: { slotId: `${baseId}_at`, offset: 0 }, pendingDeleteTemplateId: null };
    }
    if (slotId.endsWith('_at')) {
      const parentInfo = findSlotParentInfo(root, slotId);
      if (parentInfo) {
        return {
          ...state,
          cursor: { slotId: parentInfo.parentSlotId, offset: parentInfo.parentIndex + 1 },
          pendingDeleteTemplateId: null,
        };
      }
    }

    // Sqrt / Log / Integral breakout
    if (slotId.endsWith('_content') || slotId.endsWith('_integrand') || slotId.endsWith('_arg')) {
      const parentInfo = findSlotParentInfo(root, slotId);
      if (parentInfo) {
        return {
          ...state,
          cursor: { slotId: parentInfo.parentSlotId, offset: parentInfo.parentIndex + 1 },
          pendingDeleteTemplateId: null,
        };
      }
    }

    if (slotId.endsWith('_lower')) {
      const baseId = slotId.replace(/_lower$/, '');
      return { ...state, cursor: { slotId: `${baseId}_upper`, offset: 0 }, pendingDeleteTemplateId: null };
    }
    if (slotId.endsWith('_upper')) {
      const baseId = slotId.replace(/_upper$/, '');
      return { ...state, cursor: { slotId: `${baseId}_integrand`, offset: 0 }, pendingDeleteTemplateId: null };
    }
    if (slotId.endsWith('_base')) {
      const baseId = slotId.replace(/_base$/, '');
      const parentInfo = findSlotParentInfo(root, slotId);
      const targetSuffix = parentInfo?.parentNode?.type === 'power' ? 'exp' : 'arg';
      return { ...state, cursor: { slotId: `${baseId}_${targetSuffix}`, offset: 0 }, pendingDeleteTemplateId: null };
    }

    return state;
  }

  if (direction === 'left') {
    if (offset > 0) {
      const prevNode = currentSlot[offset - 1];
      if (prevNode.type === 'frac') {
        const denNodes = prevNode.den;
        return { ...state, cursor: { slotId: `${prevNode.id}_den`, offset: denNodes.length }, pendingDeleteTemplateId: null };
      }
      if (prevNode.type === 'int') {
        const intNodes = prevNode.integrand;
        return { ...state, cursor: { slotId: `${prevNode.id}_integrand`, offset: intNodes.length }, pendingDeleteTemplateId: null };
      }
      if (prevNode.type === 'deriv') {
        const atNodes = prevNode.at;
        return { ...state, cursor: { slotId: `${prevNode.id}_at`, offset: atNodes.length }, pendingDeleteTemplateId: null };
      }
      if (prevNode.type === 'sqrt') {
        const cNodes = prevNode.content;
        return { ...state, cursor: { slotId: `${prevNode.id}_content`, offset: cNodes.length }, pendingDeleteTemplateId: null };
      }
      if (prevNode.type === 'power') {
        const eNodes = prevNode.exp;
        return { ...state, cursor: { slotId: `${prevNode.id}_exp`, offset: eNodes.length }, pendingDeleteTemplateId: null };
      }
      if (prevNode.type === 'logBase') {
        const aNodes = prevNode.arg;
        return { ...state, cursor: { slotId: `${prevNode.id}_arg`, offset: aNodes.length }, pendingDeleteTemplateId: null };
      }
      return { ...state, cursor: { slotId, offset: offset - 1 }, pendingDeleteTemplateId: null };
    }

    // At offset === 0: Break out to parent left or step to predecessor slot
    if (slotId === 'root') {
      return state;
    }

    if (slotId.endsWith('_den')) {
      const baseId = slotId.replace(/_den$/, '');
      return { ...state, cursor: { slotId: `${baseId}_num`, offset: slotEndOffset(`${baseId}_num`) }, pendingDeleteTemplateId: null };
    }
    if (slotId.endsWith('_integrand')) {
      const baseId = slotId.replace(/_integrand$/, '');
      return { ...state, cursor: { slotId: `${baseId}_upper`, offset: slotEndOffset(`${baseId}_upper`) }, pendingDeleteTemplateId: null };
    }
    if (slotId.endsWith('_upper')) {
      const baseId = slotId.replace(/_upper$/, '');
      return { ...state, cursor: { slotId: `${baseId}_lower`, offset: slotEndOffset(`${baseId}_lower`) }, pendingDeleteTemplateId: null };
    }
    if (slotId.endsWith('_at')) {
      const baseId = slotId.replace(/_at$/, '');
      return { ...state, cursor: { slotId: `${baseId}_expr`, offset: slotEndOffset(`${baseId}_expr`) }, pendingDeleteTemplateId: null };
    }
    if (slotId.endsWith('_arg')) {
      const baseId = slotId.replace(/_arg$/, '');
      return { ...state, cursor: { slotId: `${baseId}_base`, offset: slotEndOffset(`${baseId}_base`) }, pendingDeleteTemplateId: null };
    }

    // Break out to parent left
    const parentInfo = findSlotParentInfo(root, slotId);
    if (parentInfo) {
      return {
        ...state,
        cursor: { slotId: parentInfo.parentSlotId, offset: parentInfo.parentIndex },
        pendingDeleteTemplateId: null,
      };
    }

    return state;
  }

  return state;
}

/**
 * DEL Key Engine:
 * - If immediately after a postfix operator: unwrap the target nodes.
 * - If at offset 0 inside power exp: remove power node and restore base.
 * - If inside an empty template box: highlight then delete container.
 */
export function deleteAst(state: MathAstState): MathAstState {
  const { root, cursor, pendingDeleteTemplateId } = state;
  const currentSlot = getSlotNodes(root, cursor.slotId);
  if (!currentSlot) return state;

  // Case 1: Cursor has items before it
  if (cursor.offset > 0) {
    const newRoot = cloneAst(root);
    const targetSlot = getSlotNodes(newRoot, cursor.slotId)!;
    const removedNode = targetSlot[cursor.offset - 1];

    // If removing a postfix node: unwrap its target!
    if (removedNode && removedNode.type === 'postfix') {
      targetSlot.splice(cursor.offset - 1, 1, ...removedNode.target);
      return {
        root: newRoot,
        cursor: { slotId: cursor.slotId, offset: cursor.offset - 1 + removedNode.target.length },
        pendingDeleteTemplateId: null,
      };
    }

    // If removing a multi-slot template node directly from parent (atomic value nodes delete in one press)
    if (removedNode && removedNode.type !== 'token' && removedNode.type !== 'value') {
      if (pendingDeleteTemplateId !== removedNode.id) {
        return { ...state, pendingDeleteTemplateId: removedNode.id };
      }
    }

    targetSlot.splice(cursor.offset - 1, 1);
    return {
      root: newRoot,
      cursor: { slotId: cursor.slotId, offset: cursor.offset - 1 },
      pendingDeleteTemplateId: null,
    };
  }

  // Case 2: Cursor is at 0 inside a child template box
  if (cursor.slotId !== 'root') {
    const parentInfo = findSlotParentInfo(root, cursor.slotId);
    if (parentInfo && parentInfo.parentNode) {
      const templateId = parentInfo.parentNode.id;

      // 1st press: highlight entire template container
      if (pendingDeleteTemplateId !== templateId) {
        return {
          ...state,
          pendingDeleteTemplateId: templateId,
        };
      }

      // 2nd press: delete template unit entirely
      const newRoot = cloneAst(root);
      const parentSlot = getSlotNodes(newRoot, parentInfo.parentSlotId);
      if (parentSlot) {
        // If deleting a power node from within its exp, restore its base!
        if (parentInfo.parentNode.type === 'power') {
          const baseNodes = parentInfo.parentNode.base;
          parentSlot.splice(parentInfo.parentIndex, 1, ...baseNodes);
          return {
            root: newRoot,
            cursor: { slotId: parentInfo.parentSlotId, offset: parentInfo.parentIndex + baseNodes.length },
            pendingDeleteTemplateId: null,
          };
        }

        parentSlot.splice(parentInfo.parentIndex, 1);
        return {
          root: newRoot,
          cursor: { slotId: parentInfo.parentSlotId, offset: parentInfo.parentIndex },
          pendingDeleteTemplateId: null,
        };
      }
    }
  }

  return { ...state, pendingDeleteTemplateId: null };
}

/**
 * Convert 2D Math AST cleanly to a standard mathematical expression
 * that evaluateMathExpression calculates with full precision.
 */
export function astToExpression(nodes: MathNode[]): string {
  let expr = '';

  for (const node of nodes) {
    if (node.type === 'token') {
      if (node.tokenType === 'OP_NCR') {
        expr += ' _nCr_ ';
      } else if (node.tokenType === 'OP_NPR') {
        expr += ' _nPr_ ';
      } else if (node.tokenType === 'VAR') {
        expr += ` _var_${node.val}_ `;
      } else {
        expr += node.val;
      }
    } else if (node.type === 'value') {
      if (node.exactResult && /^-?\d+\/\d+$/.test(node.exactResult)) {
        const [n, d] = node.exactResult.split('/');
        expr += `((${n})/(${d}))`;
      } else if (isFinite(node.numericVal)) {
        const s = node.numericVal.toString();
        const m = /^(-?\d+(?:\.\d+)?)[eE]([+-]?\d+)$/.exec(s);
        expr += m ? `((${m[1]})×10^(${m[2]}))` : `(${s})`;
      } else {
        expr += '0';
      }
    } else if (node.type === 'frac') {
      const numExpr = astToExpression(node.num) || '0';
      const denExpr = astToExpression(node.den) || '1';
      expr += `((${numExpr})/(${denExpr}))`;
    } else if (node.type === 'postfix') {
      const targetExpr = astToExpression(node.target);
      if (node.op === '²') {
        expr += `((${targetExpr})^2)`;
      } else if (node.op === '³') {
        expr += `((${targetExpr})^3)`;
      } else if (node.op === '⁻¹') {
        expr += `((${targetExpr})^(-1))`;
      } else if (node.op === '!') {
        expr += `(${targetExpr})!`;
      } else if (node.op === '°') {
        expr += `(${targetExpr})°`;
      } else if (node.op === '%') {
        expr += `(${targetExpr})%`;
      }
    } else if (node.type === 'power') {
      const baseExpr = astToExpression(node.base) || '0';
      const expExpr = astToExpression(node.exp) || '1';
      expr += `((${baseExpr})^(${expExpr}))`;
    } else if (node.type === 'int') {
      const integrandExpr = astToExpression(node.integrand) || 'x';
      const lowerExpr = astToExpression(node.lower) || '0';
      const upperExpr = astToExpression(node.upper) || '1';
      expr += `∫(${integrandExpr}, ${lowerExpr}, ${upperExpr})`;
    } else if (node.type === 'deriv') {
      const innerExpr = astToExpression(node.expr) || 'x';
      const atExpr = astToExpression(node.at) || '0';
      expr += `d/dx(${innerExpr}, ${atExpr})`;
    } else if (node.type === 'sqrt') {
      const radExpr = astToExpression(node.content) || '0';
      expr += `√(${radExpr})`;
    } else if (node.type === 'logBase') {
      const baseExpr = astToExpression(node.base) || '10';
      const argExpr = astToExpression(node.arg) || '1';
      expr += `log(${baseExpr}, ${argExpr})`;
    }
  }

  return expr;
}

/**
 * Resolve any `Ans` token nodes inside an AST into atomic `value` nodes
 * so recorded history never displays a bare `Ans` expression.
 */
export function resolveAnsInAst(
  nodes: MathNode[],
  numericVal: number,
  display: string,
  exactResult?: string
): MathNode[] {
  const safeDisplay = display && display !== 'Ans' ? display : String(numericVal);
  const needsParensWhenWrapped = numericVal < 0 || /[+\-×÷/]/.test(safeDisplay.slice(1));

  const makeValueNodes = (wrapNegative: boolean): MathNode[] => {
    const valNode: MathNode = {
      type: 'value',
      id: generateUniqueId('val'),
      numericVal,
      display: safeDisplay,
      ...(exactResult !== undefined ? { exactResult } : {}),
    };
    if (wrapNegative && needsParensWhenWrapped) {
      return [
        { type: 'token', id: generateUniqueId('tok'), val: '(' },
        valNode,
        { type: 'token', id: generateUniqueId('tok'), val: ')' },
      ];
    }
    return [valNode];
  };

  const mapList = (list: MathNode[], wrapNegative = false): MathNode[] => {
    const out: MathNode[] = [];
    for (const node of list) {
      if (node.type === 'token' && node.val === 'Ans') {
        out.push(...makeValueNodes(wrapNegative));
      } else if (node.type === 'token' || node.type === 'value') {
        out.push({ ...node });
      } else if (node.type === 'frac') {
        out.push({
          ...node,
          num: mapList(node.num, false),
          den: mapList(node.den, false),
        });
      } else if (node.type === 'postfix') {
        out.push({
          ...node,
          target: mapList(node.target, true),
        });
      } else if (node.type === 'power') {
        out.push({
          ...node,
          base: mapList(node.base, true),
          exp: mapList(node.exp, false),
        });
      } else if (node.type === 'int') {
        out.push({
          ...node,
          integrand: mapList(node.integrand, false),
          lower: mapList(node.lower, false),
          upper: mapList(node.upper, false),
        });
      } else if (node.type === 'deriv') {
        out.push({
          ...node,
          expr: mapList(node.expr, false),
          at: mapList(node.at, false),
        });
      } else if (node.type === 'sqrt') {
        out.push({
          ...node,
          content: mapList(node.content, false),
        });
      } else if (node.type === 'logBase') {
        out.push({
          ...node,
          base: mapList(node.base, false),
          arg: mapList(node.arg, false),
        });
      }
    }
    return out;
  };

  return mapList(nodes, false);
}

/**
 * Convert 2D Math AST to clean text display representation (for history tape)
 */
export function astToDisplayText(nodes: MathNode[]): string {
  let text = '';

  for (const node of nodes) {
    if (node.type === 'token') {
      text += node.val;
    } else if (node.type === 'value') {
      text += node.display;
    } else if (node.type === 'frac') {
      const numText = astToDisplayText(node.num) || '□';
      const denText = astToDisplayText(node.den) || '□';
      text += `(${numText}/${denText})`;
    } else if (node.type === 'postfix') {
      const targetText = astToDisplayText(node.target);
      text += `${targetText}${node.op}`;
    } else if (node.type === 'power') {
      const baseText = astToDisplayText(node.base);
      const expText = astToDisplayText(node.exp) || '□';
      text += `${baseText}^(${expText})`;
    } else if (node.type === 'int') {
      const intText = astToDisplayText(node.integrand) || '□';
      const lowText = astToDisplayText(node.lower) || '□';
      const upText = astToDisplayText(node.upper) || '□';
      const v = node.variable || 'x';
      text += `∫(${intText}, ${lowText}→${upText}) d${v}`;
    } else if (node.type === 'deriv') {
      const exprText = astToDisplayText(node.expr) || '□';
      const atText = astToDisplayText(node.at) || '□';
      const v = node.variable || 'x';
      text += `d/d${v}(${exprText})|${v}=${atText}`;
    } else if (node.type === 'sqrt') {
      const radText = astToDisplayText(node.content) || '□';
      text += `√(${radText})`;
    } else if (node.type === 'logBase') {
      const bText = astToDisplayText(node.base) || '□';
      const aText = astToDisplayText(node.arg) || '□';
      text += `log(${bText}, ${aText})`;
    }
  }

  return text;
}

/**
 * Structure description formatter for unit testing and physical verification.
 * e.g. "fraction(num=(6)², den=empty), cursor in den"
 */
export function astToStructureDescription(state: MathAstState): string {
  function nodeToStructure(node: MathNode): string {
    if (node.type === 'token') return node.val;
    if (node.type === 'value') return node.display;
    if (node.type === 'frac') {
      const numStr = node.num.length === 0 ? 'empty' : node.num.map(nodeToStructure).join('');
      const denStr = node.den.length === 0 ? 'empty' : node.den.map(nodeToStructure).join('');
      return `fraction(num=${numStr}, den=${denStr})`;
    }
    if (node.type === 'postfix') {
      const targetStr = node.target.map(nodeToStructure).join('');
      return `${targetStr}${node.op}`;
    }
    if (node.type === 'power') {
      const baseStr = node.base.map(nodeToStructure).join('');
      const expStr = node.exp.length === 0 ? 'empty' : node.exp.map(nodeToStructure).join('');
      return `power(${baseStr}, ${expStr})`;
    }
    if (node.type === 'sqrt') {
      const cStr = node.content.map(nodeToStructure).join('');
      return `sqrt(${cStr})`;
    }
    if (node.type === 'int') {
      return `int(...)`;
    }
    if (node.type === 'deriv') {
      return `deriv(...)`;
    }
    if (node.type === 'logBase') {
      return `logBase(...)`;
    }
    return '';
  }

  let desc = state.root.map(nodeToStructure).join('');
  if (state.cursor.slotId.endsWith('_den')) {
    desc += ', cursor in den';
  } else if (state.cursor.slotId.endsWith('_num')) {
    desc += ', cursor in num';
  } else if (state.cursor.slotId.endsWith('_exp')) {
    desc += ', cursor in exp';
  }
  return desc;
}

/**
 * Simulate a sequence of interactive keystrokes through the AST engine
 */
export function simulateKeystrokes(keys: string[]): MathAstState {
  let state = createInitialAstState();

  for (const k of keys) {
    if (k === '÷' || k === '/' || k === 'frac' || k === '■/□') {
      state = insertFraction(state);
    } else if (k === 'x□' || k === '^') {
      state = insertPower(state);
    } else if (k === 'e^□') {
      state = insertConstantPower(state, ['e']);
    } else if (k === '10^□') {
      state = insertConstantPower(state, ['1', '0']);
    } else if (k === '×10^x' || k === '×10^(') {
      state = insertScientificTenPower(state);
    } else if (k === 'x²' || k === '²') {
      state = insertPostfix(state, '²');
    } else if (k === 'x³' || k === '³') {
      state = insertPostfix(state, '³');
    } else if (k === 'x⁻¹' || k === '⁻¹') {
      state = insertPostfix(state, '⁻¹');
    } else if (k === 'x!' || k === '!') {
      state = insertPostfix(state, '!');
    } else if (k === '°') {
      state = insertPostfix(state, '°');
    } else if (k === '%') {
      state = insertPostfix(state, '%');
    } else if (k === 'RIGHT' || k === '->') {
      state = navigateAst(state, 'right');
    } else if (k === 'LEFT' || k === '<-') {
      state = navigateAst(state, 'left');
    } else if (k === 'UP') {
      state = navigateAst(state, 'up');
    } else if (k === 'DOWN') {
      state = navigateAst(state, 'down');
    } else if (k === 'DEL') {
      state = deleteAst(state);
    } else if (k === 'OP_NCR' || k === 'nCr') {
      state = insertToken(state, 'C', 'OP_NCR');
    } else if (k === 'OP_NPR' || k === 'nPr') {
      state = insertToken(state, 'P', 'OP_NPR');
    } else if (k === 'VAR_C' || k === 'ALPHA_C') {
      state = insertToken(state, 'C', 'VAR');
    } else if (k === 'ALPHA') {
      // In key stream, next key will be checked if it's variable
      continue;
    } else if (/^[A-FMXY]$/.test(k)) {
      state = insertToken(state, k, 'VAR');
    } else {
      state = insertToken(state, k);
    }
  }

  return state;
}

/**
 * Fold `×10^(exp)` and `base^(exp)` segments in flat token lists into structured `power` nodes
 * so expressions restored from history strings render with raised superscripts.
 */
function foldPowerTemplatesInNodes(rawNodes: MathNode[]): MathNode[] {
  const out: MathNode[] = [];
  let i = 0;

  while (i < rawNodes.length) {
    const node = rawNodes[i];
    if (
      node.type === 'token' &&
      node.val === '×10^' &&
      rawNodes[i + 1]?.type === 'token' &&
      (rawNodes[i + 1] as { type: 'token'; val: string }).val === '('
    ) {
      let depth = 1;
      let j = i + 2;
      while (j < rawNodes.length && depth > 0) {
        const cur = rawNodes[j];
        if (cur.type === 'token') {
          if (cur.val === '(' || cur.val.endsWith('(')) depth++;
          else if (cur.val === ')') depth--;
        }
        j++;
      }
      if (depth === 0) {
        const expInner = foldPowerTemplatesInNodes(rawNodes.slice(i + 2, j - 1));
        out.push({ type: 'token', id: generateUniqueId('tok'), val: '×' });
        out.push({
          type: 'power',
          id: generateUniqueId('power'),
          base: [
            { type: 'token', id: generateUniqueId('tok'), val: '1' },
            { type: 'token', id: generateUniqueId('tok'), val: '0' },
          ],
          exp: expInner,
        });
        i = j;
        continue;
      }
    }

    if (
      node.type === 'token' &&
      node.val === '^' &&
      out.length > 0 &&
      rawNodes[i + 1]?.type === 'token' &&
      (rawNodes[i + 1] as { type: 'token'; val: string }).val === '('
    ) {
      let depth = 1;
      let j = i + 2;
      while (j < rawNodes.length && depth > 0) {
        const cur = rawNodes[j];
        if (cur.type === 'token') {
          if (cur.val === '(' || cur.val.endsWith('(')) depth++;
          else if (cur.val === ')') depth--;
        }
        j++;
      }
      if (depth === 0) {
        const operandInfo = extractPreviousOperand(out, out.length);
        if (operandInfo && operandInfo.nodes.length > 0) {
          out.splice(operandInfo.startIndex, operandInfo.nodes.length);
          const expInner = foldPowerTemplatesInNodes(rawNodes.slice(i + 2, j - 1));
          out.push({
            type: 'power',
            id: generateUniqueId('power'),
            base: operandInfo.nodes,
            exp: expInner,
          });
          i = j;
          continue;
        }
      }
    }

    out.push(node);
    i++;
  }

  return out;
}

/**
 * Convert plain string (from history or paste) into basic AST nodes
 */
export function parseStringToAst(exprStr: string): MathAstState {
  if (!exprStr) return createInitialAstState();

  const rawNodes: MathNode[] = [];
  const tokenRegex = /(sin⁻¹|cos⁻¹|tan⁻¹|sinh|cosh|tanh|sin|cos|tan|ln|log|Ans|Pol|Rec|d\/dx|×10\^|√|³√|\d+(\.\d+)?|[a-zA-Z]|[-+×÷=()²³⁻¹^!%,.])/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = tokenRegex.exec(exprStr)) !== null) {
    if (match.index > lastIndex) {
      const skipped = exprStr.slice(lastIndex, match.index).trim();
      if (skipped) {
        for (const char of skipped) {
          rawNodes.push({ type: 'token', id: generateUniqueId('tok'), val: char });
        }
      }
    }
    rawNodes.push({ type: 'token', id: generateUniqueId('tok'), val: match[0] });
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < exprStr.length) {
    const remaining = exprStr.slice(lastIndex);
    for (const char of remaining) {
      rawNodes.push({ type: 'token', id: generateUniqueId('tok'), val: char });
    }
  }

  const nodes = foldPowerTemplatesInNodes(rawNodes);

  return {
    root: nodes,
    cursor: { slotId: 'root', offset: nodes.length },
    pendingDeleteTemplateId: null,
  };
}

function isTrailingIncompleteToken(node: MathNode): boolean {
  if (node.type !== 'token') return false;
  if (node.tokenType === 'OP_NCR' || node.tokenType === 'OP_NPR') return true;
  const v = node.val;
  if (
    v === '+' ||
    v === '-' ||
    v === '−' ||
    v === '×' ||
    v === '*' ||
    v === '÷' ||
    v === '/' ||
    v === '^' ||
    v === ',' ||
    v === '.' ||
    v === '(' ||
    v === '(-' ||
    v === 'nPr' ||
    v === 'nCr' ||
    v.endsWith('(') ||
    v.endsWith('.')
  ) {
    return true;
  }
  return false;
}

function isOpenerToken(val: string): boolean {
  return val === '(' || val === '(-' || val.endsWith('(');
}

function isSlotCompleteForPreview(slotNodes: MathNode[]): boolean {
  if (slotNodes.length === 0) return false;
  if (isTrailingIncompleteToken(slotNodes[slotNodes.length - 1])) return false;

  let parenDepth = 0;
  for (let i = 0; i < slotNodes.length; i++) {
    const node = slotNodes[i];
    if (node.type === 'token') {
      if (isOpenerToken(node.val)) {
        parenDepth++;
        // Empty parentheses () or sin() are incomplete
        const next = slotNodes[i + 1];
        if (next && next.type === 'token' && next.val === ')') {
          return false;
        }
      } else if (node.val === ')') {
        parenDepth--;
        if (parenDepth < 0) return false;
      }
    } else if (node.type === 'frac') {
      if (!isSlotCompleteForPreview(node.num) || !isSlotCompleteForPreview(node.den)) return false;
    } else if (node.type === 'power') {
      if (!isSlotCompleteForPreview(node.base) || !isSlotCompleteForPreview(node.exp)) return false;
    } else if (node.type === 'sqrt') {
      if (!isSlotCompleteForPreview(node.content)) return false;
    } else if (node.type === 'logBase') {
      if (!isSlotCompleteForPreview(node.base) || !isSlotCompleteForPreview(node.arg)) return false;
    } else if (node.type === 'int') {
      if (
        !isSlotCompleteForPreview(node.integrand) ||
        !isSlotCompleteForPreview(node.lower) ||
        !isSlotCompleteForPreview(node.upper)
      ) {
        return false;
      }
    } else if (node.type === 'deriv') {
      if (!isSlotCompleteForPreview(node.expr) || !isSlotCompleteForPreview(node.at)) return false;
    } else if (node.type === 'postfix') {
      if (!isSlotCompleteForPreview(node.target)) return false;
    }
  }

  return parenDepth === 0;
}

/**
 * Returns true only when the AST has no empty template slots, balanced parentheses,
 * and no trailing incomplete operators or decimal points.
 */
export function isAstCompleteForPreview(nodes: MathNode[]): boolean {
  return isSlotCompleteForPreview(nodes);
}

/**
 * Returns true when the AST represents an actual computation, template, function,
 * constant, or variable — avoiding echoing a bare literal number under itself while typing.
 */
export function hasComputableOperation(nodes: MathNode[]): boolean {
  if (nodes.length === 0) return false;
  if (nodes.length === 1 && nodes[0].type === 'value') {
    return Boolean(nodes[0].exactResult);
  }
  for (const node of nodes) {
    if (node.type !== 'token') return true;
    if (!/^[0-9.]+$/.test(node.val)) return true;
  }
  return false;
}

