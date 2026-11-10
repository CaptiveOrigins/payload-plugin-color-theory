import { createHash } from 'node:crypto'

import { APIError, type Access, type CollectionConfig, type Config, type Endpoint, type GlobalConfig, type Payload, type Plugin } from 'payload'

import { parseTheme, PRESETS, themeCss, type Theme } from './core/index.js'

export type ColorTheoryOptions = {
  /** Who may create, change and choose themes. Required: nobody by default. Everyone may read them (they're colors). */
  access: Access
  /** Admin group for the collection and global. */
  adminGroup?: string
  /** The site's dark-mode selector. Default `[data-theme='dark']`, which Payload's admin also uses. */
  darkSelector?: string
}

const THEMES = 'color-themes'
const SETTINGS = 'color-theory'

function themesCollection(o: ColorTheoryOptions): CollectionConfig {
  return {
    slug: THEMES,
    labels: { singular: 'Color theme', plural: 'Color themes' },
    admin: { useAsTitle: 'name', group: o.adminGroup, defaultColumns: ['name', 'updatedAt'], description: 'Themes built from color harmonies. Choose the one in use under Color theory.' },
    access: { read: () => true, create: o.access, update: o.access, delete: o.access },
    fields: [
      { name: 'name', type: 'text', required: true, maxLength: 80 },
      {
        name: 'theme',
        type: 'json',
        required: true,
        admin: { components: { Field: '@captiveorigins/payload-plugin-color-theory/client#ThemeEditor' } },
        validate: (value: unknown) => {
          const { problems } = parseTheme(value)
          return problems.length ? problems.join(' ') : true
        },
      },
    ],
    hooks: {
      beforeChange: [
        ({ data }) => {
          // Store the theme exactly as import reads it (normalized hex, known fields only), named like the record.
          const { theme, problems } = parseTheme({ ...(data.theme as object), name: data.name ?? (data.theme as { name?: string })?.name })
          if (!theme) throw new APIError(problems.join(' '), 400, null, true)
          return { ...data, name: theme.name, theme }
        },
      ],
    },
  }
}

function settingsGlobal(o: ColorTheoryOptions): GlobalConfig {
  return {
    slug: SETTINGS,
    label: 'Color theory',
    admin: { group: o.adminGroup, description: 'The theme in use, and where it applies.' },
    access: { read: () => true, update: o.access },
    fields: [
      { name: 'activeTheme', label: 'Theme in use', type: 'relationship', relationTo: THEMES as never },
      { name: 'applyToSite', label: 'Use it on the site', type: 'checkbox', defaultValue: true },
      { name: 'applyToAdmin', label: 'Use it in the admin', type: 'checkbox', defaultValue: false, admin: { description: 'Payload’s own colors (grays, success, warning, error), in light and dark.' } },
    ],
  }
}

/** The theme in use, or null. */
export async function activeTheme(payload: Payload): Promise<{ theme: Theme; applyToSite: boolean; applyToAdmin: boolean } | null> {
  const s = (await payload.findGlobal({ slug: SETTINGS as never, depth: 1, overrideAccess: true })) as unknown as { activeTheme?: { theme?: unknown } | string | null; applyToSite?: boolean; applyToAdmin?: boolean }
  const doc = s.activeTheme && typeof s.activeTheme === 'object' ? s.activeTheme : null
  const { theme } = parseTheme(doc?.theme)
  return theme ? { theme, applyToSite: s.applyToSite !== false, applyToAdmin: Boolean(s.applyToAdmin) } : null
}

/** CSS for the theme in use: the site's `--palette-*` tokens and/or Payload's admin colors. Empty when nothing applies. */
export async function activeThemeCss(payload: Payload, o: Pick<ColorTheoryOptions, 'darkSelector'> & { for?: 'site' | 'admin' } = {}): Promise<string> {
  const a = await activeTheme(payload)
  if (!a) return ''
  if (o.for === 'admin') return a.applyToAdmin ? themeCss(a.theme, { darkSelector: o.darkSelector, admin: true }) : ''
  return a.applyToSite ? themeCss(a.theme, { darkSelector: o.darkSelector }) : ''
}

/**
 * Color Theory for Payload: saved themes, the one in use, and its CSS for the site (`--palette-*`) and for
 * Payload's admin (`--color-*`, the variables Payload is themed with).
 */
export const colorTheory =
  (o: ColorTheoryOptions): Plugin =>
  (config: Config): Config => {
    const css = (forWhat: 'site' | 'admin'): Endpoint => ({
      path: forWhat === 'site' ? '/color-theory/theme.css' : '/color-theory/admin.css',
      method: 'get',
      handler: async (req) => {
        const body = await activeThemeCss(req.payload, { darkSelector: o.darkSelector, for: forWhat })
        const etag = `"${createHash('sha1').update(body).digest('base64url')}"`
        const headers = { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-cache', etag }
        if (req.headers?.get?.('if-none-match') === etag) return new Response(null, { status: 304, headers })
        return new Response(body, { headers })
      },
    })
    const presets: Endpoint = { path: '/color-theory/presets', method: 'get', handler: async () => Response.json({ presets: PRESETS }) }
    const admin = config.admin ?? {}
    return {
      ...config,
      collections: [...(config.collections ?? []), themesCollection(o)],
      globals: [...(config.globals ?? []), settingsGlobal(o)],
      endpoints: [...(config.endpoints ?? []), css('site'), css('admin'), presets],
      admin: { ...admin, components: { ...admin.components, providers: [...(admin.components?.providers ?? []), '@captiveorigins/payload-plugin-color-theory/client#AdminThemeStyles'] } },
    }
  }
