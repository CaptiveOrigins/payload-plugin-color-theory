/**
 * Color math: hex, sRGB, OKLab and OKLCH, plus WCAG contrast. No dependencies.
 *
 * Harmonies rotate hue and scales step lightness in OKLCH, a perceptual space: equal steps look equal, and
 * a yellow and a blue at the same lightness really look equally light (in HSL they don't).
 */
export type Rgb = { r: number; g: number; b: number } // 0..1, gamma-encoded sRGB
export type Oklch = { l: number; c: number; h: number } // l 0..1, c 0..~0.37, h 0..360

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Is this a hex color (#rgb or #rrggbb)? */
export const isHex = (s: unknown): s is string => typeof s === 'string' && HEX.test(s.trim())

export function hexToRgb(hex: string): Rgb {
  const m = HEX.exec(hex.trim())
  if (!m) throw new Error(`Not a hex color: ${hex}`)
  let h = m[1]!
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
export function rgbToHex({ r, g, b }: Rgb): string {
  return '#' + [r, g, b].map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('')
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)

export function rgbToOklch({ r, g, b }: Rgb): Oklch {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)]
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const c = Math.sqrt(A * A + B * B)
  let h = (Math.atan2(B, A) * 180) / Math.PI
  if (h < 0) h += 360
  return { l: L, c, h: c < 1e-4 ? 0 : h }
}

function oklchToRgbRaw({ l, c, h }: Oklch): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return {
    r: toGamma(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    g: toGamma(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    b: toGamma(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  }
}

const inGamut = ({ r, g, b }: Rgb) => [r, g, b].every((v) => v >= -1e-4 && v <= 1 + 1e-4)

/** OKLCH to sRGB, reducing chroma (keeping lightness and hue) until the color can be shown on screen. */
export function oklchToRgb(c: Oklch): Rgb {
  let rgb = oklchToRgbRaw(c)
  if (inGamut(rgb)) return rgb
  let lo = 0
  let hi = c.c
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    const t = oklchToRgbRaw({ ...c, c: mid })
    if (inGamut(t)) {
      lo = mid
      rgb = t
    } else hi = mid
  }
  return oklchToRgbRaw({ ...c, c: lo })
}

export const hexToOklch = (hex: string) => rgbToOklch(hexToRgb(hex))
export const oklchToHex = (c: Oklch) => rgbToHex(oklchToRgb(c))

/** WCAG 2 relative luminance. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

/** WCAG 2 contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number]
  return (x + 0.05) / (y + 0.05)
}

/** The text color for a background: white or near-black, whichever reads better. */
export const onColor = (bg: string, dark = '#151515', light = '#ffffff') => (contrast(bg, light) >= contrast(bg, dark) ? light : dark)

/**
 * Moves a color's lightness (keeping its hue) until it reaches `ratio` against `against`, so a brand color
 * can be used for text or borders without failing contrast. Returns the color itself if it already passes.
 */
export function ensureContrast(hex: string, against: string, ratio: number): string {
  if (contrast(hex, against) >= ratio) return hex
  const c = hexToOklch(hex)
  const darker = luminance(against) > 0.18
  for (let step = 1; step <= 100; step++) {
    const l = darker ? c.l - step * 0.01 : c.l + step * 0.01
    if (l < 0 || l > 1) break
    const t = oklchToHex({ ...c, l })
    if (contrast(t, against) >= ratio) return t
  }
  return darker ? '#000000' : '#ffffff'
}
