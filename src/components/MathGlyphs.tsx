import React from 'react';

interface GlyphProps {
  className?: string;
}

/** Smooth S-curve integral symbol matching reference keycap and display identically */
export const IntegralSvg: React.FC<GlyphProps> = ({ className = 'w-[0.68em] h-[1.3em]' }) => (
  <svg
    viewBox="0 0 14 26"
    fill="currentColor"
    aria-hidden="true"
    className={`inline-block shrink-0 align-middle ${className}`}
  >
    <path d="M10.45 2.05c1.18 0 1.98.66 1.98 1.54 0 .64-.46 1.12-1.08 1.12-.52 0-.95-.34-1.02-.82-.05-.34-.22-.55-.52-.55-.84 0-1.36 1.44-1.76 4.78l-.96 8.24c-.52 4.34-1.56 7.59-3.68 7.59-1.18 0-1.98-.66-1.98-1.54 0-.64.46-1.12 1.08-1.12.52 0 .95.34 1.02.82.05.34.22.55.52.55.84 0 1.38-1.44 1.78-4.78l.96-8.24C7.31 5.3 8.33 2.05 10.45 2.05Z" />
  </svg>
);

/** Uniform-stroke serif-proportioned uppercase Sigma */
export const SigmaSvg: React.FC<GlyphProps> = ({ className = 'w-[1em] h-[1.12em]' }) => (
  <svg
    viewBox="0 0 14 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={`inline-block shrink-0 align-baseline ${className}`}
  >
    <path d="M11.4 3.4V2.1H2.3L7.5 8L2.3 13.9H11.4V12.5" />
  </svg>
);

/** Outlined hollow placeholder box □ */
export const HollowBoxSvg: React.FC<GlyphProps> = ({ className = 'w-[0.78em] h-[0.78em]' }) => (
  <svg
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.35"
    aria-hidden="true"
    className={`inline-block shrink-0 align-baseline ${className}`}
  >
    <rect x="1.25" y="1.25" width="9.5" height="9.5" rx="1.2" />
  </svg>
);

/** Solid filled placeholder box ■ */
export const SolidBoxSvg: React.FC<GlyphProps> = ({ className = 'w-[0.78em] h-[0.78em]' }) => (
  <svg
    viewBox="0 0 12 12"
    fill="currentColor"
    aria-hidden="true"
    className={`inline-block shrink-0 align-baseline ${className}`}
  >
    <rect x="1.15" y="1.15" width="9.7" height="9.7" rx="1.2" />
  </svg>
);

/** Fraction key icon ■/□ matching reference key */
export const FractionKeySvg: React.FC<GlyphProps> = ({ className = 'w-[2em] h-[1.1em]' }) => (
  <svg
    viewBox="0 0 28 16"
    fill="none"
    aria-hidden="true"
    className={`inline-block shrink-0 align-middle ${className}`}
  >
    <rect x="1.5" y="3.5" width="8.2" height="8.2" rx="1.1" fill="currentColor" />
    <path
      d="M15.8 2.2L11.4 13.8"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
    />
    <rect
      x="17.8"
      y="3.8"
      width="8.2"
      height="8.2"
      rx="1.1"
      stroke="currentColor"
      strokeWidth="1.45"
    />
  </svg>
);

/** Radical hook SVG paired with NaturalDisplay overbar */
export const RadicalHookSvg: React.FC<GlyphProps> = ({ className = 'w-[0.62em] h-[1.12em]' }) => (
  <svg
    viewBox="0 0 12 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
    vectorEffect="non-scaling-stroke"
    preserveAspectRatio="none"
    aria-hidden="true"
    className={`inline-block shrink-0 ${className}`}
  >
    <path d="M1.1 11.4 L2.9 10.3 L5.6 18.4 L10.7 0.82 H12" />
  </svg>
);

/** Square root key icon √■ */
export const SqrtKeySvg: React.FC<GlyphProps> = ({ className = 'w-[1.85em] h-[1.15em]' }) => (
  <svg
    viewBox="0 0 26 17"
    fill="none"
    aria-hidden="true"
    className={`inline-block shrink-0 align-middle ${className}`}
  >
    <path
      d="M1.4 10.2 L3.1 9.2 L5.7 15.2 L10.5 2.0 H24.5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect x="13.2" y="5.6" width="8.4" height="8.4" rx="1.1" fill="currentColor" />
  </svg>
);

/** Cube root shift label icon ³√■ */
export const CubeRootShiftSvg: React.FC<GlyphProps> = ({ className = 'w-[2.25em] h-[1.25em]' }) => (
  <svg
    viewBox="0 0 28 17"
    fill="none"
    aria-hidden="true"
    className={`inline-block shrink-0 align-baseline ${className}`}
  >
    <text
      x="1.2"
      y="7.4"
      fill="currentColor"
      fontSize="7.4"
      fontFamily='"Times New Roman", Tinos, "Liberation Serif", Times, serif'
      fontWeight="700"
    >
      3
    </text>
    <path
      d="M4.2 10.3 L5.8 9.4 L8.1 15.0 L12.5 2.2 H26.2"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect x="15.0" y="5.7" width="8.2" height="8.2" rx="1.0" fill="currentColor" />
  </svg>
);

/** Nth root shift label icon ■√■ (hollow index box + radical + solid box) */
export const NthRootShiftSvg: React.FC<GlyphProps> = ({ className = 'w-[2.35em] h-[1.25em]' }) => (
  <svg
    viewBox="0 0 29 17"
    fill="none"
    aria-hidden="true"
    className={`inline-block shrink-0 align-baseline ${className}`}
  >
    <rect
      x="1.0"
      y="1.8"
      width="5.2"
      height="5.2"
      rx="0.8"
      stroke="currentColor"
      strokeWidth="1.25"
    />
    <path
      d="M4.8 10.3 L6.4 9.4 L8.7 15.0 L13.1 2.2 H27.0"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect x="15.6" y="5.7" width="8.2" height="8.2" rx="1.0" fill="currentColor" />
  </svg>
);

/** Crisp horizontal double-headed arrow ⇔ for S⇔D and a b/c⇔d/c */
export const DoubleArrowSvg: React.FC<GlyphProps> = ({ className = 'w-[1.05em] h-[0.72em]' }) => (
  <svg
    viewBox="0 0 18 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={`inline-block shrink-0 align-middle ${className}`}
  >
    <path d="M2.6 6 H15.4 M5.5 2.7 L2.1 6 L5.5 9.3 M12.5 2.7 L15.9 6 L12.5 9.3" />
  </svg>
);

/** Uniform-stroke arithmetic operator SVGs (+, −, ×, ÷, =) */
export const OperatorSvg: React.FC<{
  op: '+' | '−' | '×' | '÷' | '=';
  className?: string;
}> = ({ op, className = 'w-[1em] h-[1em]' }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    className={`inline-block shrink-0 align-middle ${className}`}
  >
    {op === '+' && (
      <path
        d="M10 4.5 V15.5 M4.5 10 H15.5"
        stroke="currentColor"
        strokeWidth="2.05"
        strokeLinecap="round"
      />
    )}
    {op === '−' && (
      <path
        d="M4.5 10 H15.5"
        stroke="currentColor"
        strokeWidth="2.05"
        strokeLinecap="round"
      />
    )}
    {op === '×' && (
      <path
        d="M5.6 5.6 L14.4 14.4 M14.4 5.6 L5.6 14.4"
        stroke="currentColor"
        strokeWidth="2.05"
        strokeLinecap="round"
      />
    )}
    {op === '÷' && (
      <>
        <path
          d="M4.2 10 H15.8"
          stroke="currentColor"
          strokeWidth="2.05"
          strokeLinecap="round"
        />
        <circle cx="10" cy="5.5" r="1.38" fill="currentColor" />
        <circle cx="10" cy="14.5" r="1.38" fill="currentColor" />
      </>
    )}
    {op === '=' && (
      <path
        d="M4.5 7.4 H15.5 M4.5 12.6 H15.5"
        stroke="currentColor"
        strokeWidth="2.05"
        strokeLinecap="round"
      />
    )}
  </svg>
);

/** D-pad uniform-stroke open chevron glyphs */
export const DpadArrowSvg: React.FC<{
  direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
  className?: string;
}> = ({ direction, className = 'w-4 h-4' }) => {
  const rotation =
    direction === 'UP'
      ? '0'
      : direction === 'RIGHT'
      ? '90'
      : direction === 'DOWN'
      ? '180'
      : '270';

  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M3.6 10.2 L8 5.8 L12.4 10.2"
        transform={`rotate(${rotation} 8 8)`}
      />
    </svg>
  );
};

/** 8-tooth outline gear icon for display header */
export const HeaderGearSvg: React.FC<GlyphProps> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
);

/** Clean geometric ▲▼ scroll indicators for display header */
export const HeaderScrollArrowsSvg: React.FC<GlyphProps> = ({ className = 'w-[18px] h-[9px]' }) => (
  <svg
    viewBox="0 0 20 10"
    fill="currentColor"
    aria-hidden="true"
    className={`inline-block shrink-0 ${className}`}
  >
    <polygon points="4.6,1.6 8.3,8.2 0.9,8.2" />
    <polygon points="15.4,8.4 11.7,1.8 19.1,1.8" />
  </svg>
);
