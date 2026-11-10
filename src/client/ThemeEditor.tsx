'use client'

import { useField } from '@payloadcms/ui'
import { useId, useMemo, useRef, useState, type CSSProperties } from 'react'

import { contrastReport, exportTheme, hexToOklch, isHex, parseTheme, PRESETS, SCHEMES, themeFromHarmony, tokens, type Scheme, type Theme, type ThemeColors } from '../core/index.js'

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

/** One mode's preview, drawn only from the theme's tokens. */
function Preview({ v, label }: { v: Record<string, string>; label: string }) {
  const s = (k: string) => v[`--palette-${k}`]
  const btn = (role: string): CSSProperties => ({ background: s(role), color: s(`on-${role}`), border: 0, borderRadius: v['--palette-radius-md'], padding: '8px 14px', font: 'inherit', fontWeight: 600 })
  return (
    <figure style={{ margin: 0, background: s('surface'), color: s('text'), borderRadius: v['--palette-radius-lg'], padding: 16, border: `1px solid ${s('border')}`, flex: '1 1 260px' }}>
      <figcaption style={{ fontWeight: 600, marginBottom: 8 }}>{label}</figcaption>
      <div style={{ background: s('surface-raised'), border: `1px solid ${s('border')}`, borderRadius: v['--palette-radius-lg'], padding: 12 }}>
        <p style={{ margin: '0 0 4px', fontWeight: 650 }}>Red-footed tortoise</p>
        <p style={{ margin: '0 0 10px', color: s('text-muted') }}>
          Muted text, and <span style={{ color: s('link'), textDecoration: 'underline' }}>a link</span>.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={btn('primary')}>Primary</span>
          <span style={btn('secondary')}>Secondary</span>
          <span style={btn('accent')}>Accent</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {['success', 'warning', 'error'].map((r) => (
            <span key={r} style={{ background: s(`${r}-soft`), color: s(`${r}-text`), borderRadius: 999, padding: '2px 10px', fontSize: '.9em' }}>
              {r}
            </span>
          ))}
        </div>
      </div>
    </figure>
  )
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
  const set = (t: Theme) => (setValue(t), setSaid(''))
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

      <section style={box} aria-labelledby={`${id}-preview`}>
        <h3 id={`${id}-preview`} style={{ margin: '0 0 10px' }}>Preview</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Preview v={tk.light} label="Light" />
          <Preview v={tk.dark} label="Dark" />
        </div>
      </section>

      <section style={box} aria-labelledby={`${id}-contrast`}>
        <h3 id={`${id}-contrast`} style={{ margin: '0 0 6px' }}>Contrast</h3>
        <p role="status" style={{ margin: '0 0 8px' }}>{fails.length ? `${fails.length} pairs fall short of WCAG AA.` : 'Every pair passes WCAG AA, in light and dark.'}</p>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {['Pair', 'Light', 'Dark', 'Needs'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--theme-elevation-150)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report
              .filter((r) => r.mode === 'light')
              .map((r) => {
                const dark = report.find((d) => d.mode === 'dark' && d.pair === r.pair)!
                const cell = (x: typeof r) => `${x.ratio}:1 ${x.pass ? '✓ passes' : '✗ too low'}`
                return (
                  <tr key={r.pair}>
                    <td style={{ padding: '4px 8px' }}>{r.pair}</td>
                    <td style={{ padding: '4px 8px' }}>{cell(r)}</td>
                    <td style={{ padding: '4px 8px' }}>{cell(dark)}</td>
                    <td style={{ padding: '4px 8px' }}>{r.min}:1</td>
                  </tr>
                )
              })}
          </tbody>
        </table>
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
