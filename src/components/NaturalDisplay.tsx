import React, { useEffect, useRef } from 'react';
import { MathNode, CursorPosition } from '../mathAst';

interface NaturalDisplayProps {
  nodes: MathNode[];
  cursor: CursorPosition;
  pendingDeleteTemplateId: string | null;
  onSetCursor: (slotId: string, offset: number) => void;
}

export const NaturalDisplay: React.FC<NaturalDisplayProps> = React.memo(({
  nodes,
  cursor,
  pendingDeleteTemplateId,
  onSetCursor,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to keep active cursor visible
  useEffect(() => {
    if (containerRef.current) {
      const activeCursorEl = containerRef.current.querySelector('.active-lcd-cursor');
      if (activeCursorEl) {
        activeCursorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      } else {
        containerRef.current.scrollLeft = containerRef.current.scrollWidth;
      }
    }
  }, [nodes, cursor]);

  // Render a cursor bar if this slot and offset matches active cursor
  const renderCursor = (slotId: string, offset: number) => {
    if (cursor.slotId === slotId && cursor.offset === offset) {
      return (
        <span
          key={`cur_${slotId}_${offset}`}
          className="active-lcd-cursor inline-block w-[2.5px] h-4 sm:h-5 bg-emerald-300 ml-0.5 mr-0.5 animate-pulse rounded-full shadow-[0_0_6px_rgba(52,211,153,0.8)] align-middle"
        />
      );
    }
    return null;
  };

  // Render a slot's list of nodes with intermittent cursor points
  const renderSlotList = (slotNodes: MathNode[], slotId: string, placeholder = '□') => {
    const isCurrentSlot = cursor.slotId === slotId;

    if (slotNodes.length === 0) {
      return (
        <span
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSetCursor(slotId, 0);
          }}
          className={`inline-flex items-center justify-center min-w-[18px] min-h-[18px] px-1 rounded transition-colors cursor-pointer text-xs font-mono select-none ${
            isCurrentSlot
              ? 'border border-dashed border-emerald-400 bg-emerald-950/40 text-emerald-300 shadow-[0_0_4px_rgba(52,211,153,0.3)]'
              : 'border border-dashed border-slate-600/70 bg-slate-900/30 text-slate-500 hover:border-slate-500'
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
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSetCursor(slotId, slotNodes.length);
        }}
        className="inline-flex items-center flex-wrap align-middle"
      >
        {elements}
      </span>
    );
  };

  // Render individual math node (token, fraction, integral, sqrt, power, logBase)
  const renderNode = (node: MathNode, parentSlotId: string, index: number) => {
    const isPendingDelete = pendingDeleteTemplateId === node.id;

    if (node.type === 'token') {
      return (
        <span
          key={node.id}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSetCursor(parentSlotId, index + 1);
          }}
          className="inline-block px-0.5 cursor-pointer hover:text-emerald-200 transition-colors tracking-wide select-none"
        >
          {node.val}
        </span>
      );
    }

    if (node.type === 'frac') {
      return (
        <span
          key={node.id}
          className={`inline-flex flex-col items-center justify-center align-middle mx-1 my-0.5 rounded px-0.5 transition-all ${
            isPendingDelete
              ? 'border border-dashed border-red-500 bg-red-950/30 animate-pulse'
              : 'border border-transparent'
          }`}
        >
          {/* Numerator Box */}
          <div className="w-full flex items-center justify-center pb-0.5 border-b border-emerald-400/80 min-w-[20px] text-center text-xs sm:text-sm">
            {renderSlotList(node.num, `${node.id}_num`, '□')}
          </div>
          {/* Denominator Box */}
          <div className="w-full flex items-center justify-center pt-0.5 min-w-[20px] text-center text-xs sm:text-sm">
            {renderSlotList(node.den, `${node.id}_den`, '□')}
          </div>
        </span>
      );
    }

    if (node.type === 'int') {
      return (
        <span
          key={node.id}
          style={{ verticalAlign: 'middle' }}
          className={`inline-flex items-center align-middle mx-1.5 my-0.5 rounded px-0.5 transition-all ${
            isPendingDelete
              ? 'border border-dashed border-red-500 bg-red-950/30 animate-pulse'
              : 'border border-transparent'
          }`}
        >
          {/* Integral Symbol and Limits Container */}
          <span className="inline-flex items-center relative select-none">
            {/* Lower Limit Box: bottom-left of the sign at ~70% font size */}
            <span className="text-[0.7em] leading-none self-end mb-0.5 mr-0.5 flex items-center">
              {renderSlotList(node.lower, `${node.id}_lower`, '□')}
            </span>

            {/* Tall integral sign scaled to integrand height */}
            <span className="text-2xl sm:text-3xl font-serif italic text-emerald-400 select-none leading-none px-0.5 transform scale-y-125 origin-center">
              ∫
            </span>

            {/* Upper Limit Box: top-right of the sign at ~70% font size */}
            <span className="text-[0.7em] leading-none self-start mt-0.5 ml-0.5 flex items-center">
              {renderSlotList(node.upper, `${node.id}_upper`, '□')}
            </span>
          </span>

          {/* Integrand Box: single digit-sized dashed box (no outer brackets) */}
          <span className="inline-flex items-center mx-1.5 text-xs sm:text-sm">
            {renderSlotList(node.integrand, `${node.id}_integrand`, '□')}
          </span>

          {/* dx Differential Token in italics */}
          <span className="text-xs sm:text-sm font-serif italic text-amber-300 select-none tracking-normal ml-0.5">
            dx
          </span>
        </span>
      );
    }

    if (node.type === 'sqrt') {
      return (
        <span
          key={node.id}
          className={`inline-flex items-center align-middle mx-1 transition-all ${
            isPendingDelete
              ? 'border border-dashed border-red-500 bg-red-950/30 rounded animate-pulse'
              : ''
          }`}
        >
          {/* Radical Sign */}
          <span className="text-lg sm:text-xl font-serif text-emerald-400 select-none -mr-0.5">
            √
          </span>
          {/* Overbar with Radicand Content */}
          <span className="border-t-2 border-emerald-400 pt-0.5 pl-0.5 pr-1 min-w-[18px]">
            {renderSlotList(node.content, `${node.id}_content`, '□')}
          </span>
        </span>
      );
    }

    if (node.type === 'power') {
      return (
        <span
          key={node.id}
          className={`inline-flex items-center align-middle transition-all ${
            isPendingDelete
              ? 'border border-dashed border-red-500 bg-red-950/30 rounded animate-pulse'
              : ''
          }`}
        >
          {/* Base */}
          <span className="inline-flex items-center">
            {node.base.length > 0 ? (
              node.base.map((b, idx) => renderNode(b, `${node.id}_base`, idx))
            ) : (
              <span className="text-slate-500">□</span>
            )}
          </span>
          {/* Exponent Superscript Slot */}
          <span className="inline-flex items-start align-top -mt-2 ml-0.5 text-[11px] sm:text-xs min-w-[14px]">
            {renderSlotList(node.exp, `${node.id}_exp`, '□')}
          </span>
        </span>
      );
    }

    if (node.type === 'postfix') {
      return (
        <span
          key={node.id}
          className={`inline-flex items-center align-middle transition-all ${
            isPendingDelete
              ? 'border border-dashed border-red-500 bg-red-950/30 rounded animate-pulse'
              : ''
          }`}
        >
          {/* Target Nodes */}
          <span className="inline-flex items-center">
            {node.target.map((t, idx) => renderNode(t, `${node.id}_target`, idx))}
          </span>
          {/* Postfix Operator Symbol */}
          <span
            className={`inline-block select-none ${
              ['²', '³', '⁻¹'].includes(node.op)
                ? 'align-top -mt-1.5 text-[11px] sm:text-xs font-bold text-emerald-300'
                : node.op === '!' || node.op === '%' || node.op === '°'
                ? 'text-xs sm:text-sm font-bold text-amber-300 ml-0.5'
                : 'text-xs sm:text-sm text-emerald-300'
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
          className={`inline-flex items-center align-middle mx-1 transition-all ${
            isPendingDelete
              ? 'border border-dashed border-red-500 bg-red-950/30 rounded animate-pulse'
              : ''
          }`}
        >
          <span className="text-xs sm:text-sm font-mono text-emerald-400 select-none mr-0.5">
            log
          </span>
          {/* Subscript Base */}
          <span className="text-[10px] transform translate-y-1.5 mr-0.5">
            {renderSlotList(node.base, `${node.id}_base`, '□')}
          </span>
          {/* Argument in Parentheses */}
          <span className="inline-flex items-center text-xs sm:text-sm">
            <span className="text-emerald-500 font-light mr-0.5">(</span>
            <span>{renderSlotList(node.arg, `${node.id}_arg`, '□')}</span>
            <span className="text-emerald-500 font-light ml-0.5">)</span>
          </span>
        </span>
      );
    }

    return null;
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={() => onSetCursor('root', nodes.length)}
      style={{
        overflowX: 'auto',
        overflowY: 'hidden',
        paddingTop: '1.5rem', /* Reserves clear upper margin so superscripts and upper integral bounds never overlap the status bar */
        paddingBottom: '0.25rem',
      }}
      className="flex-1 w-full whitespace-nowrap text-base sm:text-lg font-mono text-emerald-300 flex items-center no-scrollbar tracking-wide select-none cursor-text min-h-[46px]"
    >
      {nodes.length === 0 ? (
        <span className="text-emerald-700/60 flex items-center">
          0{renderCursor('root', 0)}
        </span>
      ) : (
        renderSlotList(nodes, 'root')
      )}
    </div>
  );
});
