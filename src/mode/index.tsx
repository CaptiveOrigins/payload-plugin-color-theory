'use client'

import { createContext, use, useCallback, useEffect, useId, useState, type ReactNode } from 'react'

/**
 * Light and dark mode for a site, to go with its theme. The choice is Auto (follow the device), Light or Dark.
 * It's kept in localStorage (default key `payload-theme`, the one Payload's website template uses, so existing
 * choices carry over) and shown as `data-theme="light|dark"` on <html>, which the theme's CSS reads.
 *
 * - `colorModeScript()` runs before the page draws, so it never flashes the wrong mode.
 * - `ColorModeProvider` and `useColorMode()` give the choice and the mode in effect, and in Auto follow the
 *   device live (switching the computer to dark updates the page without a reload).
 * - `ColorModeSelector` is the Auto / Light / Dark control.
 */
export type ColorMode = 'auto' | 'light' | 'dark'
export type ResolvedMode = 'light' | 'dark'
export type ColorModeOptions = { storageKey?: string; attribute?: string }

const KEY = 'payload-theme'
const ATTR = 'data-theme'
const QUERY = '(prefers-color-scheme: dark)'

/** The script to put in <head> (inline, before anything renders). Sets the attribute from the saved choice or the device. */
export function colorModeScript(o: ColorModeOptions = {}): string {
  const key = JSON.stringify(o.storageKey ?? KEY)
  const attr = JSON.stringify(o.attribute ?? ATTR)
  return `(function(){try{var c=localStorage.getItem(${key});var m=c==='light'||c==='dark'?c:(window.matchMedia&&window.matchMedia('${QUERY}').matches?'dark':'light');document.documentElement.setAttribute(${attr},m)}catch(e){}})();`
}

const systemMode = (): ResolvedMode => (typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches ? 'dark' : 'light')
const readChoice = (key: string): ColorMode => {
  try {
    const c = window.localStorage.getItem(key)
    return c === 'light' || c === 'dark' ? c : 'auto'
  } catch {
    return 'auto'
  }
}

type Ctx = { mode: ColorMode; resolved: ResolvedMode; setMode: (m: ColorMode) => void }
const ColorModeContext = createContext<Ctx>({ mode: 'auto', resolved: 'light', setMode: () => {} })

export function ColorModeProvider({ children, storageKey = KEY, attribute = ATTR }: ColorModeOptions & { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>('auto')
  const [system, setSystem] = useState<ResolvedMode>('light')

  useEffect(() => {
    setModeState(readChoice(storageKey))
    setSystem(systemMode())
    const mql = window.matchMedia?.(QUERY)
    const onChange = () => setSystem(systemMode())
    mql?.addEventListener?.('change', onChange)
    return () => mql?.removeEventListener?.('change', onChange)
  }, [storageKey])

  const resolved: ResolvedMode = mode === 'auto' ? system : mode
  useEffect(() => {
    document.documentElement.setAttribute(attribute, resolved)
  }, [attribute, resolved])

  const setMode = useCallback(
    (m: ColorMode) => {
      try {
        if (m === 'auto') window.localStorage.removeItem(storageKey)
        else window.localStorage.setItem(storageKey, m)
      } catch {
        // Storage may be off: the choice still applies for this visit.
      }
      setModeState(m)
    },
    [storageKey],
  )

  return <ColorModeContext value={{ mode, resolved, setMode }}>{children}</ColorModeContext>
}

/** The visitor's choice (`mode`), the mode in effect (`resolved`), and a way to change it. */
export const useColorMode = () => use(ColorModeContext)

export const COLOR_MODE_TEXT = { label: 'Color mode', auto: 'Auto', light: 'Light', dark: 'Dark' }

/**
 * The Auto / Light / Dark control, as a native select (keyboard and screen-reader friendly).
 * Styling hooks: `ct-mode`, `ct-mode__label`, `ct-mode__select`, `data-mode` and `data-resolved`, plus `className`.
 */
export function ColorModeSelector({ text: textIn, className, hideLabel = false }: { text?: Partial<typeof COLOR_MODE_TEXT>; className?: string; hideLabel?: boolean }) {
  const text = { ...COLOR_MODE_TEXT, ...textIn }
  const { mode, resolved, setMode } = useColorMode()
  const id = useId()
  return (
    <span className={['ct-mode', className].filter(Boolean).join(' ')} data-mode={mode} data-resolved={resolved}>
      <label htmlFor={id} className="ct-mode__label" style={hideLabel ? { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' } : undefined}>
        {text.label}
      </label>
      <select id={id} className="ct-mode__select" value={mode} onChange={(e) => setMode(e.target.value as ColorMode)}>
        <option value="auto">{text.auto}</option>
        <option value="light">{text.light}</option>
        <option value="dark">{text.dark}</option>
      </select>
    </span>
  )
}
