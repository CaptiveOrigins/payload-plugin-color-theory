'use client'

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'

import type { ContrastCheck, ThemeColors } from '../core/index.js'

type Mode = 'light' | 'dark'
export type UseColor = (role: keyof ThemeColors, hex: string) => void

const ROLE_NAMES: Record<keyof ThemeColors, string> = { primary: 'primary', secondary: 'secondary', accent: 'accent', neutral: 'neutral', success: 'success', warning: 'warning', error: 'error' }

/** A small warning button over an element whose contrast fails, with the nearest passing color and "Use this". Never blocks. */
function Warning({ fails, onUse }: { fails: ContrastCheck[]; onUse: UseColor }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: KeyboardEvent | MouseEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', close)
    document.addEventListener('mousedown', close)
    return () => (document.removeEventListener('keydown', close), document.removeEventListener('mousedown', close))
  }, [open])
  const label = `Contrast too low: ${fails.map((f) => `${f.pair} ${f.ratio}:1, needs ${f.min}:1`).join('; ')}`
  return (
    <span ref={ref} className="ct-warning" style={{ position: 'absolute', insetBlockStart: -10, insetInlineEnd: -10, zIndex: 2 }}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        style={{ width: 24, height: 24, borderRadius: 999, border: '2px solid #fff', background: '#b42318', color: '#fff', font: '700 14px/1 system-ui', cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.4)' }}
      >
        !
      </button>
      {open ? (
        <span id={id} role="dialog" aria-label="Contrast suggestion" style={{ position: 'absolute', insetBlockStart: 28, insetInlineEnd: 0, width: 260, padding: 10, borderRadius: 8, background: 'var(--theme-elevation-0, #fff)', color: 'var(--theme-text, #111)', border: '1px solid var(--theme-elevation-250, #aaa)', boxShadow: '0 6px 20px rgba(0,0,0,.25)', display: 'grid', gap: 8, fontSize: 13, fontWeight: 400, textAlign: 'start' }}>
          {fails.map((f) => (
            <span key={f.id} style={{ display: 'grid', gap: 6 }}>
              <span>
                <strong>{f.pair}</strong>: {f.ratio}:1, needs {f.min}:1.
              </span>
              {f.suggest && f.role ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 4, background: f.suggest, border: '1px solid rgba(0,0,0,.3)' }} />
                  <span>
                    Better for accessibility: <code>{f.suggest}</code> as the {ROLE_NAMES[f.role]} color.
                  </span>
                  <button type="button" className="btn btn--style-primary btn--size-small" style={{ margin: 0 }} onClick={() => (onUse(f.role!, f.suggest!), setOpen(false))}>
                    Use this
                  </button>
                </span>
              ) : (
                <span>No single color change fixes this one; try a different {f.role ? ROLE_NAMES[f.role] : 'neutral'} color.</span>
              )}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  )
}

/** One element of the kit: highlighted when its table row is picked, with a warning when one of its pairs fails. */
function Spot({ pairs, mode, report, highlight, onUse, children, style }: { pairs: string[]; mode: Mode; report: ContrastCheck[]; highlight: string | null; onUse: UseColor; children: ReactNode; style?: CSSProperties }) {
  const fails = report.filter((r) => r.mode === mode && !r.pass && pairs.includes(r.id))
  const lit = highlight !== null && pairs.includes(highlight)
  return (
    <span data-pairs={pairs.join(' ')} data-highlighted={lit || undefined} style={{ position: 'relative', display: 'inline-block', borderRadius: 6, outline: lit ? '3px dashed #2563eb' : undefined, outlineOffset: 3, ...style }}>
      {children}
      {fails.length ? <Warning fails={fails} onUse={onUse} /> : null}
    </span>
  )
}

/** The theme drawn as a small site, for one mode. Every color comes from the theme's tokens. */
export function UiKit({ v, mode, report, highlight, onUse }: { v: Record<string, string>; mode: Mode; report: ContrastCheck[]; highlight: string | null; onUse: UseColor }) {
  const s = (k: string) => v[`--palette-${k}`]
  const sp = (pairs: string[], children: ReactNode, style?: CSSProperties) => (
    <Spot pairs={pairs} mode={mode} report={report} highlight={highlight} onUse={onUse} style={style}>
      {children}
    </Spot>
  )
  const r = { md: v['--palette-radius-md'], lg: v['--palette-radius-lg'] }
  const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 36, padding: '0 14px', borderRadius: r.md, fontWeight: 600, font: 'inherit' }
  const badge = (bg: string, fg: string): CSSProperties => ({ display: 'inline-block', background: s(bg), color: s(fg), borderRadius: 999, padding: '2px 10px', fontSize: '.85em', fontWeight: 600 })
  return (
    <figure aria-label={`${mode === 'light' ? 'Light' : 'Dark'} mode`} style={{ margin: 0, flex: '1 1 320px', minWidth: 0, background: s('surface'), color: s('text'), borderRadius: r.lg, border: `1px solid ${s('border')}`, overflow: 'visible' }}>
      <figcaption style={{ padding: '8px 14px', fontWeight: 600, fontSize: '.85em', color: s('text-muted') }}>{mode === 'light' ? 'Light' : 'Dark'}</figcaption>
      {sp(
        ['header', 'button'],
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: s('header'), color: s('on-header'), borderBlockEnd: `4px solid ${s('header-rule')}` }}>
          <strong>Site name</strong>
          <span style={{ marginInlineStart: 'auto', fontSize: '.9em' }}>Learn · About</span>
          <span style={{ ...btn, background: s('button'), color: s('on-button') }}>Support</span>
        </header>,
        { display: 'block' },
      )}
      <div style={{ padding: '14px', background: s('wash') }}>
        <p style={{ margin: '0 0 4px', fontSize: '1.15em', fontWeight: 700 }}>{sp(['text-page'], <>A page intro</>)}</p>
        <p style={{ margin: '0 0 10px', color: s('text-muted') }}>{sp(['muted-page'], <>Muted text, and </>)} {sp(['links-page'], <span style={{ color: s('link'), textDecoration: 'underline' }}>a link</span>)}.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {sp(['button', 'focus'], <span style={{ ...btn, background: s('button'), color: s('on-button'), outline: `2px solid ${s('focus')}`, outlineOffset: 2 }}>Main button</span>)}
          {sp(['secondary-outline'], <span style={{ ...btn, color: s('secondary-text'), boxShadow: `inset 0 0 0 1.5px ${s('secondary-text')}` }}>Secondary</span>)}
          {sp(['secondary-fill'], <span style={{ ...btn, background: s('secondary'), color: s('on-secondary') }}>Second fill</span>)}
          {sp(['accent-fill'], <span style={{ ...btn, background: s('accent'), color: s('on-accent') }}>Accent</span>)}
        </div>
      </div>
      <div style={{ padding: 14, display: 'grid', gap: 12 }}>
        {sp(
          ['text-cards', 'muted-cards', 'links-cards'],
          <article style={{ background: s('surface-raised'), border: `1px solid ${s('border')}`, borderRadius: r.lg, overflow: 'hidden' }}>
            <div style={{ height: 6, background: s('band') }} />
            <div style={{ padding: 12 }}>
              <p style={{ margin: '0 0 2px', fontWeight: 650 }}>A card</p>
              <p style={{ margin: '0 0 8px', color: s('text-muted'), fontSize: '.9em' }}>
                Card text with <span style={{ color: s('link'), textDecoration: 'underline' }}>a link</span>.
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {sp(['badge-primary'], <span style={badge('badge-primary', 'on-badge-primary')}>Group</span>)}
                {sp(['badge-secondary'], <span style={badge('badge-secondary', 'on-badge-secondary')}>Status</span>)}
                {sp(['badge-accent'], <span style={badge('badge-accent', 'on-badge-accent')}>Tag</span>)}
                {sp(['success-badge'], <span style={badge('success-soft', 'success-text')}>Done</span>)}
                {sp(['warning-badge'], <span style={badge('warning-soft', 'warning-text')}>Careful</span>)}
              </div>
            </div>
          </article>,
          { display: 'block' },
        )}
        {sp(
          ['field-border', 'error-text'],
          <span style={{ display: 'grid', gap: 4, fontSize: '.9em' }}>
            <span style={{ fontWeight: 600 }}>A form field</span>
            <span style={{ display: 'block', minHeight: 34, borderRadius: r.md, border: `1px solid ${s('text-muted')}`, background: s('surface-raised'), padding: '6px 10px', color: s('text-muted') }}>Placeholder</span>
            <span style={{ color: s('error-text') }}>Error message under a field.</span>
          </span>,
          { display: 'block' },
        )}
        {sp(
          ['error-badge'],
          <span role="presentation" style={{ display: 'block', background: s('error-soft'), color: s('error-text'), borderRadius: r.md, padding: '8px 12px', fontSize: '.9em' }}>
            An alert: something needs attention.
          </span>,
          { display: 'block' },
        )}
      </div>
    </figure>
  )
}
