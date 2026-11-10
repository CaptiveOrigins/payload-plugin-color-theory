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
/** How strongly the brand colors show across the site, from Off to Bold. */
export const INTENSITY_LEVELS = ['off', 'subtle', 'balanced', 'bold'] as const
export type IntensityLevel = (typeof INTENSITY_LEVELS)[number]
export const INTENSITY_LABELS: Record<IntensityLevel, string> = { off: 'Off', subtle: 'Subtle', balanced: 'Balanced', bold: 'Bold' }

/**
 * The kinds of element that can carry the brand colors, and the level each one switches on at. Higher levels
 * put the brand on more of what's on screen: Off none, Subtle 1 of 5, Balanced 3 of 5, Bold all 5.
 */
export const BRAND_GROUPS = [
  { id: 'buttons', label: 'Button fills', hint: 'Main buttons in the primary color, or in plain dark text color.', from: 'subtle' },
  { id: 'header', label: 'Header', hint: 'A dark brand bar with a primary-color rule, or a plain header.', from: 'balanced' },
  { id: 'badges', label: 'Badge colors', hint: 'Badges tinted by meaning, or plain gray.', from: 'balanced' },
  { id: 'bands', label: 'Card bands', hint: 'A thin primary-to-secondary band across the top of cards.', from: 'bold' },
  { id: 'washes', label: 'Intro washes', hint: 'A soft brand wash behind page intros.', from: 'bold' },
] as const satisfies readonly { id: string; label: string; hint: string; from: IntensityLevel }[]
export type BrandGroup = (typeof BRAND_GROUPS)[number]['id']

export type Theme = {
  format: 'color-theory/1'
  name: string
  colors: ThemeColors
  /**
   * `adjust` (default): colors that carry text are moved, lightness only, until they pass WCAG AA.
   * `exact`: the chosen colors are used as they are, and the contrast report says what falls short.
   */
  accessibility?: 'adjust' | 'exact'
  /** Brand intensity: one level for the theme, and optional on/off overrides per kind of element. Default Bold. */
  intensity?: { level?: IntensityLevel; groups?: Partial<Record<BrandGroup, 'on' | 'off'>> }
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

/** Which kinds of element carry the brand colors, from the level and any overrides. */
export function brandGroups(t: Theme): Record<BrandGroup, boolean> {
  const level = INTENSITY_LEVELS.indexOf(t.intensity?.level ?? 'bold')
  return Object.fromEntries(
    BRAND_GROUPS.map((g) => {
      const o = t.intensity?.groups?.[g.id]
      return [g.id, o ? o === 'on' : level >= INTENSITY_LEVELS.indexOf(g.from)]
    }),
  ) as Record<BrandGroup, boolean>
}

/**
 * The site's `--palette-*` tokens for light and dark. Colors that carry text are nudged until they pass
 * WCAG AA (4.5:1 for text, 3:1 for large UI like buttons and focus rings); the brand hue is always kept.
 */
export function tokens(t: Theme): { light: Tokens; dark: Tokens } {
  const c = completeColors(t)
  const n = scale(c.neutral, { maxChroma: 0.03 })
  const deep = scale(c.neutral, { maxChroma: 0.06 })
  const fix = t.accessibility !== 'exact'
  const on = brandGroups(t)
  const radius = { md: `${t.radius?.md ?? 8}px`, lg: `${t.radius?.lg ?? 14}px` }
  const mode = (surface: string, raised: string, sunken: string, text: string, muted: string, border: string, borderSoft: string, dark: boolean): Tokens => {
    // Text and fills must work on every surface they can sit on: the page, cards and sunken areas.
    const surfaces = [surface, raised, sunken]
    const against = (hex: string, ratio: number) => {
      let out = hex
      for (let pass = 0; pass < 3; pass++) for (const bg of surfaces) out = ensureContrast(out, bg, ratio)
      return out
    }
    // Neutral-derived colors (muted text, the header) are always adjusted: they're worked out, not chosen.
    // The role colors someone picked are adjusted only in `adjust` mode.
    const strong = (hex: string) => (fix ? against(hex, 3) : hex)
    const readable = (hex: string) => against(hex, 4.5)
    const roleReadable = (hex: string) => (fix ? readable(hex) : hex)
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
      const ink = onColor(fill)
      if (fix && contrast(ink, fill) < 4.5) fill = ensureContrast(fill, ink, 4.5)
      out[`--palette-${role}`] = fill
      out[`--palette-on-${role}`] = ink
      // Role text sits on the page, cards, sunken areas and its own soft fill (badges, notices): readable on all.
      const softFill = soft(c[role])
      let text = roleReadable(c[role])
      if (fix) for (let pass = 0; pass < 3; pass++) text = ensureContrast(against(text, 4.5), softFill, 4.5)
      out[`--palette-${role}-text`] = text
      out[`--palette-${role}-soft`] = softFill
    }
    out['--palette-surface-hover'] = out['--palette-primary-soft']!
    out['--palette-focus'] = out['--palette-primary']!
    out['--palette-link'] = out['--palette-primary-text']!

    // Brand intensity: each kind of element takes the brand colors or plain ones.
    out['--palette-button'] = on.buttons ? out['--palette-primary']! : text
    out['--palette-on-button'] = on.buttons ? out['--palette-on-primary']! : raised
    const headerBg = dark ? deep[850]! : deep[800]!
    out['--palette-header'] = on.header ? headerBg : surface
    out['--palette-on-header'] = on.header ? ensureContrast(dark ? n[50]! : n[0]!, headerBg, 4.5) : text
    out['--palette-header-rule'] = on.header ? out['--palette-primary']! : border
    for (const role of ['primary', 'secondary', 'accent'] as const) {
      out[`--palette-badge-${role}`] = on.badges ? out[`--palette-${role}-soft`]! : sunken
      out[`--palette-on-badge-${role}`] = on.badges ? out[`--palette-${role}-text`]! : out['--palette-text-muted']!
    }
    out['--palette-band'] = on.bands ? `linear-gradient(90deg, ${out['--palette-primary']}, ${out['--palette-secondary']})` : 'transparent'
    out['--palette-wash'] = on.washes ? `linear-gradient(135deg, ${out['--palette-primary-soft']}, ${out['--palette-secondary-soft']})` : surface
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

/** One text or UI pair the theme produces. `role` is the chosen color it depends on, if any. */
export type ContrastPair = { id: string; label: string; fg: string; bg: string; min: 3 | 4.5; role?: keyof ThemeColors; variant?: 'fill' | 'text' }

export const CONTRAST_PAIRS: ContrastPair[] = [
  { id: 'text-page', label: 'Text on the page', fg: '--palette-text', bg: '--palette-surface', min: 4.5 },
  { id: 'text-cards', label: 'Text on cards', fg: '--palette-text', bg: '--palette-surface-raised', min: 4.5 },
  { id: 'muted-page', label: 'Muted text on the page', fg: '--palette-text-muted', bg: '--palette-surface', min: 4.5 },
  { id: 'muted-cards', label: 'Muted text on cards', fg: '--palette-text-muted', bg: '--palette-surface-raised', min: 4.5 },
  { id: 'header', label: 'Header text', fg: '--palette-on-header', bg: '--palette-header', min: 4.5 },
  { id: 'links-page', label: 'Links on the page', fg: '--palette-link', bg: '--palette-surface', min: 4.5, role: 'primary', variant: 'text' },
  { id: 'links-cards', label: 'Links on cards', fg: '--palette-link', bg: '--palette-surface-raised', min: 4.5, role: 'primary', variant: 'text' },
  { id: 'button', label: 'Main buttons', fg: '--palette-on-button', bg: '--palette-button', min: 4.5 },
  { id: 'primary-fill', label: 'Primary fills', fg: '--palette-on-primary', bg: '--palette-primary', min: 4.5, role: 'primary', variant: 'fill' },
  { id: 'secondary-fill', label: 'Secondary fills', fg: '--palette-on-secondary', bg: '--palette-secondary', min: 4.5, role: 'secondary', variant: 'fill' },
  { id: 'accent-fill', label: 'Accent fills', fg: '--palette-on-accent', bg: '--palette-accent', min: 4.5, role: 'accent', variant: 'fill' },
  { id: 'secondary-outline', label: 'Secondary button text', fg: '--palette-secondary-text', bg: '--palette-surface', min: 4.5, role: 'secondary', variant: 'text' },
  { id: 'primary-ui', label: 'Primary against the page (UI)', fg: '--palette-primary', bg: '--palette-surface', min: 3, role: 'primary', variant: 'fill' },
  { id: 'focus', label: 'Focus ring', fg: '--palette-focus', bg: '--palette-surface', min: 3, role: 'primary', variant: 'fill' },
  { id: 'field-border', label: 'Form field border', fg: '--palette-text-muted', bg: '--palette-surface-raised', min: 3 },
  { id: 'badge-primary', label: 'Primary badge', fg: '--palette-on-badge-primary', bg: '--palette-badge-primary', min: 4.5, role: 'primary', variant: 'text' },
  { id: 'badge-secondary', label: 'Secondary badge', fg: '--palette-on-badge-secondary', bg: '--palette-badge-secondary', min: 4.5, role: 'secondary', variant: 'text' },
  { id: 'badge-accent', label: 'Accent badge', fg: '--palette-on-badge-accent', bg: '--palette-badge-accent', min: 4.5, role: 'accent', variant: 'text' },
  { id: 'error-text', label: 'Error text', fg: '--palette-error-text', bg: '--palette-surface', min: 4.5, role: 'error', variant: 'text' },
  { id: 'success-badge', label: 'Success badge', fg: '--palette-success-text', bg: '--palette-success-soft', min: 4.5, role: 'success', variant: 'text' },
  { id: 'warning-badge', label: 'Warning badge', fg: '--palette-warning-text', bg: '--palette-warning-soft', min: 4.5, role: 'warning', variant: 'text' },
  { id: 'error-badge', label: 'Error alert', fg: '--palette-error-text', bg: '--palette-error-soft', min: 4.5, role: 'error', variant: 'text' },
]

export type ContrastCheck = {
  id: string
  mode: 'light' | 'dark'
  pair: string
  ratio: number
  min: number
  pass: boolean
  /** WCAG AAA: 7:1 for text, 4.5:1 for large text and UI. */
  aaa: boolean
  role?: keyof ThemeColors
  /** For a failing pair: the nearest color for `role` that passes it (lightness only), if there is one. */
  suggest?: string
}

/** Every text and UI pair the theme produces, with its contrast ratio against WCAG AA, and a fix for each failure. */
export function contrastReport(t: Theme): ContrastCheck[] {
  const out: ContrastCheck[] = []
  const tk = tokens(t)
  const c = completeColors(t)
  for (const mode of ['light', 'dark'] as const) {
    const v = tk[mode]
    for (const p of CONTRAST_PAIRS) {
      const ratio = Math.round(contrast(v[p.fg]!, v[p.bg]!) * 100) / 100
      const pass = ratio >= p.min
      const check: ContrastCheck = { id: p.id, mode, pair: p.label, ratio, min: p.min, pass, aaa: ratio >= (p.min === 3 ? 4.5 : 7), ...(p.role ? { role: p.role } : {}) }
      if (!pass && p.role) {
        const s = suggestFor(t, c[p.role], p, mode)
        if (s) check.suggest = s
      }
      out.push(check)
    }
  }
  return out
}

/** The nearest color (lightness only) that makes one pair pass in one mode, checked by rebuilding the tokens. */
function suggestFor(t: Theme, start: string, p: ContrastPair, mode: 'light' | 'dark'): string | undefined {
  let hex = start
  for (let pass = 0; pass < 4; pass++) {
    const v = tokens({ ...t, colors: { ...t.colors, [p.role!]: hex } })[mode]
    if (contrast(v[p.fg]!, v[p.bg]!) >= p.min) return hex === start ? undefined : hex
    // Text moves away from its background; a fill moves away from the text drawn on it.
    hex = p.variant === 'fill' ? ensureContrast(hex, v[p.fg]!, p.min + 0.05) : ensureContrast(hex, v[p.bg]!, p.min + 0.05)
  }
  return undefined
}

/**
 * CSS for a theme: light tokens on `:root`, dark ones under the dark selector, and, unless `auto` is off,
 * dark ones again when the device prefers dark and no light choice is set (`[data-theme='light']` opts out).
 * With `admin`, Payload's admin variables too (Payload flips them for its own dark mode).
 */
export function themeCss(t: Theme, opts: { selector?: string; darkSelector?: string; lightSelector?: string; admin?: boolean; auto?: boolean } = {}): string {
  const tk = tokens(t)
  const block = (sel: string, v: Tokens, indent = '') => `${indent}${sel} {\n${Object.entries(v).map(([k, x]) => `${indent}  ${k}: ${x};`).join('\n')}\n${indent}}`
  const root = opts.selector ?? ':root'
  const light = opts.lightSelector ?? "[data-theme='light']"
  return [
    block(root, tk.light),
    block(opts.darkSelector ?? "[data-theme='dark']", tk.dark),
    ...(opts.auto === false ? [] : [`@media (prefers-color-scheme: dark) {\n${block(`${root}:not(${light})`, tk.dark, '  ')}\n}`]),
    ...(opts.admin ? [block(':root', payloadAdminVariables(t))] : []),
  ].join('\n')
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
  if (o.accessibility !== undefined && o.accessibility !== 'adjust' && o.accessibility !== 'exact') problems.push('"accessibility" is "adjust" or "exact".')
  const intensity = o.intensity as { level?: unknown; groups?: Record<string, unknown> } | undefined
  if (intensity !== undefined) {
    if (!intensity || typeof intensity !== 'object') problems.push('"intensity" is an object with a level and optional groups.')
    else {
      if (intensity.level !== undefined && !INTENSITY_LEVELS.includes(intensity.level as IntensityLevel)) problems.push(`Unknown intensity level "${String(intensity.level)}"; use ${INTENSITY_LEVELS.join(', ')}.`)
      for (const [k, x] of Object.entries(intensity.groups ?? {})) {
        if (!BRAND_GROUPS.some((g) => g.id === k)) problems.push(`Unknown intensity group "${k}".`)
        else if (x !== 'on' && x !== 'off') problems.push(`Intensity group "${k}" is "on" or "off".`)
      }
    }
  }
  if (problems.length) return { theme: null, problems }
  const norm = (h: unknown) => (typeof h === 'string' ? (h.trim().startsWith('#') ? h.trim() : `#${h.trim()}`).toLowerCase() : undefined)
  const theme: Theme = {
    format: 'color-theory/1',
    name,
    colors: Object.fromEntries(Object.entries(colors).map(([k, h]) => [k, norm(h)])) as unknown as ThemeColors,
    ...(o.harmony ? { harmony: o.harmony as Theme['harmony'] } : {}),
    ...(radius ? { radius: radius as Theme['radius'] } : {}),
    ...(o.accessibility ? { accessibility: o.accessibility as Theme['accessibility'] } : {}),
    ...(intensity ? { intensity: { ...(intensity.level ? { level: intensity.level as IntensityLevel } : {}), ...(intensity.groups && Object.keys(intensity.groups).length ? { groups: intensity.groups as NonNullable<Theme['intensity']>['groups'] } : {}) } } : {}),
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
