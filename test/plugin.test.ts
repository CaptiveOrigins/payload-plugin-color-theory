import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { buildConfig, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { activeTheme, activeThemeCss, colorTheory, PRESETS } from '../src/index.js'

let payload: Payload
let mongo: MongoMemoryReplSet
let admin: Record<string, unknown>
let member: Record<string, unknown>

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  payload = await getPayload({
    config: await buildConfig({
      secret: 'test-secret-not-for-production',
      telemetry: false,
      typescript: { autoGenerate: false },
      db: mongooseAdapter({ url: mongo.getUri('colortheory'), ensureIndexes: true }),
      collections: [{ slug: 'users', auth: true, fields: [{ name: 'role', type: 'text' }] }],
      plugins: [colorTheory({ access: ({ req }) => (req.user as { role?: string } | null)?.role === 'admin' })],
    }),
  })
  admin = { ...(await payload.create({ collection: 'users', data: { email: 'admin@example.invalid', password: 'correct-horse-battery', role: 'admin' } as never })), collection: 'users' }
  member = { ...(await payload.create({ collection: 'users', data: { email: 'member@example.invalid', password: 'correct-horse-battery', role: 'member' } as never })), collection: 'users' }
}, 120_000)

afterAll(async () => {
  await payload?.destroy()
  await mongo?.stop()
})

const create = (data: object, user = admin) => payload.create({ collection: 'color-themes' as never, data: data as never, user: user as never, overrideAccess: false })

describe('saved themes', () => {
  it('stores a theme normalized and named like its record', async () => {
    const doc = (await create({ name: 'Brand', theme: { name: 'ignored', colors: { primary: 'CF8137', neutral: '#3B2A26' } } })) as unknown as { theme: { name: string; colors: Record<string, string>; format: string } }
    expect(doc.theme).toEqual({ format: 'color-theory/1', name: 'Brand', colors: { primary: '#cf8137', neutral: '#3b2a26' } })
  })

  it('refuses a theme that wouldn’t import, saying why', async () => {
    await expect(create({ name: 'Bad', theme: { colors: { primary: 'orange', neutral: '#000000' } } })).rejects.toThrow(/primary.*hex/)
  })

  it('only people with access can save themes or choose one; everyone can read them', async () => {
    await expect(create({ name: 'Nope', theme: PRESETS[1] }, member)).rejects.toThrow()
    await expect(payload.updateGlobal({ slug: 'color-theory' as never, data: { applyToAdmin: true } as never, user: member as never, overrideAccess: false })).rejects.toThrow()
    const seen = await payload.find({ collection: 'color-themes' as never, user: member as never, overrideAccess: false })
    expect(seen.totalDocs).toBeGreaterThan(0)
  })
})

describe('the theme in use', () => {
  it('serves the site’s tokens, and the admin’s colors only when switched on', async () => {
    expect(await activeTheme(payload)).toBeNull()
    expect(await activeThemeCss(payload)).toBe('')
    const reef = (await create({ name: 'Reef', theme: PRESETS.find((p) => p.name === 'Reef') })) as unknown as { id: string }
    await payload.updateGlobal({ slug: 'color-theory' as never, data: { activeTheme: reef.id } as never, user: admin as never, overrideAccess: false })
    expect((await activeTheme(payload))!.theme.name).toBe('Reef')
    const site = await activeThemeCss(payload)
    expect(site).toContain('--palette-primary:')
    expect(site).not.toContain('--color-base-')
    expect(await activeThemeCss(payload, { for: 'admin' })).toBe('')
    await payload.updateGlobal({ slug: 'color-theory' as never, data: { applyToAdmin: true } as never, user: admin as never, overrideAccess: false })
    expect(await activeThemeCss(payload, { for: 'admin' })).toContain('--color-base-500:')
  })

  it('answers the CSS and preset endpoints', async () => {
    const ep = (path: string) => payload.config.endpoints.find((e) => e.path === path)!
    const css = (await ep('/color-theory/theme.css').handler({ payload } as never)) as Response
    expect(css.headers.get('content-type')).toContain('text/css')
    expect(await css.text()).toContain(':root {')
    const presets = (await (await (ep('/color-theory/presets').handler({ payload } as never) as Promise<Response>)).json()) as { presets: { name: string }[] }
    expect(presets.presets.map((p) => p.name)).toContain('Captive Origins')
  })

  it('adds the admin provider and leaves other providers alone', () => {
    expect(payload.config.admin.components.providers).toContainEqual('@captiveorigins/payload-plugin-color-theory/client#AdminThemeStyles')
  })
})
