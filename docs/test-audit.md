# Test audit

Kept by this repo's owning session, per `~/Code/CLAUDE.md`, "Test self-audits". Newest first.

## 2026-11-10: brand intensity, exact colors, UI kit

37 tests: core 20, plugin 6, mode 5, editor 6 (`test/editor.test.tsx`, jsdom, Payload's `useField` replaced with React state).

| Promise | Covered by |
| --- | --- |
| Levels turn on the right kinds of element; Bold by default; overrides win | core: brand intensity |
| Brand-off groups get plain tokens, brand-on groups brand ones | core: brand intensity |
| **Every level and every override passes WCAG AA, light and dark, for every preset** | core: 7 presets × 4 levels × 3 override sets |
| Exact mode keeps chosen colors and reports failures; adjust mode fixes the same theme | core: exact colors |
| Each suggestion, applied, makes its check pass, keeping the hue | core: exact colors |
| Neutral-derived text (body, muted, header) passes even in exact mode | core: exact colors |
| New settings are validated with reasons; old themes still read | core: reading intensity |
| Kit in light and dark; no warnings when all pass; table closed by default | editor |
| Warning opens a suggestion; "Use this" applies it, keeps exact mode, and the check passes; Escape closes | editor |
| Table rows grade in words; choosing a row highlights the element in both modes | editor |
| Slider, overrides and the switch change the saved theme | editor |
| Polite announcement after a pause, not on every change | editor |

Gaps skipped: the kit's look and the warning popover's placement need a browser. They'll be checked when the site is wired to the plugin, and are noted in the README until then.

## 2026-11-10: plugin, editor and light/dark mode

24 tests: `test/core.test.ts` (13), `test/plugin.test.ts` (6), `test/mode.test.tsx` (5).

| Promise | Covered by |
| --- | --- |
| Harmonies rotate hues correctly for all 7 schemes | core: harmony tests |
| OKLCH and hex round-trips, contrast math | core: color tests |
| Every preset and generated theme passes every contrast pair, light and dark (page, cards, badges, buttons, focus) | core: `contrastReport` over all presets and over harmonies from hard base colors |
| Import says what's wrong; export re-imports unchanged | core: parse/export tests |
| Admin variables are Payload's names and scales | core: `payloadAdminVariables` test |
| Auto block in the CSS for devices that prefer dark | core: `themeCss` test |
| Saved themes are normalized; bad themes are refused with a reason | plugin: saved themes |
| **Only people with access save or choose themes** (refusal tested); everyone reads | plugin: access test |
| Admin CSS only when switched on; site CSS when a theme is in use | plugin: theme in use |
| Endpoints answer; the admin provider is added without dropping others | plugin |
| No-flash script: saved choice, else device; never throws with storage blocked | mode |
| Auto follows the device live; a choice is saved, sticks, and Auto clears it; labels translate | mode |

Gaps added this pass: badge contrast pairs (found in the browser trial), mode tests.

Gaps skipped, and why:
- The ETag/304 path: about five lines of plain header logic, checked by hand in the browser trial. Add a test if it grows.
- The editor UI (`ThemeEditor`): it's built from the core functions tested above. The browser trial covered it (presets, harmony, import errors, save, axe). Rendering tests would mostly test Payload's field hooks.
- Data loss and money: none. Themes are colors and can be exported.

## 2026-11-09: first audit (starter kit)

- Promises: none yet.
