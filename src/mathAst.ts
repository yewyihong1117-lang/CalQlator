/**
 * Casio fx-570EX 2D Math AST Template System
 * Implements Natural-V.P.A.M. 2D templates for Fractions, Definite Integrals,
 * Radicals (Square Root), Logarithms with Custom Base, and Powers with dynamic
 * placeholders and D-Pad navigation.
 */

export type MathNode =
  | { type: 'token'; id: string; val: string }
  | { type: 'frac'; id: string; num: MathNode[]; den: MathNode[] }
  | { type: 'int'; id: string; integrand: MathNode[]; lower: MathNode[]; upper: MathNode[] }
  | { type: 'sqrt'; id: string; content: MathNode[] }
  | { type: 'power'; id: string; exp: MathNode[] }
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
    } else if (node.type === 'sqrt') {
      if (`${node.id}_content` === slotId) return node.content;
      const sub = getSlotNodes(node.content, slotId);
      if (sub) return sub;
    } else if (node.type === 'power') {
      if (`${node.id}_exp` === slotId) return node.exp;
      const sub = getSlotNodes(node.exp, slotId);
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
    } else if (node.type === 'sqrt') {
      if (`${node.id}_content` === targetSlotId) {
        return { parentNode: node, parentSlotId, parentIndex: i };
      }
      const deeper = findSlotParentInfo(root, targetSlotId, `${node.id}_content`);
      if (deeper) return deeper;
    } else if (node.type === 'power') {
      if (`${node.id}_exp` === targetSlotId) {
        return { parentNode: node, parentSlotId, parentIndex: i };
      }
      const deeper = findSlotParentInfo(root, targetSlotId, `${node.id}_exp`);
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

/**
 * Insert a token (number, operator, variable, etc.) at current cursor
 */
export function insertToken(state: MathAstState, tokenVal: string): MathAstState {
  const newRoot = cloneAst(state.root);
  const slotNodes = getSlotNodes(newRoot, state.cursor.slotId);
  if (!slotNodes) return state;

  const newNode: MathNode = {
    type: 'token',
    id: generateUniqueId('tok'),
    val: tokenVal,
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
 * Natural Display: Fraction Key (■/□)
 * Rule 1: If an expression/number precedes cursor, wrap preceding token into numerator
 * and place cursor directly into denominator box: \frac{preceding}{[\vert]}.
 * Rule 2: If no selection/preceding token: Insert \frac{[\vert]}{[\quad]}, focus numerator.
 */
export function insertFraction(state: MathAstState): MathAstState {
  const newRoot = cloneAst(state.root);
  const slotNodes = getSlotNodes(newRoot, state.cursor.slotId);
  if (!slotNodes) return state;

  const fracId = generateUniqueId('frac');
  const offset = Math.min(Math.max(0, state.cursor.offset), slotNodes.length);

  // Check if preceding token or group exists
  let numNodes: MathNode[] = [];
  let insertIndex = offset;

  if (offset > 0) {
    // Extract preceding token(s)
    // If preceded by a number sequence or variable or bracketed expression
    const prevNode = slotNodes[offset - 1];
    if (prevNode.type === 'token') {
      // Gather consecutive alphanumeric/digit characters preceding cursor
      let startIdx = offset - 1;
      while (startIdx > 0 && slotNodes[startIdx - 1].type === 'token') {
        const prevChar = (slotNodes[startIdx - 1] as { type: 'token'; val: string }).val;
        if (/^[0-9.a-zA-Z]$/.test(prevChar)) {
          startIdx--;
        } else {
          break;
        }
      }
      numNodes = slotNodes.splice(startIdx, offset - startIdx);
      insertIndex = startIdx;
    } else {
      // Single previous complex node (e.g. sqrt or power)
      numNodes = slotNodes.splice(offset - 1, 1);
      insertIndex = offset - 1;
    }
  }

  const fracNode: MathNode = {
    type: 'frac',
    id: fracId,
    num: numNodes,
    den: [],
  };

  slotNodes.splice(insertIndex, 0, fracNode);

  // If we wrapped preceding into numerator, cursor goes directly to denominator!
  if (numNodes.length > 0) {
    return {
      root: newRoot,
      cursor: { slotId: `${fracId}_den`, offset: 0 },
      pendingDeleteTemplateId: null,
    };
  } else {
    // Otherwise focus numerator box
    return {
      root: newRoot,
      cursor: { slotId: `${fracId}_num`, offset: 0 },
      pendingDeleteTemplateId: null,
    };
  }
}

/**
 * Natural Display: Integral Key (∫dx)
 * Insert full definite integral structure: \int_{[\quad]}^{[\quad]} ([\vert])\,dx
 * Primary focus placed inside the integrand box ([\vert]).
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
  };

  slotNodes.splice(offset, 0, intNode);

  return {
    root: newRoot,
    cursor: { slotId: `${intId}_integrand`, offset: 0 },
    pendingDeleteTemplateId: null,
  };
}

/**
 * Natural Display: Square Root (√■)
 * Insert \sqrt{[\vert]} with cursor inside root container.
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
 * Natural Display: Power (xⁿ)
 * Insert exponent box superscript.
 */
export function insertPower(state: MathAstState): MathAstState {
  const newRoot = cloneAst(state.root);
  const slotNodes = getSlotNodes(newRoot, state.cursor.slotId);
  if (!slotNodes) return state;

  const powerId = generateUniqueId('power');
  const offset = Math.min(Math.max(0, state.cursor.offset), slotNodes.length);

  const powerNode: MathNode = {
    type: 'power',
    id: powerId,
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
 * Natural Display: Log Base (log□■)
 * Insert \log_{[\quad]}([\vert]), focusing base box first.
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

  // Focus base box first
  return {
    root: newRoot,
    cursor: { slotId: `${logId}_base`, offset: 0 },
    pendingDeleteTemplateId: null,
  };
}

/**
 * D-Pad Navigation Engine:
 * Maps LEFT, RIGHT, UP, DOWN across active template child boxes.
 * Pressing RIGHT when at the end of a denominator or integrand breaks out of template into main line flow.
 */
export function navigateAst(state: MathAstState, direction: 'left' | 'right' | 'up' | 'down'): MathAstState {
  const { root, cursor } = state;
  const currentSlot = getSlotNodes(root, cursor.slotId);
  if (!currentSlot) return state;

  const slotId = cursor.slotId;
  const offset = cursor.offset;

  if (direction === 'up') {
    // 1. Fraction: In denominator, UP moves to numerator
    if (slotId.endsWith('_den')) {
      const baseId = slotId.replace(/_den$/, '');
      return { ...state, cursor: { slotId: `${baseId}_num`, offset: 0 }, pendingDeleteTemplateId: null };
    }
    // 2. Integral: In integrand or lower limit, UP moves to upper limit
    if (slotId.endsWith('_integrand') || slotId.endsWith('_lower')) {
      const baseId = slotId.replace(/_(integrand|lower)$/, '');
      return { ...state, cursor: { slotId: `${baseId}_upper`, offset: 0 }, pendingDeleteTemplateId: null };
    }
    // 3. LogBase: In base, UP moves to argument
    if (slotId.endsWith('_base')) {
      const baseId = slotId.replace(/_base$/, '');
      return { ...state, cursor: { slotId: `${baseId}_arg`, offset: 0 }, pendingDeleteTemplateId: null };
    }
    return state;
  }

  if (direction === 'down') {
    // 1. Fraction: In numerator, DOWN moves to denominator
    if (slotId.endsWith('_num')) {
      const baseId = slotId.replace(/_num$/, '');
      return { ...state, cursor: { slotId: `${baseId}_den`, offset: 0 }, pendingDeleteTemplateId: null };
    }
    // 2. Integral: In integrand or upper limit, DOWN moves to lower limit
    if (slotId.endsWith('_integrand') || slotId.endsWith('_upper')) {
      const baseId = slotId.replace(/_(integrand|upper)$/, '');
      return { ...state, cursor: { slotId: `${baseId}_lower`, offset: 0 }, pendingDeleteTemplateId: null };
    }
    // 3. Power: In exponent, DOWN breaks out to parent base line
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
        return { ...state, cursor: { slotId: `${nextNode.id}_integrand`, offset: 0 }, pendingDeleteTemplateId: null };
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
      return state; // Already at the end of expression
    }

    // Fraction:
    if (slotId.endsWith('_num')) {
      // Step from numerator to denominator
      const baseId = slotId.replace(/_num$/, '');
      return { ...state, cursor: { slotId: `${baseId}_den`, offset: 0 }, pendingDeleteTemplateId: null };
    }
    if (slotId.endsWith('_den')) {
      // Break out to main line flow
      const parentInfo = findSlotParentInfo(root, slotId);
      if (parentInfo) {
        return {
          ...state,
          cursor: { slotId: parentInfo.parentSlotId, offset: parentInfo.parentIndex + 1 },
          pendingDeleteTemplateId: null,
        };
      }
    }

    // Integral:
    if (slotId.endsWith('_lower')) {
      const baseId = slotId.replace(/_lower$/, '');
      return { ...state, cursor: { slotId: `${baseId}_upper`, offset: 0 }, pendingDeleteTemplateId: null };
    }
    if (slotId.endsWith('_upper')) {
      const baseId = slotId.replace(/_upper$/, '');
      return { ...state, cursor: { slotId: `${baseId}_integrand`, offset: 0 }, pendingDeleteTemplateId: null };
    }
    if (slotId.endsWith('_integrand')) {
      // Break out of integral into main line flow
      const parentInfo = findSlotParentInfo(root, slotId);
      if (parentInfo) {
        return {
          ...state,
          cursor: { slotId: parentInfo.parentSlotId, offset: parentInfo.parentIndex + 1 },
          pendingDeleteTemplateId: null,
        };
      }
    }

    // Sqrt / Power / Log:
    if (slotId.endsWith('_content') || slotId.endsWith('_exp')) {
      const parentInfo = findSlotParentInfo(root, slotId);
      if (parentInfo) {
        return {
          ...state,
          cursor: { slotId: parentInfo.parentSlotId, offset: parentInfo.parentIndex + 1 },
          pendingDeleteTemplateId: null,
        };
      }
    }
    if (slotId.endsWith('_base')) {
      const baseId = slotId.replace(/_base$/, '');
      return { ...state, cursor: { slotId: `${baseId}_arg`, offset: 0 }, pendingDeleteTemplateId: null };
    }
    if (slotId.endsWith('_arg')) {
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
      const numNodes = getSlotNodes(root, `${baseId}_num`) || [];
      return { ...state, cursor: { slotId: `${baseId}_num`, offset: numNodes.length }, pendingDeleteTemplateId: null };
    }

    if (slotId.endsWith('_integrand')) {
      const baseId = slotId.replace(/_integrand$/, '');
      const upNodes = getSlotNodes(root, `${baseId}_upper`) || [];
      return { ...state, cursor: { slotId: `${baseId}_upper`, offset: upNodes.length }, pendingDeleteTemplateId: null };
    }

    if (slotId.endsWith('_upper')) {
      const baseId = slotId.replace(/_upper$/, '');
      const lowNodes = getSlotNodes(root, `${baseId}_lower`) || [];
      return { ...state, cursor: { slotId: `${baseId}_lower`, offset: lowNodes.length }, pendingDeleteTemplateId: null };
    }

    if (slotId.endsWith('_arg')) {
      const baseId = slotId.replace(/_arg$/, '');
      const bNodes = getSlotNodes(root, `${baseId}_base`) || [];
      return { ...state, cursor: { slotId: `${baseId}_base`, offset: bNodes.length }, pendingDeleteTemplateId: null };
    }

    // Break out to parent left (before template)
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
 * - If slot has items before cursor: deletes preceding node.
 * - If inside an empty template box:
 *   1st DEL: Highlights the entire template container (pendingDeleteTemplateId).
 *   2nd DEL: Deletes the template unit entirely and restores cursor to parent line.
 */
export function deleteAst(state: MathAstState): MathAstState {
  const { root, cursor, pendingDeleteTemplateId } = state;
  const currentSlot = getSlotNodes(root, cursor.slotId);
  if (!currentSlot) return state;

  // Case 1: If cursor is not at 0, delete preceding node
  if (cursor.offset > 0) {
    const newRoot = cloneAst(root);
    const targetSlot = getSlotNodes(newRoot, cursor.slotId)!;
    const removedNode = targetSlot[cursor.offset - 1];

    // If removing a template node directly from parent
    if (removedNode && removedNode.type !== 'token') {
      if (pendingDeleteTemplateId !== removedNode.id) {
        // Highlight first
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

      // 2nd press: delete template unit entirely!
      const newRoot = cloneAst(root);
      const parentSlot = getSlotNodes(newRoot, parentInfo.parentSlotId);
      if (parentSlot) {
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
      expr += node.val;
    } else if (node.type === 'frac') {
      const numExpr = astToExpression(node.num) || '0';
      const denExpr = astToExpression(node.den) || '1';
      expr += `((${numExpr})/(${denExpr}))`;
    } else if (node.type === 'int') {
      const integrandExpr = astToExpression(node.integrand) || 'x';
      const lowerExpr = astToExpression(node.lower) || '0';
      const upperExpr = astToExpression(node.upper) || '1';
      expr += `∫(${integrandExpr}, ${lowerExpr}, ${upperExpr})`;
    } else if (node.type === 'sqrt') {
      const radExpr = astToExpression(node.content) || '0';
      expr += `√(${radExpr})`;
    } else if (node.type === 'power') {
      const expExpr = astToExpression(node.exp) || '1';
      expr += `^(${expExpr})`;
    } else if (node.type === 'logBase') {
      const baseExpr = astToExpression(node.base) || '10';
      const argExpr = astToExpression(node.arg) || '1';
      expr += `log(${baseExpr}, ${argExpr})`;
    }
  }

  return expr;
}

/**
 * Convert 2D Math AST to clean text display representation (for history tape)
 */
export function astToDisplayText(nodes: MathNode[]): string {
  let text = '';

  for (const node of nodes) {
    if (node.type === 'token') {
      text += node.val;
    } else if (node.type === 'frac') {
      const numText = astToDisplayText(node.num) || '□';
      const denText = astToDisplayText(node.den) || '□';
      text += `[${numText}/${denText}]`;
    } else if (node.type === 'int') {
      const intText = astToDisplayText(node.integrand) || '□';
      const lowText = astToDisplayText(node.lower) || '□';
      const upText = astToDisplayText(node.upper) || '□';
      text += `∫_{${lowText}}^{${upText}} (${intText}) dx`;
    } else if (node.type === 'sqrt') {
      const radText = astToDisplayText(node.content) || '□';
      text += `√(${radText})`;
    } else if (node.type === 'power') {
      const expText = astToDisplayText(node.exp) || '□';
      text += `^(${expText})`;
    } else if (node.type === 'logBase') {
      const bText = astToDisplayText(node.base) || '□';
      const aText = astToDisplayText(node.arg) || '□';
      text += `log_{${bText}}(${aText})`;
    }
  }

  return text;
}

/**
 * Convert plain string (from history or paste) into basic AST nodes
 */
export function parseStringToAst(exprStr: string): MathAstState {
  if (!exprStr) return createInitialAstState();

  const nodes: MathNode[] = [];
  // Match standard multi-char tokens first, or single characters
  const tokenRegex = /(sin⁻¹|cos⁻¹|tan⁻¹|sinh|cosh|tanh|sin|cos|tan|ln|log|Ans|Pol|Rec|d\/dx|×10\^|√|³√|\d+(\.\d+)?|[a-zA-Z]|[-+×÷=()²³⁻¹^!%,.])/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = tokenRegex.exec(exprStr)) !== null) {
    if (match.index > lastIndex) {
      const skipped = exprStr.slice(lastIndex, match.index).trim();
      if (skipped) {
        for (const char of skipped) {
          nodes.push({ type: 'token', id: generateUniqueId('tok'), val: char });
        }
      }
    }
    nodes.push({ type: 'token', id: generateUniqueId('tok'), val: match[0] });
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < exprStr.length) {
    const remaining = exprStr.slice(lastIndex);
    for (const char of remaining) {
      nodes.push({ type: 'token', id: generateUniqueId('tok'), val: char });
    }
  }

  return {
    root: nodes,
    cursor: { slotId: 'root', offset: nodes.length },
    pendingDeleteTemplateId: null,
  };
}
