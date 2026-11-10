import { contrast, ensureContrast, hexToOklch, isHex, onColor, oklchToHex } from './color.js'
import { harmony, type Scheme } from './harmony.js'

/**
 * A theme is a few named colors, saved as plain JSON with hex values, so it can be imported, exported and
 * read without this package. Everything else (scales, light and dark tokens, Payload's admin colors) is
 * worked out from it, and the contrast report says whether the result is readable.
 */
export type ThemeColors = {
  primary: string
  secondary?: string
  accent?: string
  /** The color grays are tinted toward (often the brand's darkest color). */
  neutral: string
  success?: string
  warning?: string
  error?: string
}
export type Theme = {
  format: 'color-theory/1'
  name: string
  colors: ThemeColors
  /** How it was made, if from a harmony (kept so the editor can reopen it). */
  harmony?: { scheme: Scheme; base: keyof ThemeColors }
  /** Corner radii in px. */
  radius?: { md?: number; lg?: number }
}

export const DEFAULT_STATUS = { success: '#2f855a', warning: '#b7791f', error: '#c53030' }

/** Payload-style scale: 21 steps, 0 (lightest) to 1000 (darkest), hue kept, chroma highest in the middle. */
export const STEPS = Array.from({ length: 21 }, (_, i) => i * 50)
export function scale(hex: string, opts: { maxChroma?: number } = {}): Record<number, string> {
  const base = hexToOklch(hex)
  const out: Record<number, string> = {}
  for (const step of STEPS) {
    const t = step / 1000
    const l = 0.985 - t * (0.985 - 0.13)
    const bell = Math.sin(Math.PI * Math.min(1, Math.max(0, (l - 0.1) / 0.9)))
    const c = Math.min(base.c, opts.maxChroma ?? Infinity) * (0.35 + 0.65 * bell)
    out[step] = oklchToHex({ l, c, h: base.h })
  }
  return out
}

/** Fill in what a theme leaves out: secondary and accent from its harmony (or split-complementary), status colors from defaults. */
export function completeColors(t: Theme): Required<ThemeColors> {
  const c = t.colors
  const wheel = harmony(c.primary, t.harmony?.scheme && t.harmony.scheme !== 'monochromatic' ? t.harmony.scheme : 'split-complementary')
  return {
    primary: c.primary,
    secondary: c.secondary ?? wheel[1] ?? c.primary,
    accent: c.accent ?? wheel[2] ?? wheel[1] ?? c.primary,
    neutral: c.neutral,
    success: c.success ?? DEFAULT_STATUS.success,
    warning: c.warning ?? DEFAULT_STATUS.warning,
    error: c.error ?? DEFAULT_STATUS.error,
  }
}

export type Tokens = Record<string, string>

/**
 * The site's `--palette-*` tokens for light and dark. Colors that carry text are nudged until they pass
 * WCAG AA (4.5:1 for text, 3:1 for large UI like buttons and focus rings); the brand hue is always kept.
 */
export function tokens(t: Theme): { light: Tokens; dark: Tokens } {
  const c = completeColors(t)
  const n = scale(c.neutral, { maxChroma: 0.03 })
  const radius = { md: `${t.radius?.md ?? 8}px`, lg: `${t.radius?.lg ?? 14}px` }
  const mode = (surface: string, raised: string, sunken: string, text: string, muted: string, border: string, borderSoft: string, dark: boolean): Tokens => {
    const strong = (hex: string) => ensureContrast(hex, surface, 3)
    const readable = (hex: string) => ensureContrast(hex, surface, 4.5)
    const soft = (hex: string) => oklchToHex({ ...hexToOklch(hex), l: dark ? 0.3 : 0.95, c: Math.min(hexToOklch(hex).c, dark ? 0.06 : 0.04) })
    const out: Tokens = {
      '--palette-surface': surface,
      '--palette-surface-raised': raised,
      '--palette-surface-sunken': sunken,
      '--palette-text': text,
      '--palette-text-muted': readable(muted),
      '--palette-border': border,
      '--palette-border-soft': borderSoft,
      '--palette-radius-md': radius.md,
      '--palette-radius-lg': radius.lg,
    }
    for (const role of ['primary', 'secondary', 'accent', 'success', 'warning', 'error'] as const) {
      // A fill stands out from the page (3:1), and its text reads on it (4.5:1). A mid-tone where neither white
      // nor black text reaches 4.5 is moved, lightness only, away from its text color until it does.
      let fill = strong(c[role])
      const on = onColor(fill)
      if (contrast(on, fill) < 4.5) fill = ensureContrast(fill, on, 4.5)
      out[`--palette-${role}`] = fill
      out[`--palette-on-${role}`] = on
      out[`--palette-${role}-text`] = readable(c[role])
      out[`--palette-${role}-soft`] = soft(c[role])
    }
    out['--palette-surface-hover'] = out['--palette-primary-soft']!
    out['--palette-focus'] = out['--palette-primary']!
    out['--palette-link'] = out['--palette-primary-text']!
    return out
  }
  return {
    light: mode(n[50]!, n[0]!, n[100]!, n[900]!, n[650]!, n[200]!, n[100]!, false),
    dark: mode(n[950]!, n[900]!, n[1000]!, n[50]!, n[350]!, n[750]!, n[850]!, true),
  }
}

/**
 * Payload's admin colors, the way Payload itself is themed: its `--color-base-*` scale (the admin's grays,
 * flipped by Payload for dark mode) and the success, warning and error scales.
 */
export function payloadAdminVariables(t: Theme): Tokens {
  const c = completeColors(t)
  const out: Tokens = {}
  const put = (name: string, sc: Record<number, string>) => {
    for (const step of STEPS) out[`--color-${name}-${step}`] = sc[step]!
  }
  put('base', scale(c.neutral, { maxChroma: 0.025 }))
  put('success', scale(c.success))
  put('warning', scale(c.warning))
  put('error', scale(c.error))
  return out
}

export type ContrastCheck = { mode: 'light' | 'dark'; pair: string; ratio: number; min: number; pass: boolean }

/** Every text and UI pair the theme produces, with its contrast ratio against WCAG AA. */
export function contrastReport(t: Theme): ContrastCheck[] {
  const out: ContrastCheck[] = []
  const tk = tokens(t)
  for (const mode of ['light', 'dark'] as const) {
    const v = tk[mode]
    const pairs: [string, string, string, number][] = [
      ['Text on the page', '--palette-text', '--palette-surface', 4.5],
      ['Text on cards', '--palette-text', '--palette-surface-raised', 4.5],
      ['Muted text on the page', '--palette-text-muted', '--palette-surface', 4.5],
      ['Links on the page', '--palette-link', '--palette-surface', 4.5],
      ['Primary buttons', '--palette-on-primary', '--palette-primary', 4.5],
      ['Secondary buttons', '--palette-on-secondary', '--palette-secondary', 4.5],
      ['Accent fills', '--palette-on-accent', '--palette-accent', 4.5],
      ['Primary against the page (UI)', '--palette-primary', '--palette-surface', 3],
      ['Focus ring', '--palette-focus', '--palette-surface', 3],
      ['Error text', '--palette-error-text', '--palette-surface', 4.5],
    ]
    for (const [pair, fg, bg, min] of pairs) {
      const ratio = Math.round(contrast(v[fg]!, v[bg]!) * 100) / 100
      out.push({ mode, pair, ratio, min, pass: ratio >= min })
    }
  }
  return out
}

/** CSS for a theme: light tokens on `:root`, dark ones under the dark selector, plus the admin's variables if asked. */
export function themeCss(t: Theme, opts: { selector?: string; darkSelector?: string; admin?: boolean } = {}): string {
  const tk = tokens(t)
  const block = (sel: string, v: Tokens) => `${sel} {\n${Object.entries(v).map(([k, x]) => `  ${k}: ${x};`).join('\n')}\n}`
  return [block(opts.selector ?? ':root', tk.light), block(opts.darkSelector ?? "[data-theme='dark']", tk.dark), ...(opts.admin ? [block(':root', payloadAdminVariables(t))] : [])].join('\n')
}

/** Reads a theme from JSON (a string or parsed), strictly: hex colors only, known fields only. */
export function parseTheme(input: unknown): { theme: Theme | null; problems: string[] } {
  const problems: string[] = []
  let v: unknown = input
  if (typeof input === 'string') {
    try {
      v = JSON.parse(input)
    } catch {
      return { theme: null, problems: ['That isn’t JSON.'] }
    }
  }
  if (!v || typeof v !== 'object') return { theme: null, problems: ['A theme is an object with a name and colors.'] }
  const o = v as Record<string, unknown>
  if (o.format !== undefined && o.format !== 'color-theory/1') problems.push(`Unknown format "${String(o.format)}"; expected "color-theory/1".`)
  const name = typeof o.name === 'string' ? o.name.trim().slice(0, 80) : ''
  if (!name) problems.push('The theme needs a name.')
  const colors = (o.colors && typeof o.colors === 'object' ? o.colors : {}) as Record<string, unknown>
  const known = ['primary', 'secondary', 'accent', 'neutral', 'success', 'warning', 'error']
  for (const k of Object.keys(colors)) if (!known.includes(k)) problems.push(`Unknown color "${k}".`)
  for (const k of ['primary', 'neutral']) if (!isHex(colors[k])) problems.push(`"${k}" needs a hex color like #cf8137.`)
  for (const k of ['secondary', 'accent', 'success', 'warning', 'error']) if (colors[k] !== undefined && !isHex(colors[k])) problems.push(`"${k}" isn't a hex color.`)
  const scheme = (o.harmony as { scheme?: unknown } | undefined)?.scheme
  if (scheme !== undefined && !['monochromatic', 'analogous', 'complementary', 'split-complementary', 'triadic', 'tetradic', 'square'].includes(String(scheme))) problems.push(`Unknown harmony "${String(scheme)}".`)
  const radius = o.radius as { md?: unknown; lg?: unknown } | undefined
  for (const k of ['md', 'lg'] as const) if (radius?.[k] !== undefined && !(typeof radius[k] === 'number' && radius[k]! >= 0 && radius[k]! <= 64)) problems.push(`Radius "${k}" must be a number of pixels from 0 to 64.`)
  if (problems.length) return { theme: null, problems }
  const norm = (h: unknown) => (typeof h === 'string' ? (h.trim().startsWith('#') ? h.trim() : `#${h.trim()}`).toLowerCase() : undefined)
  const theme: Theme = {
    format: 'color-theory/1',
    name,
    colors: Object.fromEntries(Object.entries(colors).map(([k, h]) => [k, norm(h)])) as unknown as ThemeColors,
    ...(o.harmony ? { harmony: o.harmony as Theme['harmony'] } : {}),
    ...(radius ? { radius: radius as Theme['radius'] } : {}),
  }
  return { theme, problems: [] }
}

/** The theme as JSON to save or share. */
export const exportTheme = (t: Theme) => JSON.stringify({ ...t, format: 'color-theory/1' }, null, 2)

/** A theme built from one color and a harmony: the harmony gives secondary and accent. */
export function themeFromHarmony(name: string, base: string, scheme: Scheme, neutral?: string): Theme {
  const wheel = harmony(base, scheme)
  return {
    format: 'color-theory/1',
    name,
    colors: { primary: base.toLowerCase(), secondary: wheel[1], accent: wheel[2] ?? wheel[1], neutral: neutral ?? oklchToHex({ ...hexToOklch(base), l: 0.25, c: 0.03 }) },
    harmony: { scheme, base: 'primary' },
  }
}
