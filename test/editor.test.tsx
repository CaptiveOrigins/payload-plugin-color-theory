// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { contrastReport, PRESETS, type Theme } from '../src/core/index.js'

// The editor is a Payload field; here its value lives in plain React state, and the last value is kept to check.
let current: Theme | undefined
vi.mock('@payloadcms/ui', () => ({
  useField: () => {
    const [value, setValue] = useState<Theme | undefined>(current)
    return { value, setValue: (v: Theme) => ((current = v), setValue(v)), errorMessage: undefined, showError: false }
  },
}))
const { ThemeEditor } = await import('../src/client/ThemeEditor.js')

afterEach(() => (cleanup(), vi.useRealTimers()))
const co = PRESETS.find((p) => p.name === 'Captive Origins')!
const pale: Theme = { format: 'color-theory/1', name: 'Pale', colors: { primary: '#f5c99b', neutral: '#3b2a26' }, accessibility: 'exact' }

describe('the theme editor', () => {
  it('shows the kit in light and dark with no warnings when everything passes, and the WCAG table starts closed', () => {
    current = co
    render(<ThemeEditor path="theme" />)
    expect(screen.getByRole('figure', { name: 'Light mode' })).toBeTruthy()
    expect(screen.getByRole('figure', { name: 'Dark mode' })).toBeTruthy()
    expect(screen.queryAllByRole('button', { name: /Contrast too low/ })).toHaveLength(0)
    expect((screen.getByText('WCAG scores, live').closest('details') as HTMLDetailsElement).open).toBe(false)
  })

  it('marks failing elements with a warning that offers a passing color, and "Use this" applies it without blocking', () => {
    current = pale
    render(<ThemeEditor path="theme" />)
    const warnings = screen.getAllByRole('button', { name: /Contrast too low/ })
    expect(warnings.length).toBeGreaterThan(0)
    const link = warnings.find((w) => /Links on the page/.test(w.getAttribute('aria-label')!))!
    fireEvent.click(link)
    const dialog = screen.getByRole('dialog', { name: 'Contrast suggestion' })
    const expected = contrastReport(pale).find((c) => c.id === 'links-page' && c.mode === 'light')!.suggest!
    expect(dialog.textContent).toContain(expected)
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Use this' })[0]!)
    expect(current!.colors.primary).toBe(expected)
    expect(current!.accessibility).toBe('exact') // still their colors: nothing else moved
    const after = contrastReport(current!).find((c) => c.id === 'links-page' && c.mode === 'light')!
    expect(after.pass).toBe(true)
  })

  it('closes the suggestion with Escape', () => {
    current = pale
    render(<ThemeEditor path="theme" />)
    fireEvent.click(screen.getAllByRole('button', { name: /Contrast too low/ })[0]!)
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('table rows show ratio and grade in words, and choosing one highlights that element in the kit', () => {
    current = pale
    const { container } = render(<ThemeEditor path="theme" />)
    const row = screen.getByRole('button', { name: 'Links on the page' })
    expect(row.closest('tr')!.textContent).toMatch(/Fails/)
    fireEvent.click(row)
    expect(row.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelectorAll('[data-highlighted]').length).toBe(2) // light and dark
  })

  it('the intensity slider and the accessibility switch change the theme', () => {
    current = co
    render(<ThemeEditor path="theme" />)
    fireEvent.change(screen.getByLabelText('How much of the site carries the brand colors'), { target: { value: '1' } })
    expect(current!.intensity?.level).toBe('subtle')
    expect(screen.getByText(/Subtle:/).parentElement!.textContent).toContain('button fills')
    fireEvent.change(screen.getByLabelText('Card bands'), { target: { value: 'on' } })
    expect(current!.intensity?.groups).toEqual({ bands: 'on' })
    fireEvent.click(screen.getByLabelText(/Use my exact colors/))
    expect(current!.accessibility).toBe('exact')
    fireEvent.click(screen.getByLabelText(/Adjust colors for accessibility/))
    expect(current!.accessibility).toBeUndefined()
  })

  it('announces the result once the person pauses, politely', () => {
    vi.useFakeTimers()
    current = pale
    render(<ThemeEditor path="theme" />)
    const status = screen.getAllByRole('status').find((s) => s.getAttribute('aria-live') === 'polite')!
    expect(status.textContent).toBe('')
    act(() => vi.advanceTimersByTime(1000))
    expect(status.textContent).toMatch(/contrast checks? falls? short of WCAG AA/)
  })
})
