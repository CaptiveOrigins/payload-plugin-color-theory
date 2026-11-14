import { describe, expect, it } from 'vitest'

import { BRAND_GROUPS, brandGroups, completeColors, contrast, contrastReport, ensureContrast, exportTheme, harmony, hexToOklch, hexToRgb, hueDistance, oklchToHex, parseTheme, payloadAdminVariables, PRESETS, rgbToHex, scale, SCHEMES, STEPS, themeCss, themeFromHarmony, tokens, INTENSITY_LEVELS, type Theme } from '../src/core/index.js'

describe('color math', () => {
  it('round-trips hex through OKLCH, and reads 3-digit hex', () => {
    for (const hex of ['#cf8137', '#e48185', '#3b2a26', '#000000', '#ffffff', '#1f8a8a']) expect(oklchToHex(hexToOklch(hex))).toBe(hex)
    expect(rgbToHex(hexToRgb('#fa0'))).toBe('#ffaa00')
    expect(() => hexToRgb('orange')).toThrow(/Not a hex color/)
  })

  it('gives WCAG contrast: 21 for black on white, about 4.5 for a known AA pair', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#777777', '#ffffff')).toBeLessThan(4.5)
  })

  it('nudges a brand color until it passes contrast, keeping its hue', () => {
    const orange = '#cf8137'
    expect(contrast(orange, '#ffffff')).toBeLessThan(4.5)
    const text = ensureContrast(orange, '#ffffff', 4.5)
    expect(contrast(text, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(Math.abs(hexToOklch(text).h - hexToOklch(orange).h)).toBeLessThan(6)
    expect(ensureContrast('#000000', '#ffffff', 4.5)).toBe('#000000') // already passes: unchanged
  })
})

describe('harmonies', () => {
  it('places colors at the right angles on the wheel', () => {
    const base = '#cf8137'
    expect(harmony(base, 'complementary')).toHaveLength(2)
    expect(hueDistance(base, harmony(base, 'complementary')[1]!)).toBeGreaterThan(170)
    const tri = harmony(base, 'triadic')
    expect(tri).toHaveLength(3)
    expect(hueDistance(tri[0]!, tri[1]!)).toBeGreaterThan(110)
    expect(hueDistance(tri[0]!, tri[2]!)).toBeGreaterThan(110)
    expect(harmony(base, 'tetradic')).toHaveLength(4)
    expect(harmony(base, 'square')).toHaveLength(4)
    expect(harmony(base, 'analogous').slice(1).every((h) => hueDistance(base, h) < 40)).toBe(true)
    // Monochromatic keeps the hue and changes lightness.
    expect(harmony(base, 'monochromatic').every((h) => hueDistance(base, h) < 8)).toBe(true)
    expect(SCHEMES.map((s) => s.id)).toEqual(['monochromatic', 'analogous', 'complementary', 'split-complementary', 'triadic', 'tetradic', 'square'])
  })
})

describe('scales and tokens', () => {
  it('makes a 21-step scale from light to dark, like Payload’s', () => {
    const s = scale('#cf8137')
    expect(Object.keys(s).map(Number)).toEqual(STEPS)
    const ls = STEPS.map((k) => hexToOklch(s[k]!).l)
    for (let i = 1; i < ls.length; i++) expect(ls[i]!).toBeLessThan(ls[i - 1]!)
  })

  it('writes Payload’s admin color scales: base (grays) plus success, warning and error', () => {
    const v = payloadAdminVariables(PRESETS[0]!)
    expect(Object.keys(v)).toHaveLength(84)
    expect(v['--color-base-0']).toMatch(/^#[0-9a-f]{6}$/)
    expect(v['--color-error-500']).toBeDefined()
  })

  it('every preset passes WCAG AA for text and UI, in light and in dark', () => {
    for (const t of PRESETS) {
      const fails = contrastReport(t).filter((c) => !c.pass)
      expect(fails, `${t.name}: ${fails.map((f) => `${f.mode} ${f.pair} ${f.ratio}`).join(', ')}`).toEqual([])
    }
  })

  it('a theme from any harmony is readable, whatever the base color', () => {
    for (const base of ['#ffeb3b', '#00ff00', '#0000ff', '#ff00ff', '#7fffd4', '#8b0000'])
      for (const s of SCHEMES) expect(contrastReport(themeFromHarmony('t', base, s.id)).filter((c) => !c.pass)).toEqual([])
  })

  it('gives CSS for light, dark and the admin', () => {
    const css = themeCss(PRESETS[0]!, { admin: true })
    expect(css).toContain(':root {')
    expect(css).toContain("[data-theme='dark'] {")
    expect(css).toContain('--palette-primary:')
    expect(css).toContain('--color-base-500:')
    expect(tokens(PRESETS[0]!).light['--palette-surface']).not.toBe(tokens(PRESETS[0]!).dark['--palette-surface'])
  })

  it('in Auto, uses dark when the device prefers it, unless light was chosen; Auto can be turned off', () => {
    const dark = tokens(PRESETS[0]!).dark['--palette-surface']!
    const css = themeCss(PRESETS[0]!)
    const auto = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'))
    expect(auto).toContain(":root:not([data-theme='light']) {")
    expect(auto).toContain(`--palette-surface: ${dark};`)
    expect(themeCss(PRESETS[0]!, { auto: false })).not.toContain('prefers-color-scheme')
  })
})

describe('import and export', () => {
  it('round-trips a theme through JSON', () => {
    for (const t of PRESETS) {
      const back = parseTheme(exportTheme(t))
      expect(back.problems).toEqual([])
      expect(back.theme).toEqual({ ...t, format: 'color-theory/1' })
    }
  })

  it('accepts hex with or without #, and normalizes it', () => {
    const r = parseTheme({ name: 'Mine', colors: { primary: 'CF8137', neutral: '#3B2A26' } })
    expect(r.theme!.colors).toEqual({ primary: '#cf8137', neutral: '#3b2a26' })
  })

  it('refuses what it can’t trust, saying why', () => {
    expect(parseTheme('{not json').problems).toEqual(['That isn’t JSON.'])
    const bad = parseTheme({ name: '', colors: { primary: 'orange', neutral: '#000', glow: '#fff', error: 'red' }, harmony: { scheme: 'pentadic' }, radius: { md: 500 } })
    expect(bad.theme).toBeNull()
    expect(bad.problems).toEqual([
      'The theme needs a name.',
      'Unknown color "glow".',
      '"primary" needs a hex color like #cf8137.',
      '"error" isn\'t a hex color.',
      'Unknown harmony "pentadic".',
      'Radius "md" must be a number of pixels from 0 to 64.',
    ])
  })
})

describe('brand intensity', () => {
  const co = PRESETS.find((p) => p.name === 'Field Guide')!
  it('turns on more kinds of element at each level, Bold by default, and per-group overrides win', () => {
    const on = (t: Theme) => Object.entries(brandGroups(t)).filter(([, x]) => x).map(([g]) => g)
    expect(on(co)).toEqual(['buttons', 'header', 'badges', 'bands', 'washes'])
    expect(on({ ...co, intensity: { level: 'off' } })).toEqual([])
    expect(on({ ...co, intensity: { level: 'subtle' } })).toEqual(['buttons'])
    expect(on({ ...co, intensity: { level: 'balanced' } })).toEqual(['buttons', 'header', 'badges'])
    expect(on({ ...co, intensity: { level: 'subtle', groups: { bands: 'on', buttons: 'off' } } })).toEqual(['bands'])
  })

  it('gives plain tokens where the brand is off and brand ones where it is on', () => {
    const bold = tokens(co).light
    const off = tokens({ ...co, intensity: { level: 'off' } }).light
    expect(bold['--palette-button']).toBe(bold['--palette-primary'])
    expect(off['--palette-button']).toBe(off['--palette-text'])
    expect(bold['--palette-band']).toContain('linear-gradient')
    expect(off['--palette-band']).toBe('none')
    expect(off['--palette-header']).toBe(off['--palette-surface'])
    expect(bold['--palette-header']).not.toBe(bold['--palette-surface'])
    expect(off['--palette-badge-primary']).toBe(off['--palette-surface-sunken'])
  })

  it('every level, and every override, passes WCAG AA in light and dark for every preset', () => {
    for (const t of PRESETS)
      for (const level of INTENSITY_LEVELS)
        for (const flip of [undefined, 'on', 'off'] as const) {
          const groups = flip ? Object.fromEntries(BRAND_GROUPS.map((g) => [g.id, flip])) : undefined
          const fails = contrastReport({ ...t, intensity: { level, groups } }).filter((c) => !c.pass)
          expect(fails, `${t.name} ${level} ${flip}: ${fails.map((f) => `${f.mode} ${f.pair} ${f.ratio}`).join(', ')}`).toEqual([])
        }
  })
})

describe('exact colors', () => {
  const pale: Theme = { format: 'color-theory/1', name: 'Pale', colors: { primary: '#f5c99b', neutral: '#3b2a26' }, accessibility: 'exact' }
  it('uses the chosen colors as they are, so the report shows what falls short', () => {
    const v = tokens(pale).light
    expect(v['--palette-primary']).toBe('#f5c99b')
    expect(v['--palette-link']).toBe('#f5c99b')
    const fails = contrastReport(pale).filter((c) => !c.pass)
    expect(fails.map((f) => f.id)).toContain('links-page')
    // The same theme in the default mode is moved until it passes.
    expect(contrastReport({ ...pale, accessibility: undefined }).filter((c) => !c.pass)).toEqual([])
  })

  it('suggests a color for each failure that, used, makes that check pass', () => {
    const fails = contrastReport(pale).filter((c) => !c.pass && c.suggest)
    expect(fails.length).toBeGreaterThan(0)
    for (const f of fails) {
      const fixed = contrastReport({ ...pale, colors: { ...pale.colors, [f.role!]: f.suggest! } }).find((c) => c.id === f.id && c.mode === f.mode)!
      expect(fixed.pass, `${f.mode} ${f.pair} with ${f.suggest}: ${fixed.ratio}`).toBe(true)
      expect(Math.abs(hexToOklch(f.suggest!).h - hexToOklch(completeColors(pale)[f.role!]).h)).toBeLessThan(3)
    }
  })

  it('never moves neutral-derived text: body, muted and header text pass even in exact mode', () => {
    const fails = contrastReport({ ...pale, colors: { ...pale.colors, neutral: '#8a8a8a' } }).filter((c) => !c.pass)
    expect(fails.filter((f) => ['text-page', 'text-cards', 'muted-page', 'muted-cards', 'header'].includes(f.id))).toEqual([])
  })
})

describe('reading intensity and accessibility', () => {
  it('keeps valid settings and refuses unknown ones, saying why', () => {
    const ok = parseTheme({ name: 'X', colors: { primary: '#cf8137', neutral: '#3b2a26' }, accessibility: 'exact', intensity: { level: 'subtle', groups: { bands: 'on' } } })
    expect(ok.theme).toMatchObject({ accessibility: 'exact', intensity: { level: 'subtle', groups: { bands: 'on' } } })
    const bad = parseTheme({ name: 'X', colors: { primary: '#cf8137', neutral: '#3b2a26' }, accessibility: 'loose', intensity: { level: 'max', groups: { sparkles: 'on', bands: 'yes' } } })
    expect(bad.theme).toBeNull()
    expect(bad.problems.join(' ')).toMatch(/accessibility.*adjust.*exact/)
    expect(bad.problems.join(' ')).toMatch(/Unknown intensity level "max"/)
    expect(bad.problems.join(' ')).toMatch(/Unknown intensity group "sparkles"/)
    expect(bad.problems.join(' ')).toMatch(/"bands" is "on" or "off"/)
    // Themes saved before these settings existed still read, and mean adjust + Bold.
    expect(parseTheme({ name: 'Old', colors: { primary: '#cf8137', neutral: '#3b2a26' } }).theme).not.toHaveProperty('intensity')
  })
})
