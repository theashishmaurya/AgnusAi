import { useEffect, useState } from 'react'

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem('agnus-theme')
    return stored === null ? true : stored === 'dark'
  })

  useEffect(() => {
    const html = document.documentElement
    isDark
      ? html.setAttribute('data-theme', 'dark')
      : html.removeAttribute('data-theme')
    localStorage.setItem('agnus-theme', isDark ? 'dark' : 'light')
  }, [isDark])

  // Sync from storage on mount (handles external changes)
  useEffect(() => {
    if (localStorage.getItem('agnus-theme') === 'dark') setIsDark(true)
  }, [])

  return { isDark, toggle: () => setIsDark(d => !d) }
}
