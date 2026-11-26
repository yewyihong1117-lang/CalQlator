import React, { useEffect, useRef } from 'react';
import { MathNode, CursorPosition, getSlotNodes } from '../mathAst';
import { formatDisplayNumberWithCommas } from '../displayFormat';
import { IntegralSvg, RadicalHookSvg, HollowBoxSvg, OperatorSvg, SigmaSvg } from './MathGlyphs';

/**
 * Computes which single-digit token indices in a node list should display
 * a trailing visual thousands separator comma without mutating AST indices.
 */
function computeCommaAfterIndices(slotNodes: MathNode[]): Set<number> {
  const commaAfter = new Set<number>();
  let i = 0;
  while (i < slotNodes.length) {
    const n = slotNodes[i];
    if (n.type === 'token' && /^[0-9]$/.test(n.val)) {
      const start = i;
      while (
        i < slotNodes.length &&
        slotNodes[i].type === 'token' &&
        /^[0-9]$/.test((slotNodes[i] as { type: 'token'; val: string }).val)
      ) {
        i++;
      }
      const intLen = i - start;
      // Only add commas if not immediately preceded by '.' (fractional digits)
      const prev = start > 0 ? slotNodes[start - 1] : null;
      const isAfterDecimal = prev?.type === 'token' && (prev.val === '.' || prev.val.endsWith('.'));
      if (intLen >= 4 && !isAfterDecimal) {
        for (let k = start; k < i - 1; k++) {
          const remaining = i - 1 - k;
          if (remaining > 0 && remaining % 3 === 0) {
            commaAfter.add(k);
          }
        }
      }
      // If followed by '.' and fractional digits, skip the fractional segment
      if (i < slotNodes.length && slotNodes[i].type === 'token' && (slotNodes[i] as { type: 'token'; val: string }).val === '.') {
        i++;
        while (
          i < slotNodes.length &&
          slotNodes[i].type === 'token' &&
          /^[0-9]$/.test((slotNodes[i] as { type: 'token'; val: string }).val)
        ) {
          i++;
        }
      }
      continue;
    }
    i++;
  }
  return commaAfter;
}

/**
 * Hit-tests a pointer clientX/target against rendered AST slot elements and calls onSetCursor.
 */
export function placeCursorAtClientPoint(
  container: HTMLElement | null,
  nodes: MathNode[],
  clientX: number,
  target: EventTarget | null,
  onSetCursor: (slotId: string, offset: number) => void
): void {
  if (!container) return;

  const targetEl = target instanceof Element ? (target.closest('[data-slot-id]') as HTMLElement | null) : null;
  const rawSlotId = targetEl && container.contains(targetEl) ? targetEl.getAttribute('data-slot-id') : null;
  const slotId = rawSlotId && getSlotNodes(nodes, rawSlotId) !== null ? rawSlotId : 'root';
  const slotNodes = getSlotNodes(nodes, slotId) || nodes;

  if (slotNodes.length === 0) {
    onSetCursor(slotId, 0);
    return;
  }

  const childEls = Array.from(container.querySelectorAll('[data-ast-slot]')).filter(
    (el) => el.getAttribute('data-ast-slot') === slotId && el.hasAttribute('data-ast-index')
  ) as HTMLElement[];

  let targetOffset = slotNodes.length;
  for (const el of childEls) {
    const idx = Number(el.getAttribute('data-ast-index'));
    if (Number.isNaN(idx)) continue;
    const rect = el.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    if (clientX < midX) {
      targetOffset = idx;
      break;
    }
  }

  onSetCursor(slotId, targetOffset);
}

interface NaturalDisplayProps {
  nodes: MathNode[];
  cursor?: CursorPosition;
  pendingDeleteTemplateId?: string | null;
  onSetCursor?: (slotId: string, offset: number) => void;
  deferTapCursor?: boolean;
  displayRef?: React.RefObject<HTMLDivElement | null>;
  fontSize?: number;
  readOnly?: boolean;
  inheritColor?: boolean;
  align?: 'left' | 'right';
  className?: string;
}

export const NaturalDisplay: React.FC<NaturalDisplayProps> = React.memo(({
  nodes,
  cursor,
  pendingDeleteTemplateId = null,
  onSetCursor,
  deferTapCursor = false,
  displayRef,
  fontSize,
  readOnly = false,
  inheritColor = false,
  align = 'left',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const setContainerRefs = (el: HTMLDivElement | null) => {
    containerRef.current = el;
    if (displayRef) {
      displayRef.current = el;
    }
  };

  // Auto-scroll horizontally only inside the display expression container to keep active cursor visible
  useEffect(() => {
    if (readOnly) return;
    const container = containerRef.current;
    if (!container) return;

    const activeCursorEl = container.querySelector('.active-lcd-cursor') as HTMLElement | null;
    if (activeCursorEl) {
      const cRect = container.getBoundingClientRect();
      const kRect = activeCursorEl.getBoundingClientRect();
      const scale = container.clientWidth > 0 && cRect.width > 0 ? cRect.width / container.clientWidth : 1;
      const pad = 16 * scale;
      if (kRect.left < cRect.left + pad) {
        container.scrollLeft -= (cRect.left + pad - kRect.left) / scale;
      } else if (kRect.right > cRect.right - pad) {
        container.scrollLeft += (kRect.right - (cRect.right - pad)) / scale;
      }
    } else {
      container.scrollLeft = container.scrollWidth;
    }
  }, [nodes, cursor, fontSize, readOnly]);

  // Render a cursor bar if this slot and offset matches active cursor
  const renderCursor = (slotId: string, offset: number) => {
    if (readOnly || !cursor) return null;
    if (cursor.slotId === slotId && cursor.offset === offset) {
      return (
        <span
          key={`cur_${slotId}_${offset}`}
          data-testid="lcd-caret"
          className="active-lcd-cursor lcd-caret-blink inline-block w-[2px] h-[1.14em] bg-[var(--ui-accent)] mx-[1px] rounded-full align-baseline"
        />
      );
    }
    return null;
  };

  // Render a token value with matching math glyph/serif typography for in-scope symbols only
  const renderTokenContent = (val: string) => {
    if (val === 'x' || val === 'y' || val === 'e') {
      return <span className="font-math-serif italic">{val}</span>;
    }
    if (val === 'π' || val === '(' || val === ')' || val === ',') {
      return <span className="font-math-serif not-italic">{val}</span>;
    }
    if (val === '+') {
      return <OperatorSvg op="+" className="w-[0.72em] h-[0.72em] align-[-0.07em]" />;
    }
    if (val === '-' || val === '−') {
      return <OperatorSvg op="−" className="w-[0.72em] h-[0.72em] align-[-0.07em]" />;
    }
    if (val === '×') {
      return <OperatorSvg op="×" className="w-[0.7em] h-[0.7em] align-[-0.06em]" />;
    }
    if (val === '÷') {
      return <OperatorSvg op="÷" className="w-[0.72em] h-[0.72em] align-[-0.07em]" />;
    }
    if (val === '=') {
      return <OperatorSvg op="=" className="w-[0.72em] h-[0.72em] align-[-0.07em]" />;
    }
    if (val === '(-') {
      return (
        <span className="font-math-serif not-italic inline-flex items-baseline">
          <span>(</span>
          <OperatorSvg op="−" className="w-[0.65em] h-[0.65em] align-[-0.05em]" />
        </span>
      );
    }
    if (val === '×10^(') {
      return (
        <span className="inline-flex items-baseline">
          <OperatorSvg op="×" className="w-[0.66em] h-[0.66em] align-[-0.05em] mr-[0.04em]" />
          <span>10^(</span>
        </span>
      );
    }
    if (val === 'e^(') {
      return (
        <span className="inline-flex items-baseline">
          <span className="font-math-serif italic">e</span>
          <span className="font-math-serif not-italic">^(</span>
        </span>
      );
    }
    if (val === 'Σ(') {
      return (
        <span className="inline-flex items-baseline">
          <SigmaSvg className="w-[0.72em] h-[0.84em] align-[-0.05em]" />
          <span className="font-math-serif not-italic">(</span>
        </span>
      );
    }
    if (val === '³√(') {
      return (
        <span className="inline-flex items-baseline">
          <sup className="font-math-serif not-italic text-[0.65em] -mr-[0.05em]">3</sup>
          <RadicalHookSvg className="w-[0.5em] h-[1em] align-[-0.1em]" />
          <span className="font-math-serif not-italic">(</span>
        </span>
      );
    }
    if (/^\d{4,}(\.\d+)?$/.test(val)) {
      return formatDisplayNumberWithCommas(val);
    }
    return val;
  };

  // Render a slot's list of nodes with intermittent cursor points (strictly no wrapping)
  const renderSlotList = (slotNodes: MathNode[], slotId: string, placeholder = '□') => {
    const isCurrentSlot = !readOnly && cursor?.slotId === slotId;
    const placeholderEl =
      placeholder === '□' ? <HollowBoxSvg className="w-[0.68em] h-[0.68em]" /> : placeholder;

    if (slotNodes.length === 0) {
      if (readOnly) {
        return (
          <span className="inline-flex items-center justify-center w-[0.95em] h-[1.05em] text-[0.88em] leading-none align-baseline rounded-[0.15em] border border-dashed border-current opacity-40 select-none">
            {placeholderEl}
          </span>
        );
      }
      return (
        <span
          className={`inline-flex items-center justify-center w-[0.95em] h-[1.05em] text-[0.88em] leading-none align-baseline rounded-[0.15em] cursor-pointer font-sans select-none ${
            isCurrentSlot
              ? 'border border-dashed border-current bg-current/15 opacity-100'
              : 'border border-dashed border-current opacity-45 hover:opacity-75'
          }`}
        >
          {isCurrentSlot ? renderCursor(slotId, 0) : placeholderEl}
        </span>
      );
    }

    const commaAfterIndices = computeCommaAfterIndices(slotNodes);
    const elements: React.ReactNode[] = [];
    for (let i = 0; i <= slotNodes.length; i++) {
      elements.push(renderCursor(slotId, i));
      if (i < slotNodes.length) {
        elements.push(renderNode(slotNodes[i], slotId, i, true, commaAfterIndices.has(i)));
      }
    }

    return (
      <span
        className={`inline-flex items-baseline flex-nowrap whitespace-nowrap align-baseline ${
          slotId === 'root' && align === 'right' ? 'ml-auto' : ''
        }`}
      >
        {elements}
      </span>
    );
  };

  // Render individual math node (token, value, fraction, integral, derivative, sqrt, power, postfix, logBase)
  const renderNode = (
    node: MathNode,
    parentSlotId: string,
    index: number,
    trackInSlot = true,
    appendComma = false
  ) => {
    const isPendingDelete = !readOnly && pendingDeleteTemplateId === node.id;
    const pendingDeleteClass = isPendingDelete
      ? 'border border-dashed border-[var(--ui-danger)]'
      : 'border border-transparent';
    const astAttrs = trackInSlot
      ? { 'data-ast-slot': parentSlotId, 'data-ast-index': index }
      : {};

    if (node.type === 'token') {
      return (
        <span
          key={node.id}
          {...astAttrs}
          data-token={node.val}
          className={`inline-block align-baseline px-[0.04em] tracking-wide select-none ${
            readOnly ? '' : 'cursor-pointer hover:opacity-80 transition-opacity'
          }`}
        >
          {renderTokenContent(node.val)}
          {appendComma && (
            <span aria-hidden="true" className="select-none">
              ,
            </span>
          )}
        </span>
      );
    }

    if (node.type === 'value') {
      return (
        <span
          key={node.id}
          {...astAttrs}
          data-node-type="value"
          className={`inline-block align-baseline px-[0.06em] tracking-wide select-none ${
            readOnly ? '' : 'cursor-pointer hover:opacity-80 transition-opacity'
          }`}
        >
          {formatDisplayNumberWithCommas(node.display)}
        </span>
      );
    }

    if (node.type === 'frac') {
      return (
        <span
          key={node.id}
          {...astAttrs}
          className={`inline-flex flex-col items-center justify-center align-middle mx-[0.12em] rounded px-[0.06em] leading-none ${pendingDeleteClass}`}
        >
          {/* Numerator Box */}
          <span
            data-slot-id={`${node.id}_num`}
            className="w-full flex items-baseline justify-center pb-[0.1em] border-b-[1.55px] border-current min-w-[1.15em] text-center text-[0.76em] leading-[1.1]"
          >
            {renderSlotList(node.num, `${node.id}_num`, '□')}
          </span>
          {/* Denominator Box */}
          <span
            data-slot-id={`${node.id}_den`}
            className="w-full flex items-baseline justify-center pt-[0.1em] min-w-[1.15em] text-center text-[0.76em] leading-[1.1]"
          >
            {renderSlotList(node.den, `${node.id}_den`, '□')}
          </span>
        </span>
      );
    }

    if (node.type === 'int') {
      return (
        <span
          key={node.id}
          {...astAttrs}
          data-glyph="integral"
          className={`inline-flex items-center align-middle mx-[0.14em] rounded px-[0.06em] ${pendingDeleteClass}`}
        >
          {/* Integral Symbol with Upper Limit at Top and Lower Limit at Bottom */}
          <span className="inline-flex flex-col items-center justify-center leading-none select-none mr-[0.22em]">
            <span
              data-slot-id={`${node.id}_upper`}
              className="text-[0.54em] leading-none mb-[0.08em] flex items-baseline justify-center"
            >
              {renderSlotList(node.upper, `${node.id}_upper`, '□')}
            </span>
            <span data-glyph="integral-svg" className="inline-flex items-center justify-center text-current select-none leading-none my-[0.04em]">
              <IntegralSvg className="w-[0.74em] h-[1.42em]" />
            </span>
            <span
              data-slot-id={`${node.id}_lower`}
              className="text-[0.54em] leading-none mt-[0.08em] flex items-baseline justify-center"
            >
              {renderSlotList(node.lower, `${node.id}_lower`, '□')}
            </span>
          </span>

          {/* Integrand Box */}
          <span
            data-slot-id={`${node.id}_integrand`}
            className="inline-flex items-baseline text-[0.9em] mr-[0.12em]"
          >
            {renderSlotList(node.integrand, `${node.id}_integrand`, '□')}
          </span>

          {/* Differential Token */}
          <span className="text-[0.92em] font-math-serif italic opacity-95 select-none tracking-normal">
            d{node.variable || 'x'}
          </span>
        </span>
      );
    }

    if (node.type === 'deriv') {
      const varName = node.variable || 'x';
      return (
        <span
          key={node.id}
          {...astAttrs}
          className={`inline-flex items-center align-middle mx-[0.12em] rounded px-[0.06em] ${pendingDeleteClass}`}
        >
          {/* d/dx Stacked Prefix */}
          <span className="inline-flex flex-col items-center justify-center align-middle mr-[0.14em] leading-none select-none">
            <span className="text-[0.72em] font-math-serif italic px-[0.08em] border-b-[1.4px] border-current leading-[1.1]">
              d
            </span>
            <span className="text-[0.72em] font-math-serif italic px-[0.08em] leading-[1.1]">
              d{varName}
            </span>
          </span>

          {/* Expression Box inside Parentheses */}
          <span className="inline-flex items-baseline text-[0.92em]">
            <span className="font-math-serif not-italic opacity-80 mr-[0.05em]">(</span>
            <span data-slot-id={`${node.id}_expr`} className="inline-flex items-baseline">
              {renderSlotList(node.expr, `${node.id}_expr`, '□')}
            </span>
            <span className="font-math-serif not-italic opacity-80 ml-[0.05em]">)</span>
          </span>

          {/* Evaluation Point Bar |_{x=□} */}
          <span className="inline-flex items-end ml-[0.08em] select-none">
            <span className="text-[1.15em] font-light opacity-70 leading-none">
              |
            </span>
            <span className="inline-flex items-baseline text-[0.58em] leading-none ml-[0.06em] translate-y-[0.12em]">
              <span className="font-math-serif italic mr-[0.05em] opacity-95">
                {varName}
                <span className="not-italic">=</span>
              </span>
              <span data-slot-id={`${node.id}_at`} className="inline-flex items-baseline">
                {renderSlotList(node.at, `${node.id}_at`, '□')}
              </span>
            </span>
          </span>
        </span>
      );
    }

    if (node.type === 'sqrt') {
      return (
        <span
          key={node.id}
          {...astAttrs}
          data-glyph="sqrt"
          className={`inline-flex items-stretch align-baseline mx-[0.08em] rounded ${pendingDeleteClass}`}
        >
          {/* Radical Sign */}
          <RadicalHookSvg className="w-[0.58em] self-stretch -mr-[0.02em]" />
          {/* Overbar with Radicand Content */}
          <span
            data-slot-id={`${node.id}_content`}
            className="border-t-[1.65px] border-current pt-[0.1em] pl-[0.1em] pr-[0.14em] min-w-[0.95em] inline-flex items-baseline"
          >
            {renderSlotList(node.content, `${node.id}_content`, '□')}
          </span>
        </span>
      );
    }

    if (node.type === 'power') {
      return (
        <span
          key={node.id}
          {...astAttrs}
          className={`inline-flex items-baseline align-baseline rounded ${pendingDeleteClass}`}
        >
          {/* Base (atomic relative to outer slot navigation) */}
          <span className="inline-flex items-baseline">
            {node.base.length > 0 ? (
              (() => {
                const baseCommas = computeCommaAfterIndices(node.base);
                return node.base.map((b, idx) =>
                  renderNode(b, `${node.id}_base`, idx, false, baseCommas.has(idx))
                );
              })()
            ) : (
              <span className="inline-flex items-center justify-center w-[0.95em] h-[1.05em] text-[0.88em] leading-none opacity-40">
                <HollowBoxSvg className="w-[0.68em] h-[0.68em]" />
              </span>
            )}
          </span>
          {/* Exponent Superscript Slot */}
          <span
            data-slot-id={`${node.id}_exp`}
            className="inline-flex items-baseline -translate-y-[0.42em] ml-[0.04em] text-[0.64em] min-w-[0.75em]"
          >
            {renderSlotList(node.exp, `${node.id}_exp`, '□')}
          </span>
        </span>
      );
    }

    if (node.type === 'postfix') {
      const displayOp = node.op === '⁻¹' ? '−1' : node.op;
      const isSup = ['²', '³', '⁻¹'].includes(node.op);
      const targetCommas = computeCommaAfterIndices(node.target);
      return (
        <span
          key={node.id}
          {...astAttrs}
          className={`inline-flex items-baseline align-baseline rounded ${pendingDeleteClass}`}
        >
          {/* Target Nodes (atomic relative to outer slot navigation) */}
          <span className="inline-flex items-baseline">
            {node.target.map((t, idx) =>
              renderNode(t, `${node.id}_target`, idx, false, targetCommas.has(idx))
            )}
          </span>
          {/* Postfix Operator Symbol */}
          <span
            className={`inline-block select-none font-math-serif not-italic ${
              isSup
                ? '-translate-y-[0.42em] text-[0.64em] font-semibold ml-[0.03em]'
                : 'text-[0.88em] font-semibold ml-[0.05em]'
            }`}
          >
            {displayOp}
          </span>
        </span>
      );
    }

    if (node.type === 'logBase') {
      return (
        <span
          key={node.id}
          {...astAttrs}
          className={`inline-flex items-baseline align-baseline mx-[0.08em] rounded ${pendingDeleteClass}`}
        >
          <span className="text-[0.92em] font-sans select-none mr-[0.05em]">
            log
          </span>
          {/* Subscript Base */}
          <span
            data-slot-id={`${node.id}_base`}
            className="inline-flex items-baseline text-[0.62em] translate-y-[0.22em] mr-[0.06em]"
          >
            {renderSlotList(node.base, `${node.id}_base`, '□')}
          </span>
          {/* Argument in Parentheses */}
          <span className="inline-flex items-baseline text-[0.92em]">
            <span className="font-math-serif not-italic opacity-75 mr-[0.04em]">(</span>
            <span data-slot-id={`${node.id}_arg`} className="inline-flex items-baseline">
              {renderSlotList(node.arg, `${node.id}_arg`, '□')}
            </span>
            <span className="font-math-serif not-italic opacity-75 ml-[0.04em]">)</span>
          </span>
        </span>
      );
    }

    return null;
  };

  // Hit-test cursor placement against the structured AST node tree
  const handleContainerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || deferTapCursor || !onSetCursor) return;
    e.preventDefault();
    placeCursorAtClientPoint(containerRef.current, nodes, e.clientX, e.target, onSetCursor);
  };

  const baseColorClass = inheritColor ? 'text-current' : 'text-[var(--display-text)]';

  return (
    <div
      ref={setContainerRefs}
      data-slot-id={readOnly ? undefined : 'root'}
      onPointerDown={readOnly || deferTapCursor ? undefined : handleContainerPointerDown}
      style={{
        fontSize: fontSize ? `${fontSize}px` : undefined,
        overflowX: 'auto',
        overflowY: 'hidden',
      }}
      className={`w-full whitespace-nowrap font-sans tabular-nums ${baseColorClass} flex items-center no-scrollbar tracking-wide select-none ${
        readOnly ? 'min-h-0 py-0.5' : 'cursor-text min-h-[48px] py-0.5'
      } ${className}`}
    >
      {nodes.length === 0 ? (
        <span className={`flex items-baseline ${align === 'right' ? 'ml-auto' : ''}`}>
          0{renderCursor('root', 0)}
        </span>
      ) : (
        renderSlotList(nodes, 'root')
      )}
    </div>
  );
});
