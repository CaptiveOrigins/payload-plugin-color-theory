/**
 * The no-flash script for light and dark mode. A plain module (not a client one), so a server layout can call
 * `colorModeScript()` and inline the result in <head>.
 */
export type ColorModeOptions = { storageKey?: string; attribute?: string }

export const KEY = 'payload-theme'
export const ATTR = 'data-theme'
export const QUERY = '(prefers-color-scheme: dark)'

/** The script to put in <head> (inline, before anything renders). Sets the attribute from the saved choice or the device. */
export function colorModeScript(o: ColorModeOptions = {}): string {
  const key = JSON.stringify(o.storageKey ?? KEY)
  const attr = JSON.stringify(o.attribute ?? ATTR)
  return `(function(){try{var c=localStorage.getItem(${key});var m=c==='light'||c==='dark'?c:(window.matchMedia&&window.matchMedia('${QUERY}').matches?'dark':'light');document.documentElement.setAttribute(${attr},m)}catch(e){}})();`
}

