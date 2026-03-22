'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'

const DynamicProviders = dynamic(() => import('./providers-client'), {
  ssr: false,
})

export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <DynamicProviders>
      {children}
    </DynamicProviders>
  )
}
