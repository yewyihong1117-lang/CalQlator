import React, { useEffect, useRef } from 'react';
import { MathNode, CursorPosition } from '../mathAst';

interface NaturalDisplayProps {
  nodes: MathNode[];
  cursor: CursorPosition;
  pendingDeleteTemplateId: string | null;
  onSetCursor: (slotId: string, offset: number) => void;
}

export const NaturalDisplay: React.FC<NaturalDisplayProps> = ({
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
          onClick={(e) => {
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
        onClick={(e) => {
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
          onClick={(e) => {
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
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            position: 'relative',
            lineHeight: 'normal',
          }}
          className={`align-middle mx-1.5 my-0.5 rounded px-0.5 transition-all ${
            isPendingDelete
              ? 'border border-dashed border-red-500 bg-red-950/30 animate-pulse'
              : 'border border-transparent'
          }`}
        >
          {/* Integral Symbol and Limits Container */}
          <span className="inline-flex items-center relative mr-1 select-none">
            {/* The integral symbol ∫ scaled vertically to span the integrand */}
            <span className="text-2xl sm:text-3xl font-serif italic text-emerald-400 leading-none mr-1 select-none transform scale-y-115">
              ∫
            </span>

            {/* Dedicated 2-row vertical stack to the right of the integral sign */}
            <span
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                fontSize: '0.65em',
                minHeight: '36px',
              }}
              className="py-0.5"
            >
              {/* Upper Limit Box */}
              <span className="leading-none mb-1 flex items-center">
                {renderSlotList(node.upper, `${node.id}_upper`, '□')}
              </span>
              {/* Lower Limit Box */}
              <span className="leading-none mt-1 flex items-center">
                {renderSlotList(node.lower, `${node.id}_lower`, '□')}
              </span>
            </span>
          </span>

          {/* Integrand Box in Parentheses with explicit horizontal margins */}
          <span
            style={{ marginLeft: '2px', marginRight: '4px' }}
            className="inline-flex items-center text-sm sm:text-base"
          >
            <span className="text-emerald-500 font-light select-none mr-0.5">(</span>
            <span className="px-0.5">{renderSlotList(node.integrand, `${node.id}_integrand`, '□')}</span>
            <span className="text-emerald-500 font-light select-none ml-0.5">)</span>
          </span>

          {/* dx Differential Token with explicit spacing */}
          <span
            style={{ marginLeft: '2px' }}
            className="text-xs sm:text-sm font-serif italic text-amber-300 select-none tracking-normal"
          >
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
          className={`inline-flex items-start align-top -mt-2 ml-0.5 transition-all text-[11px] sm:text-xs ${
            isPendingDelete
              ? 'border border-dashed border-red-500 bg-red-950/30 rounded animate-pulse'
              : ''
          }`}
        >
          <span className="min-w-[14px]">
            {renderSlotList(node.exp, `${node.id}_exp`, '□')}
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
      onClick={() => onSetCursor('root', nodes.length)}
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
};
