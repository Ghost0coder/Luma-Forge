/**
 * LUMAFORGE — OBSIDIAN STUDIO DESIGN SYSTEM
 * Design tokens for deep charcoal/graphite surfaces, subtle layered panels,
 * precise typography, refined spacing, and subtle borders.
 */
export const OBSIDIAN = {
  bg: {
    base: '#090a0f',       // App foundation / canvas deep void
    canvas: '#0c0e14',     // Central canvas backdrop
    surface: '#11141c',    // Sidebars, toolbars
    surfaceAlt: '#161a24', // Layered cards, tool headers
    elevated: '#1c2230',   // Hover states, flyouts, popovers
    overlay: 'rgba(9, 11, 16, 0.88)', // Modal backdrops
  },
  border: {
    subtle: '#1a1f2c',    // Very soft panel boundary
    default: '#222938',   // Standard component borders
    strong: '#2e384d',    // Focused, active borders
    active: '#6366f1',    // Accent highlight border
  },
  text: {
    primary: '#f8fafc',   // Headings, active values, crisp white
    secondary: '#cbd5e1', // Subheadings, labels
    muted: '#94a3b8',     // Section headers, hotkey hints
    subtle: '#64748b',    // Micro hints, timestamps
  },
  accent: {
    primary: '#6366f1',   // Obsidian Indigo
    hover: '#4f46e5',
    active: '#4338ca',
    glow: 'rgba(99, 102, 241, 0.2)',
    amber: '#f59e0b',     // Star, warning
    emerald: '#10b981',   // Saved status, pick flag
    rose: '#f43f5e',      // Delete, reject flag, clipping
    sky: '#38bdf8',       // Focus indicator, info
  },
  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.5)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.6), 0 4px 6px -4px rgba(0, 0, 0, 0.6)',
    glow: '0 0 16px rgba(99, 102, 241, 0.15)',
  },
  transitions: {
    fast: '100ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    smooth: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;
