import { themeFromHarmony, type Theme } from './theme.js'

/** Ready-made themes. Each passes the contrast report in light and dark (a test checks it). */
export const PRESETS: Theme[] = [
  {
    format: 'color-theory/1',
    name: 'Captive Origins',
    colors: { primary: '#cf8137', secondary: '#e48185', accent: '#5a8f6b', neutral: '#3b2a26' },
    radius: { md: 8, lg: 14 },
  },
  { ...themeFromHarmony('Terracotta', '#c2562f', 'split-complementary', '#2e2420'), radius: { md: 6, lg: 10 } },
  { ...themeFromHarmony('Rainforest', '#2f7d4f', 'analogous', '#1c2a22'), radius: { md: 10, lg: 18 } },
  { ...themeFromHarmony('Reef', '#1f8a8a', 'complementary', '#14262b'), radius: { md: 12, lg: 20 } },
  { ...themeFromHarmony('Desert bloom', '#b4547e', 'triadic', '#2b2228'), radius: { md: 8, lg: 14 } },
  { ...themeFromHarmony('Night market', '#6a5acd', 'tetradic', '#1a1825'), radius: { md: 4, lg: 8 } },
  { format: 'color-theory/1', name: 'High contrast', colors: { primary: '#0047ab', secondary: '#111111', accent: '#b00020', neutral: '#000000' }, radius: { md: 4, lg: 6 } },
]
