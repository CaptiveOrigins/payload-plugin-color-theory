# payload-plugin-color-theory

Color Theory for Payload: build site and admin themes from color harmonies (complementary, triadic, tetradic and more), check contrast, and import or export themes as JSON with hex values.

**Status:** early, private. The color core is built and tested (12 tests): harmonies, scales, light and dark tokens, Payload's admin scales, contrast checks, import and export. The Payload side (saved themes, the editor in the admin, applying a theme to the site and the admin) isn't built yet.

## What it does

- **Harmonies.** From one base color: monochromatic, analogous, complementary, split complementary, triadic, tetradic (rectangle) and square. Hues are rotated in OKLCH, a perceptual color space, so the results look equally light and belong together.
- **Themes from a few colors.** A theme is a name and a handful of hex colors: primary, secondary, accent, a neutral (the color grays lean toward), and success, warning and error.
- **Tokens.**
  - The site gets `--palette-*` variables for light and dark: surfaces, text, borders, and each role as a fill, the text on it, a readable text shade and a soft background.
  - Payload's admin gets its own `--color-base-*`, success, warning and error scales, the variables Payload itself is themed with, so its dark mode keeps working.
- **Readable by construction.** Text colors pass WCAG AA (4.5:1) and fills stand out from the page (3:1). A brand color that doesn't pass is moved in lightness only, keeping its hue. The contrast report lists every pair.
- **Import and export.** Themes are plain JSON with hex values (`format: "color-theory/1"`). Import checks every field and says what's wrong.
- **Presets:** Captive Origins, Terracotta, Rainforest, Reef, Desert bloom, Night market, High contrast. Each passes contrast in light and dark.

```json
{
  "format": "color-theory/1",
  "name": "Captive Origins",
  "colors": { "primary": "#cf8137", "secondary": "#e48185", "accent": "#5a8f6b", "neutral": "#3b2a26" },
  "radius": { "md": 8, "lg": 14 }
}
```

## Commands

```bash
npm test          # Vitest
npm run typecheck
npm run build
```

## License

Not decided yet. Private repos carry no license.
