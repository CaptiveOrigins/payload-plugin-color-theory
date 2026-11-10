'use client'

import { useConfig } from '@payloadcms/ui'
import type { ReactNode } from 'react'

/** Admin provider: links the theme's admin CSS (empty unless "Use it in the admin" is on). */
export function AdminThemeStyles({ children }: { children?: ReactNode }) {
  const { config } = useConfig()
  return (
    <>
      <link rel="stylesheet" href={`${config.serverURL ?? ''}${config.routes.api}/color-theory/admin.css`} />
      {children}
    </>
  )
}
