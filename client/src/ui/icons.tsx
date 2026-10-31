import type { ReactNode } from 'react'

/**
 * Znakovi dizajn sistema (mreža 14×14, linija u boji teksta).
 * Status uvek ima svoj znak, da radi i bez boje (štampa, daltonizam).
 */
const ICONS = {
  check: { width: 1.8, body: <path d="M2.5 7.4 5.4 10.3 11.5 4" /> },
  checkBold: { width: 2.2, body: <path d="M2.8 7.3 5.5 10 11.2 4.2" /> },
  warn: {
    width: 1.5,
    body: (
      <>
        <path d="M7 2.2 12.6 11.6H1.4z" />
        <path d="M7 5.9v2.3" />
        <path d="M7 10.1h.01" />
      </>
    ),
  },
  xCircle: {
    width: 1.6,
    body: (
      <>
        <circle cx="7" cy="7" r="5.2" />
        <path d="M5 5l4 4M9 5l-4 4" />
      </>
    ),
  },
  minusCircle: {
    width: 1.6,
    body: (
      <>
        <circle cx="7" cy="7" r="5.2" />
        <path d="M4.6 7h4.8" />
      </>
    ),
  },
  progress: {
    width: 1.6,
    body: (
      <>
        <circle cx="7" cy="7" r="5.2" />
        <path d="M7 1.8a5.2 5.2 0 0 1 0 10.4z" fill="currentColor" stroke="none" />
      </>
    ),
  },
  test: {
    width: 1.6,
    body: (
      <>
        <circle cx="7" cy="7" r="5.2" strokeDasharray="2.2 2.2" />
        <path d="M7 4.5v3.1M7 9.7h.01" />
      </>
    ),
  },
  clock: {
    width: 1.7,
    body: (
      <>
        <circle cx="7" cy="7" r="5.2" />
        <path d="M7 4.2V7l2 1.4" />
      </>
    ),
  },
  lock: {
    width: 1.6,
    body: (
      <>
        <rect x="3" y="6.3" width="8" height="5.5" rx="1.2" />
        <path d="M4.9 6.3V4.9a2.1 2.1 0 0 1 4.2 0v1.4" />
      </>
    ),
  },
  cancel: {
    width: 1.6,
    body: (
      <>
        <circle cx="7" cy="7" r="5.2" />
        <path d="M3.6 10.4 10.4 3.6" />
      </>
    ),
  },
  flag: { width: 1.6, body: <path d="M3.6 12V2.3h7L9 5l1.6 2.7h-7" /> },
  dot: { width: 0, body: <circle cx="7" cy="7" r="3" fill="currentColor" stroke="none" /> },
  doc: {
    width: 1.5,
    body: (
      <>
        <path d="M4 1.8h4.2L11 4.7V12.2H4z" />
        <path d="M8.2 1.8v3H11" />
      </>
    ),
  },
  forward: {
    width: 1.6,
    body: (
      <>
        <circle cx="7" cy="7" r="5.2" />
        <path d="M4.8 7h4.4M7.6 5.2 9.4 7l-1.8 1.8" />
      </>
    ),
  },
  back: {
    width: 1.6,
    body: (
      <>
        <circle cx="7" cy="7" r="5.2" />
        <path d="M9.2 7H4.8M6.6 5.2 4.8 7l1.8 1.8" />
      </>
    ),
  },
  pay: {
    width: 1.6,
    body: (
      <>
        <circle cx="7" cy="7" r="5.2" />
        <path d="M7 9.4V4.8M5.2 6.6 7 4.8l1.8 1.8" />
      </>
    ),
  },
  planned: { width: 1.6, body: <circle cx="7" cy="7" r="5.2" strokeDasharray="2.4 2.4" /> },
  critical: {
    width: 1.6,
    body: (
      <>
        <rect x="2.2" y="2.2" width="9.6" height="9.6" rx="1.6" />
        <path d="M7 4.6v3.1M7 9.8h.01" />
      </>
    ),
  },
  info: {
    width: 1.6,
    body: (
      <>
        <circle cx="7" cy="7" r="5.2" />
        <path d="M7 6.4v3.4M7 4.3h.01" />
      </>
    ),
  },
  alert: {
    width: 1.6,
    body: (
      <>
        <circle cx="7" cy="7" r="5.2" />
        <path d="M7 4.3v3.2M7 9.9h.01" />
      </>
    ),
  },
  download: { width: 1.6, body: <path d="M7 2v7M4.4 6.6 7 9.2l2.6-2.6M2.6 11.6h8.8" /> },
  upload: { width: 1.6, body: <path d="M7 9.4V2.4M4.4 5 7 2.4 9.6 5M2.6 11.6h8.8" /> },
  home: {
    width: 1.5,
    body: (
      <>
        <path d="M2.2 6.3 7 2.5l4.8 3.8V11.5H2.2z" />
        <path d="M5.6 11.5V8.1h2.8v3.4" />
      </>
    ),
  },
  bell: {
    width: 1.5,
    body: (
      <>
        <path d="M3.3 6.1a3.7 3.7 0 0 1 7.4 0v2.3l1 1.7H2.3l1-1.7z" />
        <path d="M5.7 11.4h2.6" />
      </>
    ),
  },
  search: {
    width: 1.6,
    body: (
      <>
        <circle cx="6.2" cy="6.2" r="3.9" />
        <path d="M9.1 9.1 11.8 11.8" />
      </>
    ),
  },
  close: { width: 2, body: <path d="M4 4l6 6M10 4l-6 6" /> },
  chevronDown: { width: 1.7, body: <path d="M3.4 5.4 7 9l3.6-3.6" /> },
  chevronLeft: { width: 1.7, body: <path d="M8.6 3.4 5 7l3.6 3.6" /> },
  chevronRight: { width: 1.7, body: <path d="M5.4 3.4 9 7l-3.6 3.6" /> },
  eye: {
    width: 1.6,
    body: (
      <>
        <path d="M1.6 7s2-3.6 5.4-3.6S12.4 7 12.4 7s-2 3.6-5.4 3.6S1.6 7 1.6 7z" />
        <circle cx="7" cy="7" r="1.5" />
      </>
    ),
  },
  eyeOff: {
    width: 1.6,
    body: (
      <>
        <path d="M1.6 7s2-3.6 5.4-3.6S12.4 7 12.4 7s-2 3.6-5.4 3.6S1.6 7 1.6 7z" />
        <path d="M2 12 12 2" />
      </>
    ),
  },
  plug: {
    width: 1.5,
    body: (
      <>
        <path d="M1.6 5.2h10.8" />
        <path d="M3.4 5.2V8a3.6 3.6 0 0 0 7.2 0V5.2" />
        <path d="M7 11.6v.8" />
        <path d="M4.6 2.2v3M9.4 2.2v3" />
      </>
    ),
  },
  empty: {
    width: 1.4,
    body: (
      <>
        <path d="M2.4 3.6h9.2v7.2H2.4z" />
        <path d="M2.4 6.2h9.2M5.6 6.2v4.6" />
      </>
    ),
  },
  safe: {
    width: 1.6,
    body: (
      <>
        <rect x="2" y="4.4" width="10" height="7.2" rx="1.4" />
        <path d="M4.6 4.4V3.2a2.4 2.4 0 0 1 4.8 0v1.2" />
      </>
    ),
  },
  gate: {
    width: 1.6,
    body: (
      <>
        <path d="M2 11.6V5.6l5-3.2 5 3.2v6" />
        <path d="M5.6 11.6V7.8h2.8v3.8" />
      </>
    ),
  },
  logout: {
    width: 1.5,
    body: (
      <>
        <path d="M5.6 2.4H3.2a.8.8 0 0 0-.8.8v7.6a.8.8 0 0 0 .8.8h2.4" />
        <path d="M8.6 4.4 11.2 7 8.6 9.6M11.2 7H5.4" />
      </>
    ),
  },
  plus: { width: 1.7, body: <path d="M7 2.8v8.4M2.8 7h8.4" /> },
  settings: {
    width: 1.5,
    body: (
      <>
        <path d="M2.4 4.2h1M6.6 4.2h5M2.4 9.8h5M10.6 9.8h1" />
        <circle cx="5" cy="4.2" r="1.6" />
        <circle cx="9" cy="9.8" r="1.6" />
      </>
    ),
  },
  sun: {
    width: 1.5,
    body: (
      <>
        <circle cx="7" cy="7" r="2.4" />
        <path d="M7 1.6v1.2M7 11.2v1.2M1.6 7h1.2M11.2 7h1.2M3.2 3.2l.85.85M9.95 9.95l.85.85M3.2 10.8l.85-.85M9.95 4.05l.85-.85" />
      </>
    ),
  },
  moon: { width: 1.5, body: <path d="M11.6 8.6A4.8 4.8 0 1 1 5.4 2.4a3.8 3.8 0 0 0 6.2 6.2z" /> },
  users: {
    width: 1.5,
    body: (
      <>
        <circle cx="5.2" cy="4.8" r="2" />
        <path d="M1.8 11.6a3.4 3.4 0 0 1 6.8 0" />
        <circle cx="10" cy="5.4" r="1.6" />
        <path d="M9.6 8.4a2.8 2.8 0 0 1 2.8 3.2" />
      </>
    ),
  },
  user: {
    width: 1.5,
    body: (
      <>
        <circle cx="7" cy="4.8" r="2.3" />
        <path d="M2.8 12a4.2 4.2 0 0 1 8.4 0" />
      </>
    ),
  },
  building: {
    width: 1.5,
    body: (
      <>
        <path d="M2.6 12.2V3.2l5-1.4v10.4" />
        <path d="M7.6 5.2h3.8v7" />
        <path d="M1.4 12.2h11.2" />
        <path d="M4.6 5.2h1M4.6 7.4h1M4.6 9.6h1M9.2 7.4h.8M9.2 9.6h.8" />
      </>
    ),
  },
  grid: {
    width: 1.5,
    body: (
      <>
        <rect x="2" y="2" width="4" height="4" rx="0.8" />
        <rect x="8" y="2" width="4" height="4" rx="0.8" />
        <rect x="2" y="8" width="4" height="4" rx="0.8" />
        <rect x="8" y="8" width="4" height="4" rx="0.8" />
      </>
    ),
  },
  folder: { width: 1.5, body: <path d="M1.8 4.2a1 1 0 0 1 1-1h2.6l1.2 1.4h4.6a1 1 0 0 1 1 1v5.6a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1z" /> },
  inbox: {
    width: 1.5,
    body: (
      <>
        <path d="M1.8 8h3l.8 1.6h2.8L9.2 8h3" />
        <path d="M3.2 2.6h7.6l1.4 5.4v3.2a.8.8 0 0 1-.8.8H2.6a.8.8 0 0 1-.8-.8V8z" />
      </>
    ),
  },
  tasks: {
    width: 1.5,
    body: (
      <>
        <path d="M5.8 3.6h6M5.8 7h6M5.8 10.4h6" />
        <path d="M1.8 3.6l.8.8 1.4-1.6M1.8 7l.8.8 1.4-1.6M2 10.4h1.8" />
      </>
    ),
  },
  scale: {
    width: 1.5,
    body: (
      <>
        <path d="M7 2v10M4.2 12h5.6M3 4h8" />
        <path d="M3 4 1.4 7.6a1.6 1.6 0 0 0 3.2 0z" />
        <path d="M11 4 9.4 7.6a1.6 1.6 0 0 0 3.2 0z" />
      </>
    ),
  },
  shield: {
    width: 1.5,
    body: (
      <>
        <path d="M7 1.8 11.6 3.6v3.6c0 2.6-2 4.4-4.6 5-2.6-.6-4.6-2.4-4.6-5V3.6z" />
        <path d="M5 7.1l1.4 1.4L9.2 5.7" />
      </>
    ),
  },
  calculator: {
    width: 1.5,
    body: (
      <>
        <rect x="2.6" y="1.8" width="8.8" height="10.4" rx="1.2" />
        <path d="M4.6 4.2h4.8" />
        <path d="M4.8 7.2h.01M7 7.2h.01M9.2 7.2h.01M4.8 9.6h.01M7 9.6h.01M9.2 9.6h.01" />
      </>
    ),
  },
  crane: {
    width: 1.5,
    body: (
      <>
        <path d="M3.4 12.4V2.2l8.2 2.2M3.4 4h7.8M9.6 4.2v2.6" />
        <path d="M8.8 6.8h1.6v1.4H8.8z" />
        <path d="M1.6 12.4h3.6" />
      </>
    ),
  },
  chat: { width: 1.5, body: <path d="M2 3.4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v5.4a1 1 0 0 1-1 1H6.2L3.4 12v-2.2H3a1 1 0 0 1-1-1z" /> },
  menu: { width: 1.6, body: <path d="M2.2 3.8h9.6M2.2 7h9.6M2.2 10.2h9.6" /> },
  edit: {
    width: 1.5,
    body: (
      <>
        <path d="M9.2 2.6l2.2 2.2-6.6 6.6H2.6V9.2z" />
        <path d="M8 3.8 10.2 6" />
      </>
    ),
  },
  trash: {
    width: 1.5,
    body: (
      <>
        <path d="M2.6 3.8h8.8M5.4 3.8V2.6h3.2v1.2" />
        <path d="M3.8 3.8l.6 8h5.2l.6-8" />
      </>
    ),
  },
  sidebar: {
    width: 1.5,
    body: (
      <>
        <rect x="1.8" y="2.2" width="10.4" height="9.6" rx="1.2" />
        <path d="M5.4 2.2v9.6" />
      </>
    ),
  },
  monitor: {
    width: 1.5,
    body: (
      <>
        <rect x="1.8" y="2.4" width="10.4" height="7" rx="1.2" />
        <path d="M5 11.8h4M7 9.4v2.4" />
      </>
    ),
  },
} as const satisfies Record<string, { width: number; body: ReactNode }>

export type IconName = keyof typeof ICONS

export function Icon({ name, size = 14, className }: { name: IconName; size?: number; className?: string }) {
  const icon = ICONS[name]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={icon.width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {icon.body}
    </svg>
  )
}

/** Zauzeto dugme: krug koji se okreće, a dugme čuva svoju širinu. */
export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      className="spinner"
    >
      <circle cx="7" cy="7" r="5.2" strokeOpacity={0.3} />
      <path d="M7 1.8a5.2 5.2 0 0 1 5.2 5.2" />
    </svg>
  )
}
