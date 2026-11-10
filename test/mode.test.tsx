// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ColorModeProvider, ColorModeSelector, useColorMode } from '../src/mode/index.js'
import { colorModeScript } from '../src/mode/script.js'

/** A controllable stand-in for the device's light or dark setting. */
let dark = false
const listeners = new Set<() => void>()
beforeEach(() => {
  dark = false
  listeners.clear()
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  window.matchMedia = ((q: string) => ({
    get matches() {
      return q.includes('dark') ? dark : false
    },
    media: q,
    addEventListener: (_: string, f: () => void) => listeners.add(f),
    removeEventListener: (_: string, f: () => void) => listeners.delete(f),
  })) as never
})
afterEach(cleanup)
const deviceGoes = (d: boolean) => act(() => ((dark = d), listeners.forEach((f) => f())))

describe('the no-flash script', () => {
  it('is importable outside client code: its module has no "use client"', async () => {
    const { readFileSync } = await import('node:fs')
    expect(readFileSync(`${process.cwd()}/src/mode/script.ts`, 'utf8')).not.toMatch(/^['"]use client['"]/m)
    expect((await import('../src/index.js')).colorModeScript).toBe(colorModeScript)
  })

  it('uses a saved choice, else the device, and keeps the template’s storage key', () => {
    new Function(colorModeScript())()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    dark = true
    new Function(colorModeScript())()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    window.localStorage.setItem('payload-theme', 'light')
    new Function(colorModeScript())()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('never throws, even with storage blocked', () => {
    const real = window.localStorage
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new Error('blocked') } })
    expect(() => new Function(colorModeScript())()).not.toThrow()
    Object.defineProperty(window, 'localStorage', { configurable: true, value: real })
  })
})

describe('choosing a mode', () => {
  function Shown() {
    const { mode, resolved } = useColorMode()
    return <output>{`${mode}/${resolved}`}</output>
  }
  const app = () =>
    render(
      <ColorModeProvider>
        <ColorModeSelector />
        <Shown />
      </ColorModeProvider>,
    )

  it('Auto follows the device, live', async () => {
    app()
    expect(screen.getByRole('status').textContent).toBe('auto/light')
    await deviceGoes(true)
    expect(screen.getByRole('status').textContent).toBe('auto/dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('a choice sticks, is saved, and ignores the device; Auto clears it', async () => {
    app()
    fireEvent.change(screen.getByLabelText('Color mode'), { target: { value: 'dark' } })
    expect(window.localStorage.getItem('payload-theme')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    await deviceGoes(false)
    expect(screen.getByRole('status').textContent).toBe('dark/dark')
    fireEvent.change(screen.getByLabelText('Color mode'), { target: { value: 'auto' } })
    expect(window.localStorage.getItem('payload-theme')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('auto/light')
  })

  it('reads a choice saved earlier, and labels can be translated', () => {
    window.localStorage.setItem('payload-theme', 'dark')
    render(
      <ColorModeProvider>
        <ColorModeSelector text={{ label: 'Farbmodus', auto: 'Automatisch', light: 'Hell', dark: 'Dunkel' }} />
      </ColorModeProvider>,
    )
    const select = screen.getByLabelText('Farbmodus') as HTMLSelectElement
    expect(select.value).toBe('dark')
    expect(screen.getByRole('option', { name: 'Automatisch' })).toBeTruthy()
  })
})
