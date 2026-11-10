import { describe, expect, it } from 'vitest'

import { contrast, contrastReport, ensureContrast, exportTheme, harmony, hexToOklch, hexToRgb, hueDistance, oklchToHex, parseTheme, payloadAdminVariables, PRESETS, rgbToHex, scale, SCHEMES, STEPS, themeCss, themeFromHarmony, tokens } from '../src/core/index.js'

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
