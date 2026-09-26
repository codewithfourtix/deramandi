// Small stroke icons. Only where an icon carries meaning for a reader who
// may not read well: camera, gallery, cold, verified, remove, direction.
type P = { className?: string }

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function ChevronIcon({ className = '' }: P) {
  // Points "back". Mirrors in RTL via .flip-rtl.
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className={`flip-rtl ${className}`} {...base}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

export function CameraIcon({ className = '' }: P) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" className={className} {...base}>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}

export function GalleryIcon({ className = '' }: P) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" className={className} {...base}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M3.5 16l5-5 4 4 3-3 5 5" />
      <circle cx="15.5" cy="9" r="1.5" />
    </svg>
  )
}

export function SnowIcon({ className = '' }: P) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className={className} {...base}>
      <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5" />
    </svg>
  )
}

export function CheckIcon({ className = '' }: P) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className={className} {...base} strokeWidth={2.5}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

export function CloseIcon({ className = '' }: P) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className={className} {...base} strokeWidth={2.5}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}


export function TrashIcon({ className = '' }: P) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className={className} {...base}>
      <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" />
    </svg>
  )
}

export function DocIcon({ className = '' }: P) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className={className} {...base}>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </svg>
  )
}

export function StatusIcon({ className = '' }: P) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className={className} {...base}>
      <circle cx="12" cy="12" r="8.5" strokeDasharray="4 2.2" />
      <path d="M9.5 12.5l2 2 3.5-4" />
    </svg>
  )
}

export function WhatsAppIcon({ className = '' }: P) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className={className} {...base}>
      <path d="M4.5 19.5l1.2-3.6A8 8 0 1 1 8.4 18.4z" />
      <path d="M9 9.2c.2 2.4 2.4 4.6 4.8 4.8l1.2-1.2-1.6-.8-.8.8c-.9-.3-1.6-1-1.9-1.9l.8-.8-.8-1.6z" />
    </svg>
  )
}
