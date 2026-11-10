'use client'

import { useField } from '@payloadcms/ui'
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'

import { BRAND_GROUPS, brandGroups, contrastReport, exportTheme, hexToOklch, INTENSITY_LABELS, INTENSITY_LEVELS, isHex, parseTheme, PRESETS, SCHEMES, themeFromHarmony, tokens, type BrandGroup, type ContrastCheck, type Scheme, type Theme, type ThemeColors } from '../core/index.js'
import { UiKit } from './UiKit.js'

const ROLES: { key: keyof ThemeColors; label: string; hint: string; optional?: boolean }[] = [
  { key: 'primary', label: 'Primary', hint: 'Buttons, links, focus: the main brand color.' },
  { key: 'secondary', label: 'Secondary', hint: 'Second buttons, highlights.', optional: true },
  { key: 'accent', label: 'Accent', hint: 'Badges, small touches.', optional: true },
  { key: 'neutral', label: 'Neutral', hint: 'The color grays lean toward: text, borders, backgrounds.' },
  { key: 'success', label: 'Success', hint: 'Saved, done, passed.', optional: true },
  { key: 'warning', label: 'Warning', hint: 'Careful.', optional: true },
  { key: 'error', label: 'Error', hint: 'Problems and refusals.', optional: true },
]

const box: CSSProperties = { border: '1px solid var(--theme-elevation-150)', borderRadius: 'var(--style-radius-m, 6px)', padding: 16, background: 'var(--theme-elevation-0)' }
const row: CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }
const input: CSSProperties = { minHeight: 40, padding: '0 10px', border: '1px solid var(--theme-elevation-200)', borderRadius: 4, background: 'var(--theme-input-bg)', color: 'var(--theme-text)', font: 'inherit' }

/** A ring showing where the theme's colors sit on the color wheel. */
function Wheel({ colors }: { colors: string[] }) {
  const ring = Array.from({ length: 36 }, (_, i) => i * 10)
  return (
    <svg viewBox="-60 -60 120 120" width={120} height={120} role="img" aria-label={`Color wheel with ${colors.length} colors marked`}>
      {ring.map((h) => {
        const a = ((h - 90) * Math.PI) / 180
        return <circle key={h} cx={Math.cos(a) * 46} cy={Math.sin(a) * 46} r={6} fill={`oklch(0.72 0.14 ${h})`} />
      })}
      {colors.filter(isHex).map((c, i) => {
        const h = hexToOklch(c).h
        const a = ((h - 90) * Math.PI) / 180
        return (
          <g key={i}>
            <line x1={0} y1={0} x2={Math.cos(a) * 32} y2={Math.sin(a) * 32} stroke="currentColor" strokeWidth={1} opacity={0.5} />
            <circle cx={Math.cos(a) * 32} cy={Math.sin(a) * 32} r={8} fill={c} stroke="currentColor" strokeWidth={2} />
          </g>
        )
      })}
    </svg>
  )
}

/** How a ratio reads: AAA, AA, AA but close to the line, or failing. Shown in words as well as color. */
function grade(c: ContrastCheck): { text: string; color: string } {
  if (!c.pass) return { text: 'Fails', color: 'var(--theme-error-500, #b42318)' }
  if (c.aaa) return { text: 'AAA', color: 'var(--theme-success-500, #2f855a)' }
  if (c.ratio < c.min + 0.5) return { text: 'AA, close', color: 'var(--theme-warning-500, #b7791f)' }
  return { text: 'AA', color: 'var(--theme-success-500, #2f855a)' }
}

/** The theme field: start from a preset or a harmony, adjust each color, see it in light and dark, check contrast, import and export. */
export function ThemeEditor({ path }: { path: string }) {
  const { value, setValue, errorMessage, showError } = useField<Theme>({ path })
  const id = useId()
  const theme: Theme = parseTheme(value).theme ?? PRESETS[0]!
  const [base, setBase] = useState(theme.colors.primary)
  const [scheme, setScheme] = useState<Scheme>(theme.harmony?.scheme ?? 'split-complementary')
  const [imported, setImported] = useState('')
  const [said, setSaid] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const tk = useMemo(() => tokens(theme), [theme])
  const report = useMemo(() => contrastReport(theme), [theme])
  const fails = report.filter((r) => !r.pass)
  const groups = brandGroups(theme)
  const level = theme.intensity?.level ?? 'bold'
  const [highlight, setHighlight] = useState<string | null>(null)
  // Results are announced once the person pauses, not on every change.
  const [announced, setAnnounced] = useState('')
  const summary = fails.length ? `${fails.length} contrast ${fails.length === 1 ? 'check falls' : 'checks fall'} short of WCAG AA.` : 'Every contrast check passes WCAG AA, in light and dark.'
  useEffect(() => {
    const t = setTimeout(() => setAnnounced(summary), 900)
    return () => clearTimeout(t)
  }, [summary])
  const set = (t: Theme) => (setValue(t), setSaid(''))
  const setIntensity = (next: Theme['intensity']) => set({ ...theme, intensity: next })
  const setGroup = (g: BrandGroup, x: 'level' | 'on' | 'off') => {
    const groupsNext = { ...theme.intensity?.groups }
    if (x === 'level') delete groupsNext[g]
    else groupsNext[g] = x
    setIntensity({ ...theme.intensity, groups: Object.keys(groupsNext).length ? groupsNext : undefined })
  }
  const setColor = (key: keyof ThemeColors, hex: string | undefined) => {
    const colors = { ...theme.colors }
    if (hex === undefined) delete colors[key]
    else colors[key] = hex.toLowerCase()
    set({ ...theme, colors, harmony: undefined })
  }
  const doImport = (text: string) => {
    const r = parseTheme(text)
    if (!r.theme) return setSaid(`Not imported: ${r.problems.join(' ')}`)
    set(r.theme)
    setSaid(`Imported "${r.theme.name}".`)
  }
  const json = exportTheme(theme)

  return (
    <div className="field-type" style={{ display: 'grid', gap: 16, marginBottom: 'var(--base, 20px)' }}>
      {showError && errorMessage ? <p role="alert" style={{ color: 'var(--theme-error-500)', margin: 0 }}>{errorMessage}</p> : null}

      <section style={box} aria-labelledby={`${id}-start`}>
        <h3 id={`${id}-start`} style={{ margin: '0 0 10px' }}>Start from</h3>
        <div style={row}>
          <label style={row}>
            Preset
            <select style={input} value="" onChange={(e) => e.target.value && set({ ...PRESETS[Number(e.target.value)]!, name: theme.name })}>
              <option value="">Choose…</option>
              {PRESETS.map((p, i) => (
                <option key={p.name} value={i}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ ...row, marginTop: 12 }}>
          <label style={row}>
            Base color
            <input type="color" value={base} onChange={(e) => setBase(e.target.value)} style={{ width: 44, height: 40, padding: 0, border: 0, background: 'none' }} aria-label="Base color picker" />
            <input style={{ ...input, width: 110 }} value={base} onChange={(e) => setBase(e.target.value)} aria-label="Base color hex" />
          </label>
          <label style={row}>
            Harmony
            <select style={input} value={scheme} onChange={(e) => setScheme(e.target.value as Scheme)}>
              {SCHEMES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }} disabled={!isHex(base)} onClick={() => set({ ...themeFromHarmony(theme.name, base, scheme, theme.colors.neutral), radius: theme.radius })}>
            Use this harmony
          </button>
        </div>
        <p style={{ margin: '8px 0 0', color: 'var(--theme-elevation-650)' }}>{SCHEMES.find((s) => s.id === scheme)?.description}</p>
      </section>

      <section style={box} aria-labelledby={`${id}-colors`}>
        <div style={{ ...row, justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h3 id={`${id}-colors`} style={{ margin: 0 }}>Colors</h3>
          <Wheel colors={[theme.colors.primary, theme.colors.secondary, theme.colors.accent].filter((c): c is string => Boolean(c))} />
        </div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {ROLES.map((r) => {
            const v = theme.colors[r.key]
            return (
              <div key={r.key} style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontWeight: 600 }}>{r.label}</span>
                <div style={row}>
                  <input type="color" value={v ?? '#888888'} disabled={!v} onChange={(e) => setColor(r.key, e.target.value)} aria-label={`${r.label} color picker`} style={{ width: 44, height: 40, padding: 0, border: 0, background: 'none' }} />
                  <input style={{ ...input, width: 110 }} value={v ?? ''} placeholder={r.optional ? 'automatic' : ''} disabled={!v} onChange={(e) => isHex(e.target.value) && setColor(r.key, e.target.value)} aria-label={`${r.label} hex`} />
                  {r.optional ? (
                    <label style={row}>
                      <input type="checkbox" checked={Boolean(v)} onChange={(e) => setColor(r.key, e.target.checked ? (tk.light[`--palette-${r.key}`] ?? '#888888') : undefined)} /> Set by hand
                    </label>
                  ) : null}
                </div>
                <span style={{ fontSize: '.85em', color: 'var(--theme-elevation-650)' }}>{r.hint}</span>
                {(() => {
                  const f = fails.find((x) => x.role === r.key && x.suggest)
                  const n = fails.filter((x) => x.role === r.key).length
                  if (!n) return null
                  return (
                    <span style={{ ...row, gap: 6, fontSize: '.85em' }}>
                      <span aria-hidden="true" style={{ color: 'var(--theme-error-500)', fontWeight: 700 }}>⚠</span>
                      <span>
                        {n} contrast {n === 1 ? 'check fails' : 'checks fail'} with this color.{f ? <> Better for accessibility: <code>{f.suggest}</code>.</> : null}
                      </span>
                      {f ? (
                        <button type="button" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }} onClick={() => setColor(r.key, f.suggest!)}>
                          Use {f.suggest}
                        </button>
                      ) : null}
                    </span>
                  )
                })()}
              </div>
            )
          })}
        </div>
        <div style={{ ...row, marginTop: 12 }}>
          {(['md', 'lg'] as const).map((k) => (
            <label key={k} style={row}>
              {k === 'md' ? 'Corner radius (controls)' : 'Corner radius (cards)'}
              <input type="number" min={0} max={64} style={{ ...input, width: 80 }} value={theme.radius?.[k] ?? (k === 'md' ? 8 : 14)} onChange={(e) => set({ ...theme, radius: { ...theme.radius, [k]: Math.max(0, Math.min(64, Number(e.target.value) || 0)) } })} /> px
            </label>
          ))}
        </div>
      </section>

      <section style={box} aria-labelledby={`${id}-brand`}>
        <h3 id={`${id}-brand`} style={{ margin: '0 0 10px' }}>Brand intensity and accessibility</h3>
        <div style={{ display: 'grid', gap: 6, maxWidth: 520 }}>
          <label htmlFor={`${id}-level`} style={{ fontWeight: 600 }}>
            How much of the site carries the brand colors
          </label>
          <input
            id={`${id}-level`}
            type="range"
            min={0}
            max={INTENSITY_LEVELS.length - 1}
            step={1}
            list={`${id}-levels`}
            value={INTENSITY_LEVELS.indexOf(level)}
            aria-valuetext={INTENSITY_LABELS[level]}
            onChange={(e) => setIntensity({ ...theme.intensity, level: INTENSITY_LEVELS[Number(e.target.value)] })}
            style={{ width: '100%', minHeight: 32 }}
          />
          <datalist id={`${id}-levels`}>
            {INTENSITY_LEVELS.map((l, i) => (
              <option key={l} value={i} label={INTENSITY_LABELS[l]} />
            ))}
          </datalist>
          <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85em', color: 'var(--theme-elevation-650)' }}>
            {INTENSITY_LEVELS.map((l) => (
              <span key={l} style={{ fontWeight: l === level ? 700 : 400 }}>{INTENSITY_LABELS[l]}</span>
            ))}
          </div>
          <p style={{ margin: 0 }}>
            <strong>{INTENSITY_LABELS[level]}:</strong> {BRAND_GROUPS.filter((g) => groups[g.id]).map((g) => g.label.toLowerCase()).join(', ') || 'no brand colors, plain everywhere'}.
          </p>
        </div>
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>Set each kind of element</summary>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', marginTop: 6 }}>
            {BRAND_GROUPS.map((g) => (
              <div key={g.id} style={{ display: 'grid', gap: 4 }}>
                <label htmlFor={`${id}-g-${g.id}`} style={{ fontWeight: 600 }}>{g.label}</label>
                <select id={`${id}-g-${g.id}`} aria-describedby={`${id}-gh-${g.id}`} style={input} value={theme.intensity?.groups?.[g.id] ?? 'level'} onChange={(e) => setGroup(g.id, e.target.value as 'level' | 'on' | 'off')}>
                  <option value="level">Follow the level ({INTENSITY_LEVELS.indexOf(level) >= INTENSITY_LEVELS.indexOf(g.from) ? 'on' : 'off'} at {INTENSITY_LABELS[level]})</option>
                  <option value="on">Always on</option>
                  <option value="off">Always off</option>
                </select>
                <span id={`${id}-gh-${g.id}`} style={{ fontSize: '.85em', color: 'var(--theme-elevation-650)' }}>{g.hint}</span>
              </div>
            ))}
          </div>
        </details>
        <fieldset style={{ border: 0, padding: 0, margin: '14px 0 0', display: 'grid', gap: 6 }}>
          <legend style={{ fontWeight: 600, padding: 0, marginBottom: 6 }}>Accessibility</legend>
          <label style={row}>
            <input type="radio" name={`${id}-a11y`} checked={theme.accessibility !== 'exact'} onChange={() => set({ ...theme, accessibility: undefined })} />
            Adjust colors for accessibility (recommended): colors that carry text are moved, lightness only, until they pass WCAG AA.
          </label>
          <label style={row}>
            <input type="radio" name={`${id}-a11y`} checked={theme.accessibility === 'exact'} onChange={() => set({ ...theme, accessibility: 'exact' })} />
            Use my exact colors: nothing is moved; anything that falls short is marked, with a better color to switch to.
          </label>
        </fieldset>
      </section>

      <section style={box} aria-labelledby={`${id}-kit`}>
        <h3 id={`${id}-kit`} style={{ margin: '0 0 6px' }}>UI kit</h3>
        <p style={{ margin: '0 0 10px', color: 'var(--theme-elevation-650)' }}>How the theme looks on common parts of a site. A red mark means a contrast check fails there; open it for a better color.</p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <UiKit v={tk.light} mode="light" report={report} highlight={highlight} onUse={setColor} />
          <UiKit v={tk.dark} mode="dark" report={report} highlight={highlight} onUse={setColor} />
        </div>
        <p role="status" aria-live="polite" style={{ margin: '12px 0 0', fontWeight: 600 }}>
          {announced}
        </p>
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>WCAG scores, live</summary>
          <p style={{ margin: '4px 0 8px', fontSize: '.9em', color: 'var(--theme-elevation-650)' }}>Choose a row to point at that element in the kit. Text needs 4.5:1 (AA) or 7:1 (AAA); buttons, borders and focus rings need 3:1.</p>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                {['Element', 'Light', 'Dark', 'Needs'].map((h) => (
                  <th key={h} scope="col" style={{ textAlign: 'start', padding: '4px 8px', borderBottom: '1px solid var(--theme-elevation-150)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report
                .filter((r) => r.mode === 'light')
                .map((r) => {
                  const dark = report.find((d) => d.mode === 'dark' && d.id === r.id)!
                  const cell = (x: ContrastCheck) => {
                    const g = grade(x)
                    return (
                      <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: g.color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{x.ratio}:1</span> <span>{g.text}</span>
                      </td>
                    )
                  }
                  const on = highlight === r.id
                  return (
                    <tr key={r.id} style={{ background: on ? 'var(--theme-elevation-100)' : undefined }}>
                      <th scope="row" style={{ padding: 0, textAlign: 'start', fontWeight: 400 }}>
                        <button type="button" aria-pressed={on} onClick={() => setHighlight(on ? null : r.id)} style={{ all: 'unset', cursor: 'pointer', display: 'block', padding: '6px 8px', minHeight: 24, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                          {r.pair}
                        </button>
                      </th>
                      {cell(r)}
                      {cell(dark)}
                      <td style={{ padding: '4px 8px' }}>{r.min}:1</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </details>
      </section>

      <section style={box} aria-labelledby={`${id}-io`}>
        <h3 id={`${id}-io`} style={{ margin: '0 0 10px' }}>Import and export</h3>
        <label style={{ display: 'grid', gap: 4 }}>
          Paste a theme (JSON with hex colors)
          <textarea style={{ ...input, minHeight: 90, padding: 10, fontFamily: 'monospace' }} value={imported} onChange={(e) => setImported(e.target.value)} />
        </label>
        <div style={{ ...row, marginTop: 8 }}>
          <button type="button" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }} disabled={!imported.trim()} onClick={() => doImport(imported)}>
            Import
          </button>
          <button type="button" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }} onClick={() => file.current?.click()}>
            Import a file…
          </button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => e.target.files?.[0] && doImport(await e.target.files[0].text())} />
          <button type="button" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }} onClick={async () => { try { await navigator.clipboard.writeText(json); setSaid('Copied the theme as JSON.') } catch { setSaid('Couldn’t copy: select the JSON below and copy it.') } }}>
            Copy JSON
          </button>
          <a className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }} href={`data:application/json;charset=utf-8,${encodeURIComponent(json)}`} download={`${theme.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'theme'}.json`}>
            Download JSON
          </a>
        </div>
        <p role="status" aria-live="polite" style={{ margin: '8px 0 0' }}>{said}</p>
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>Show the JSON</summary>
          <pre style={{ ...input, padding: 10, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>{json}</pre>
        </details>
      </section>
    </div>
  )
}
