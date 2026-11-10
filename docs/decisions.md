# Decisions

Dated decisions for this repo, newest last.

- 2026-11-09: created from the ops starter kit, area `captive-origins`.
- 2026-11-10: **built at the owner's request**, in Web Platform's chat: "A theme creator with all the different color wheel theory things. It can have some pregenerated themes, and should allow for an easy import export of our json themes with hex. The taxa hierarchy should hook into stuff agnostically, but it should also interface with our theme stuff if possible. So try to use payload's theming structure." Name: the owner suggested `payload-plugin-color-theory` (2026-11-10); confirm before the first publish.
- 2026-11-10 (build): **OKLCH for color math**, so harmonies and scales look even. **Payload's own variables for the admin** (`--color-base-*`, success, warning and error scales), which its light and dark themes already read. **`--palette-*` for sites**, the token names Nested Docs Browser falls back to.
- 2026-11-10 (build): **readable by construction**: text 4.5:1, fills 3:1 against the page and 4.5:1 against their text; colors are moved in lightness only. Every preset, and generated themes from hard base colors, pass in light and dark (tested).
