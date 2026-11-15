import React, { useEffect, useRef } from 'react';
import { MathNode, CursorPosition } from '../mathAst';
import { IntegralSvg, RadicalHookSvg, HollowBoxSvg, OperatorSvg, SigmaSvg } from './MathGlyphs';

interface NaturalDisplayProps {
  nodes: MathNode[];
  cursor?: CursorPosition;
  pendingDeleteTemplateId?: string | null;
  onSetCursor?: (slotId: string, offset: number) => void;
  fontSize?: number;
  readOnly?: boolean;
  inheritColor?: boolean;
  className?: string;
}

export const NaturalDisplay: React.FC<NaturalDisplayProps> = React.memo(({
  nodes,
  cursor,
  pendingDeleteTemplateId = null,
  onSetCursor,
  fontSize,
  readOnly = false,
  inheritColor = false,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll horizontally only inside the display expression container to keep active cursor visible
  useEffect(() => {
    if (readOnly) return;
    const container = containerRef.current;
    if (!container) return;

    const activeCursorEl = container.querySelector('.active-lcd-cursor') as HTMLElement | null;
    if (activeCursorEl) {
      const cRect = container.getBoundingClientRect();
      const kRect = activeCursorEl.getBoundingClientRect();
      const pad = 16;
      if (kRect.left < cRect.left + pad) {
        container.scrollLeft -= cRect.left + pad - kRect.left;
      } else if (kRect.right > cRect.right - pad) {
        container.scrollLeft += kRect.right - (cRect.right - pad);
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
          className="active-lcd-cursor inline-block w-[2px] h-[1.1em] bg-current mx-[1px] animate-pulse rounded-full align-baseline"
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
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSetCursor?.(slotId, 0);
          }}
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

    const elements: React.ReactNode[] = [];
    for (let i = 0; i <= slotNodes.length; i++) {
      elements.push(renderCursor(slotId, i));
      if (i < slotNodes.length) {
        elements.push(renderNode(slotNodes[i], slotId, i));
      }
    }

    return (
      <span
        onPointerDown={
          readOnly
            ? undefined
            : (e) => {
                e.preventDefault();
                e.stopPropagation();
                onSetCursor?.(slotId, slotNodes.length);
              }
        }
        className="inline-flex items-baseline flex-nowrap whitespace-nowrap align-baseline"
      >
        {elements}
      </span>
    );
  };

  // Render individual math node (token, fraction, integral, derivative, sqrt, power, postfix, logBase)
  const renderNode = (node: MathNode, parentSlotId: string, index: number) => {
    const isPendingDelete = !readOnly && pendingDeleteTemplateId === node.id;
    const pendingDeleteClass = isPendingDelete
      ? 'border border-dashed border-[var(--ui-danger)]'
      : 'border border-transparent';

    if (node.type === 'token') {
      return (
        <span
          key={node.id}
          data-token={node.val}
          onPointerDown={
            readOnly
              ? undefined
              : (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSetCursor?.(parentSlotId, index + 1);
                }
          }
          className={`inline-block align-baseline px-[0.04em] tracking-wide select-none ${
            readOnly ? '' : 'cursor-pointer hover:opacity-80 transition-opacity'
          }`}
        >
          {renderTokenContent(node.val)}
        </span>
      );
    }

    if (node.type === 'frac') {
      return (
        <span
          key={node.id}
          className={`inline-flex flex-col items-center justify-center align-middle mx-[0.12em] rounded px-[0.06em] leading-none ${pendingDeleteClass}`}
        >
          {/* Numerator Box */}
          <span className="w-full flex items-baseline justify-center pb-[0.1em] border-b-[1.55px] border-current min-w-[1.15em] text-center text-[0.76em] leading-[1.1]">
            {renderSlotList(node.num, `${node.id}_num`, '□')}
          </span>
          {/* Denominator Box */}
          <span className="w-full flex items-baseline justify-center pt-[0.1em] min-w-[1.15em] text-center text-[0.76em] leading-[1.1]">
            {renderSlotList(node.den, `${node.id}_den`, '□')}
          </span>
        </span>
      );
    }

    if (node.type === 'int') {
      return (
        <span
          key={node.id}
          data-glyph="integral"
          className={`inline-flex items-center align-middle mx-[0.14em] rounded px-[0.06em] ${pendingDeleteClass}`}
        >
          {/* Integral Symbol with Upper Limit at Top and Lower Limit at Bottom */}
          <span className="inline-flex flex-col items-center justify-center leading-none select-none mr-[0.22em]">
            <span className="text-[0.54em] leading-none mb-[0.08em] flex items-baseline justify-center">
              {renderSlotList(node.upper, `${node.id}_upper`, '□')}
            </span>
            <span data-glyph="integral-svg" className="inline-flex items-center justify-center text-current select-none leading-none my-[0.04em]">
              <IntegralSvg className="w-[0.74em] h-[1.42em]" />
            </span>
            <span className="text-[0.54em] leading-none mt-[0.08em] flex items-baseline justify-center">
              {renderSlotList(node.lower, `${node.id}_lower`, '□')}
            </span>
          </span>

          {/* Integrand Box */}
          <span className="inline-flex items-baseline text-[0.9em] mr-[0.12em]">
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
            {renderSlotList(node.expr, `${node.id}_expr`, '□')}
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
              {renderSlotList(node.at, `${node.id}_at`, '□')}
            </span>
          </span>
        </span>
      );
    }

    if (node.type === 'sqrt') {
      return (
        <span
          key={node.id}
          data-glyph="sqrt"
          className={`inline-flex items-stretch align-baseline mx-[0.08em] rounded ${pendingDeleteClass}`}
        >
          {/* Radical Sign */}
          <RadicalHookSvg className="w-[0.58em] self-stretch -mr-[0.02em]" />
          {/* Overbar with Radicand Content */}
          <span className="border-t-[1.65px] border-current pt-[0.1em] pl-[0.1em] pr-[0.14em] min-w-[0.95em] inline-flex items-baseline">
            {renderSlotList(node.content, `${node.id}_content`, '□')}
          </span>
        </span>
      );
    }

    if (node.type === 'power') {
      return (
        <span
          key={node.id}
          className={`inline-flex items-baseline align-baseline rounded ${pendingDeleteClass}`}
        >
          {/* Base */}
          <span className="inline-flex items-baseline">
            {node.base.length > 0 ? (
              node.base.map((b, idx) => renderNode(b, `${node.id}_base`, idx))
            ) : (
              <span className="inline-flex items-center justify-center w-[0.95em] h-[1.05em] text-[0.88em] leading-none opacity-40">
                <HollowBoxSvg className="w-[0.68em] h-[0.68em]" />
              </span>
            )}
          </span>
          {/* Exponent Superscript Slot */}
          <span className="inline-flex items-baseline -translate-y-[0.42em] ml-[0.04em] text-[0.64em] min-w-[0.75em]">
            {renderSlotList(node.exp, `${node.id}_exp`, '□')}
          </span>
        </span>
      );
    }

    if (node.type === 'postfix') {
      const displayOp = node.op === '⁻¹' ? '−1' : node.op;
      const isSup = ['²', '³', '⁻¹'].includes(node.op);
      return (
        <span
          key={node.id}
          className={`inline-flex items-baseline align-baseline rounded ${pendingDeleteClass}`}
        >
          {/* Target Nodes */}
          <span className="inline-flex items-baseline">
            {node.target.map((t, idx) => renderNode(t, `${node.id}_target`, idx))}
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
          className={`inline-flex items-baseline align-baseline mx-[0.08em] rounded ${pendingDeleteClass}`}
        >
          <span className="text-[0.92em] font-sans select-none mr-[0.05em]">
            log
          </span>
          {/* Subscript Base */}
          <span className="inline-flex items-baseline text-[0.62em] translate-y-[0.22em] mr-[0.06em]">
            {renderSlotList(node.base, `${node.id}_base`, '□')}
          </span>
          {/* Argument in Parentheses */}
          <span className="inline-flex items-baseline text-[0.92em]">
            <span className="font-math-serif not-italic opacity-75 mr-[0.04em]">(</span>
            {renderSlotList(node.arg, `${node.id}_arg`, '□')}
            <span className="font-math-serif not-italic opacity-75 ml-[0.04em]">)</span>
          </span>
        </span>
      );
    }

    return null;
  };

  const baseColorClass = inheritColor ? 'text-current' : 'text-[var(--display-text)]';

  return (
    <div
      ref={containerRef}
      onPointerDown={readOnly ? undefined : () => onSetCursor?.('root', nodes.length)}
      style={{
        fontSize: fontSize ? `${fontSize}px` : undefined,
        overflowX: 'auto',
        overflowY: 'hidden',
      }}
      className={`w-full whitespace-nowrap font-sans tabular-nums ${baseColorClass} flex items-baseline no-scrollbar tracking-wide select-none ${
        readOnly ? 'min-h-0 py-0.5' : 'cursor-text min-h-[40px] py-1'
      } ${className}`}
    >
      {nodes.length === 0 ? (
        <span className="opacity-40 flex items-baseline">
          0{renderCursor('root', 0)}
        </span>
      ) : (
        renderSlotList(nodes, 'root')
      )}
    </div>
  );
});
