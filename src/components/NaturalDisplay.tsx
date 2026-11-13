import React, { useEffect, useRef } from 'react';
import { MathNode, CursorPosition } from '../mathAst';

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

  // Render a slot's list of nodes with intermittent cursor points (strictly no wrapping)
  const renderSlotList = (slotNodes: MathNode[], slotId: string, placeholder = '□') => {
    const isCurrentSlot = !readOnly && cursor?.slotId === slotId;

    if (slotNodes.length === 0) {
      if (readOnly) {
        return (
          <span className="inline-flex items-center justify-center w-[0.95em] h-[1.05em] text-[0.88em] leading-none align-baseline rounded-[0.15em] border border-dashed border-current opacity-40 select-none">
            {placeholder}
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
          className={`inline-flex items-center justify-center w-[0.95em] h-[1.05em] text-[0.88em] leading-none align-baseline rounded-[0.15em] transition-colors cursor-pointer font-sans select-none ${
            isCurrentSlot
              ? 'border border-dashed border-current bg-current/15 opacity-100'
              : 'border border-dashed border-current opacity-45 hover:opacity-75'
          }`}
        >
          {isCurrentSlot ? renderCursor(slotId, 0) : placeholder}
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
      ? 'border border-dashed border-[var(--ui-danger)] bg-[var(--ui-danger)]/15 animate-pulse'
      : 'border border-transparent';

    if (node.type === 'token') {
      return (
        <span
          key={node.id}
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
          {node.val}
        </span>
      );
    }

    if (node.type === 'frac') {
      return (
        <span
          key={node.id}
          className={`inline-flex flex-col items-center justify-center align-middle mx-[0.12em] rounded px-[0.06em] transition-all leading-none ${pendingDeleteClass}`}
        >
          {/* Numerator Box */}
          <span className="w-full flex items-baseline justify-center pb-[0.1em] border-b-[1.5px] border-current min-w-[1.15em] text-center text-[0.76em] leading-[1.1]">
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
          className={`inline-flex items-center align-middle mx-[0.14em] rounded px-[0.06em] transition-all ${pendingDeleteClass}`}
        >
          {/* Integral Symbol with Upper Limit at Top and Lower Limit at Bottom */}
          <span className="inline-flex flex-col items-center justify-center leading-none select-none mr-[0.16em]">
            <span className="text-[0.54em] leading-none mb-[0.08em] flex items-baseline justify-center">
              {renderSlotList(node.upper, `${node.id}_upper`, '□')}
            </span>
            <span className="text-[1.28em] italic text-current select-none leading-[0.88]">
              ∫
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
          <span className="text-[0.88em] italic opacity-90 select-none tracking-normal">
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
          className={`inline-flex items-center align-middle mx-[0.12em] rounded px-[0.06em] transition-all ${pendingDeleteClass}`}
        >
          {/* d/dx Stacked Prefix */}
          <span className="inline-flex flex-col items-center justify-center align-middle mr-[0.14em] leading-none select-none">
            <span className="text-[0.68em] italic px-[0.08em] border-b border-current leading-[1.1]">
              d
            </span>
            <span className="text-[0.68em] italic px-[0.08em] leading-[1.1]">
              d{varName}
            </span>
          </span>

          {/* Expression Box inside Parentheses */}
          <span className="inline-flex items-baseline text-[0.92em]">
            <span className="opacity-80 mr-[0.05em]">(</span>
            {renderSlotList(node.expr, `${node.id}_expr`, '□')}
            <span className="opacity-80 ml-[0.05em]">)</span>
          </span>

          {/* Evaluation Point Bar |_{x=□} */}
          <span className="inline-flex items-end ml-[0.08em] select-none">
            <span className="text-[1.15em] font-light opacity-70 leading-none">
              |
            </span>
            <span className="inline-flex items-baseline text-[0.58em] leading-none ml-[0.06em] translate-y-[0.12em]">
              <span className="italic mr-[0.05em] opacity-90">{varName}=</span>
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
          className={`inline-flex items-baseline align-baseline mx-[0.08em] rounded transition-all ${pendingDeleteClass}`}
        >
          {/* Radical Sign */}
          <span className="text-[1.08em] leading-none select-none -mr-[0.04em]">
            √
          </span>
          {/* Overbar with Radicand Content */}
          <span className="border-t-[1.5px] border-current pt-[0.08em] pl-[0.1em] pr-[0.14em] min-w-[0.95em] inline-flex items-baseline">
            {renderSlotList(node.content, `${node.id}_content`, '□')}
          </span>
        </span>
      );
    }

    if (node.type === 'power') {
      return (
        <span
          key={node.id}
          className={`inline-flex items-baseline align-baseline rounded transition-all ${pendingDeleteClass}`}
        >
          {/* Base */}
          <span className="inline-flex items-baseline">
            {node.base.length > 0 ? (
              node.base.map((b, idx) => renderNode(b, `${node.id}_base`, idx))
            ) : (
              <span className="inline-flex items-center justify-center w-[0.95em] h-[1.05em] text-[0.88em] leading-none opacity-40">
                □
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
      return (
        <span
          key={node.id}
          className={`inline-flex items-baseline align-baseline rounded transition-all ${pendingDeleteClass}`}
        >
          {/* Target Nodes */}
          <span className="inline-flex items-baseline">
            {node.target.map((t, idx) => renderNode(t, `${node.id}_target`, idx))}
          </span>
          {/* Postfix Operator Symbol */}
          <span
            className={`inline-block select-none ${
              ['²', '³', '⁻¹'].includes(node.op)
                ? '-translate-y-[0.42em] text-[0.64em] font-bold ml-[0.03em]'
                : 'text-[0.88em] font-semibold ml-[0.05em]'
            }`}
          >
            {node.op}
          </span>
        </span>
      );
    }

    if (node.type === 'logBase') {
      return (
        <span
          key={node.id}
          className={`inline-flex items-baseline align-baseline mx-[0.08em] rounded transition-all ${pendingDeleteClass}`}
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
            <span className="opacity-75 mr-[0.04em]">(</span>
            {renderSlotList(node.arg, `${node.id}_arg`, '□')}
            <span className="opacity-75 ml-[0.04em]">)</span>
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
