# Decisions

Dated decisions for this repo, newest last.

- 2026-11-09: created from the ops starter kit, area `captive-origins`.
- 2026-11-10: **built at the owner's request**, in Web Platform's chat: "A theme creator with all the different color wheel theory things. It can have some pregenerated themes, and should allow for an easy import export of our json themes with hex. The taxa hierarchy should hook into stuff agnostically, but it should also interface with our theme stuff if possible. So try to use payload's theming structure." Name: the owner suggested `payload-plugin-color-theory` (2026-11-10); confirm before the first publish.
- 2026-11-10 (build): **OKLCH for color math**, so harmonies and scales look even. **Payload's own variables for the admin** (`--color-base-*`, success, warning and error scales), which its light and dark themes already read. **`--palette-*` for sites**, the token names Nested Docs Browser falls back to.
- 2026-11-10 (build): **readable by construction**: text 4.5:1, fills 3:1 against the page and 4.5:1 against their text; colors are moved in lightness only. Every preset, and generated themes from hard base colors, pass in light and dark (tested).
- 2026-11-10 (owner, in Web Platform's chat): "Make sure that the color theory stuff all works with both light and dark themes seamlessly… if so, it should probably be put in color theory". So **light/dark mode lives here** (`/mode`): Auto follows the device live, the choice is kept under `payload-theme` (the website template's key, so existing choices carry over), and the theme CSS adds a `prefers-color-scheme` block for Auto.
- 2026-11-10 (build): **contrast is checked on every surface text can sit on**: page, cards, sunken areas, and for status text its own soft badge fill. The browser trial found links and badges that passed on the page but not on cards or badges.
- 2026-11-10 (build): **the CSS endpoints revalidate** (`no-cache` with an ETag) instead of caching for minutes, so a theme change shows on the next load. The trial showed a stale admin.css after a change.
- 2026-11-10 (build): **one theme per install**, not per site. Per-site themes wait for a real need.
