"use client"

import { useEffect, useState } from "react"

/** True after the first client commit. Server and the first client render stay false so they match. */
export function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  return mounted
}
