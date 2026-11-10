import { hexToOklch, oklchToHex, type Oklch } from './color.js'

/**
 * Color harmonies: colors chosen by their positions on the color wheel. Hue is rotated in OKLCH, keeping
 * the base color's lightness and chroma, so the results look like they belong together.
 */
export type Scheme = 'monochromatic' | 'analogous' | 'complementary' | 'split-complementary' | 'triadic' | 'tetradic' | 'square'

export const SCHEMES: { id: Scheme; label: string; description: string; turns: number[] }[] = [
  { id: 'monochromatic', label: 'Monochromatic', description: 'One hue in lighter and darker shades.', turns: [] },
  { id: 'analogous', label: 'Analogous', description: 'Neighbors on the wheel, 30° either side: calm and cohesive.', turns: [-30, 30] },
  { id: 'complementary', label: 'Complementary', description: 'The opposite hue, 180°: the strongest contrast.', turns: [180] },
  { id: 'split-complementary', label: 'Split complementary', description: 'The two hues beside the opposite, 150° and 210°: contrast with less tension.', turns: [150, 210] },
  { id: 'triadic', label: 'Triadic', description: 'Three hues evenly spaced, 120° apart: vivid and balanced.', turns: [120, 240] },
  { id: 'tetradic', label: 'Tetradic (rectangle)', description: 'Two complementary pairs, 60° apart: rich, needs one color to lead.', turns: [60, 180, 240] },
  { id: 'square', label: 'Square', description: 'Four hues evenly spaced, 90° apart: lively, best with one dominant.', turns: [90, 180, 270] },
]

const wrap = (h: number) => ((h % 360) + 360) % 360

/** The harmony's colors, starting with the base. Monochromatic gives lighter and darker versions instead. */
export function harmony(baseHex: string, scheme: Scheme): string[] {
  const base = hexToOklch(baseHex)
  if (scheme === 'monochromatic') {
    const at = (l: number): Oklch => ({ ...base, l: Math.min(0.97, Math.max(0.15, l)) })
    return [baseHex.toLowerCase(), oklchToHex(at(base.l + 0.18)), oklchToHex(at(base.l - 0.18)), oklchToHex(at(base.l + 0.32))]
  }
  const turns = SCHEMES.find((s) => s.id === scheme)?.turns ?? []
  return [baseHex.toLowerCase(), ...turns.map((t) => oklchToHex({ ...base, h: wrap(base.h + t) }))]
}

/** The angle between two colors' hues, 0 to 180. */
export const hueDistance = (a: string, b: string) => {
  const d = Math.abs(hexToOklch(a).h - hexToOklch(b).h) % 360
  return d > 180 ? 360 - d : d
}
