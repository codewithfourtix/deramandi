import type { CropId } from '../types'

// Hand-drawn crop marks so a farmer can find their crop without reading.
export function CropGlyph({ crop, className = '' }: { crop: CropId; className?: string }) {
  const common = {
    viewBox: '0 0 48 48',
    width: 44,
    height: 44,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  }

  switch (crop) {
    case 'dhakki_dates':
      // A small bunch: three plump dates hanging from a strand.
      return (
        <svg {...common}>
          <path d="M24 5c0 6-2 9-6 12M24 5c0 6 2 9 6 12M24 5v13" />
          <ellipse cx="16.5" cy="27" rx="5" ry="8" transform="rotate(12 16.5 27)" />
          <ellipse cx="31.5" cy="27" rx="5" ry="8" transform="rotate(-12 31.5 27)" />
          <ellipse cx="24" cy="33" rx="5.2" ry="8.5" />
          <path d="M22.5 28c.4-1.6 1.4-2.6 2.8-3" />
        </svg>
      )
    case 'kulachi_melon':
      // Long oval melon with rib lines, stem and a leaf.
      return (
        <svg {...common}>
          <ellipse cx="24" cy="28" rx="18" ry="12" />
          <path d="M14 18.5c-3 6-3 13 0 19M24 16v24M34 18.5c3 6 3 13 0 19" />
          <path d="M24 16c0-3 .8-5.5 2.5-7" />
          <path d="M26.5 9c3.5-2 7.5-1.5 9.5 1-3.5 2-7 2-9.5-1z" />
        </svg>
      )
    case 'wheat':
      // An ear of wheat.
      return (
        <svg {...common}>
          <path d="M24 44V12" />
          <path d="M24 14c-4-1-6-4-6-8 4 1 6 4 6 8zM24 14c4-1 6-4 6-8-4 1-6 4-6 8z" />
          <path d="M24 22c-4-1-6-4-6-8 4 1 6 4 6 8zM24 22c4-1 6-4 6-8-4 1-6 4-6 8z" />
          <path d="M24 30c-4-1-6-4-6-8 4 1 6 4 6 8zM24 30c4-1 6-4 6-8-4 1-6 4-6 8z" />
        </svg>
      )
    case 'sugarcane':
      // Two jointed stalks with a leaf.
      return (
        <svg {...common}>
          <path d="M18 44L21 6M29 44l-2-38" />
          <path d="M16.8 34h5M17.8 22h5M19 11h4.2M26 34h5M26.6 22h4.4M26.4 11h4" />
          <path d="M21 16c6-2 11 0 16 6" />
        </svg>
      )
    default:
      // A tied jute sack for anything else.
      return (
        <svg {...common}>
          <path d="M17 12h14M18 12c-7 7-9 16-7 24 1 4 5 6 13 6s12-2 13-6c2-8 0-17-7-24" />
          <path d="M20 12l-2-6h12l-2 6" />
          <path d="M19 28h10" />
        </svg>
      )
  }
}
