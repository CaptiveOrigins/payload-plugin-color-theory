# payload-plugin-color-theory

Color Theory for Payload: build site and admin themes from color harmonies (complementary, triadic, tetradic and more), check contrast in light and dark, switch between them, and import or export themes as JSON with hex values.

**Status:** early, private. 24 tests pass. Tried on a local copy of the Captive Origins site in Chromium, light and dark:

- the editor works: presets, harmonies, import, export and save;
- the admin takes on a saved theme's colors;
- axe finds no contrast problems in anything this plugin draws.

It hasn't been used on a live site, and the site-side light/dark switch has only been tested in jsdom, not in a browser.

## What it does

- **Harmonies.** From one base color: monochromatic, analogous, complementary, split complementary, triadic, tetradic (rectangle) and square. Hues are rotated in OKLCH, a perceptual color space, so the results look equally light and belong together.
- **Themes from a few colors.** A theme is a name and a handful of hex colors: primary, secondary, accent, a neutral (the color grays lean toward), and optionally success, warning and error.
- **Tokens for the site.** `--palette-*` variables for light and dark: surfaces, text, borders, and for each role a fill, the text on it, a readable text shade and a soft background.
- **Payload's admin, too.** It gets its own `--color-base-*`, success, warning and error scales, the variables Payload is themed with, so the admin's own dark mode keeps working. Off until you turn it on.
- **Readable by construction.** Text passes WCAG AA (4.5:1) on every surface it can sit on: the page, cards, sunken areas and its own soft badge background. Fills stand out from the page (3:1). A brand color that doesn't pass is moved in lightness only, keeping its hue. The editor shows every pair with its ratio.
- **Light, dark and Auto.** The CSS follows `data-theme="light|dark"` on `<html>`. With no choice saved, it follows the device. `@captiveorigins/payload-plugin-color-theory/mode` has the pieces a site needs:
  - `colorModeScript()`: an inline script for `<head>`, so the page never flashes the wrong mode;
  - `ColorModeProvider` and `useColorMode()`: in Auto, these follow the device live;
  - `ColorModeSelector`: an Auto / Light / Dark select you can label in any language.

  The choice is stored under `payload-theme`, the key Payload's website template uses, so choices people already made carry over.
- **Import and export.** Themes are plain JSON with hex values (`format: "color-theory/1"`). Import checks every field and says what's wrong. The admin refuses to save a theme that wouldn't import.
- **Presets:** Captive Origins, Terracotta, Rainforest, Reef, Desert bloom, Night market, High contrast. Each passes contrast in light and dark.

```json
{
  "format": "color-theory/1",
  "name": "Captive Origins",
  "colors": { "primary": "#cf8137", "secondary": "#e48185", "accent": "#5a8f6b", "neutral": "#3b2a26" },
  "radius": { "md": 8, "lg": 14 }
}
```

## Install

```ts
// payload.config.ts
import { colorTheory } from '@captiveorigins/payload-plugin-color-theory'

plugins: [
  colorTheory({
    access: ({ req }) => req.user?.role === 'admin', // who may save and choose themes; required
    adminGroup: 'Design',
  }),
]
```

This adds:

- a **Color themes** collection with the editor;
- a **Color theory** global, which picks the theme in use and whether it applies to the site, the admin or both;
- three endpoints: `/api/color-theory/theme.css`, `/api/color-theory/admin.css` and `/api/color-theory/presets`.

The CSS is sent with an ETag and `no-cache`. A change shows on the next page load, and an unchanged theme costs a 304. Everyone may read themes, because they're only colors.

On the site, link the CSS and add the mode script:

```tsx
import { colorModeScript, ColorModeProvider, ColorModeSelector } from '@captiveorigins/payload-plugin-color-theory/mode'

<html suppressHydrationWarning>
  <head>
    <script dangerouslySetInnerHTML={{ __html: colorModeScript() }} />
    <link rel="stylesheet" href="/api/color-theory/theme.css" />
  </head>
  <body>
    <ColorModeProvider>
      <ColorModeSelector />
      {children}
    </ColorModeProvider>
  </body>
</html>
```

Or render the CSS on the server with `activeThemeCss(payload)`. The selector has the classes `ct-mode`, `ct-mode__label` and `ct-mode__select`, plus `data-mode` and `data-resolved` for styling.

## Limits

- Payload's own admin uses gray step 500 on step 100 for a few small labels, such as the locale switcher. That pair is under 4.5:1 with Payload's default grays as well, and this plugin doesn't change which steps Payload uses.
- One theme is in use at a time, across the whole install. Per-site themes for multi-tenant setups aren't built.
- Colors are adjusted in lightness only. A hue you pick is kept, even when another hue would contrast better.

## Commands

```bash
npm test          # Vitest
npm run typecheck
npm run build
```

## License

Not decided yet. Private repos carry no license.
