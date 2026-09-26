import { useId } from 'react'
import { GRADE_COLOR } from '../lib/format'
import type { Grade } from '../types'

interface Props {
  grade: Grade
  size?: number
  animate?: boolean
  /** Paper disc behind the ink, for when the stamp sits on a busy photo. */
  backing?: boolean
  className?: string
}

/*
  The grade mark, drawn like the inked rubber stamp on a mandi crate.
  Bilingual ring on purpose, the way official stamps in Pakistan carry both
  scripts. Decorative for screen readers: the grade is always stated in text.
*/
export function GradeStamp({ grade, size = 168, animate = false, backing = false, className = '' }: Props) {
  const uid = useId().replace(/:/g, '')
  const color = GRADE_COLOR[grade]

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      aria-hidden="true"
      className={`${animate ? 'stamp-in' : 'stamp-rest'} ${className}`}
      style={{ color }}
    >
      <defs>
        <filter id={`ink-${uid}`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="7" result="grain" />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.6" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves="2" seed="4" result="blot" />
          <feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -6 0 0 0 4.6" result="holes" />
          <feComposite in="rough" in2="holes" operator="in" />
        </filter>
        <path id={`top-${uid}`} d="M 26 100 A 74 74 0 0 1 174 100" />
        <path id={`bottom-${uid}`} d="M 20 100 A 80 80 0 0 0 180 100" />
      </defs>

      {backing && <circle cx="100" cy="100" r="98" fill="var(--color-paper)" opacity="0.92" />}
      <g filter={`url(#ink-${uid})`} fill="currentColor" stroke="currentColor">
        <circle cx="100" cy="100" r="94" fill="none" strokeWidth="5" />
        <circle cx="100" cy="100" r="62" fill="none" strokeWidth="2.5" />

        <text fontFamily="Archivo Variable, sans-serif" fontSize="14" fontWeight="800" letterSpacing="2" stroke="none" style={{ fontStretch: '125%' }}>
          <textPath href={`#top-${uid}`} startOffset="50%" textAnchor="middle">
            DERA MANDI GRADE
          </textPath>
        </text>
        <text fontFamily="Noto Nastaliq Urdu, serif" fontSize="15" fontWeight="700" stroke="none" direction="rtl">
          <textPath href={`#bottom-${uid}`} startOffset="50%" textAnchor="middle">
            ڈیرہ منڈی درجہ
          </textPath>
        </text>

        <path d="M 14 100 l 6 -5 l 6 5 l -6 5 z M 174 100 l 6 -5 l 6 5 l -6 5 z" stroke="none" />

        <text
          x="100"
          y="100"
          dy="0.35em"
          textAnchor="middle"
          fontFamily="Archivo Variable, sans-serif"
          fontSize="92"
          fontWeight="900"
          stroke="none"
          style={{ fontStretch: '125%' }}
        >
          {grade}
        </text>
      </g>
    </svg>
  )
}
