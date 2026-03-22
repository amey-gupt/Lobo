'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { Analytics } from '@vercel/analytics/next'

export default function ProvidersClient({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      storageKey="theme"
      suppressHydrationWarning
    >
      {children}
      <Toaster richColors position="top-center" />
      <Analytics />
    </NextThemesProvider>
  )
}
