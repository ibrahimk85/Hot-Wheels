"use client"

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react"

type Theme = "original" | "dark" | "blue" | "amber" | "emerald" | "violet" | "rose" | "cyan"

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// Tema uygulama fonksiyonu
function applyTheme(newTheme: Theme) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  // Tüm tema sınıflarını kaldır
  root.classList.remove(
    "theme-original",
    "theme-dark",
    "theme-blue",
    "theme-amber",
    "theme-emerald",
    "theme-violet",
    "theme-rose",
    "theme-cyan"
  )
  // Yeni tema sınıfını ekle
  root.classList.add(`theme-${newTheme}`)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("original")

  useEffect(() => {
    // localStorage'dan tema tercihini yükle
    const savedTheme = localStorage.getItem("theme") as Theme | null
    const validThemes: Theme[] = [
      "original",
      "dark",
      "blue",
      "amber",
      "emerald",
      "violet",
      "rose",
      "cyan",
    ]
    if (savedTheme && validThemes.includes(savedTheme)) {
      setThemeState(savedTheme)
      applyTheme(savedTheme)
    } else {
      applyTheme("original")
    }
  }, [])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem("theme", newTheme)
    applyTheme(newTheme)
  }, [])

  // Provider'ı her zaman render et, sadece tema değerini mounted olduktan sonra güncelle
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}








