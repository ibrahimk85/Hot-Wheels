"use client"

import { useTheme } from "@/contexts/ThemeContext"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ImageEditor } from "@/components/ImageEditor"
import { ClientOnly } from "@/components/ClientOnly"

export function Topbar() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex items-center justify-between border-b bg-background px-6 py-2">
      <div className="flex items-center">
        <h1 className="text-xl font-semibold">Hot Wheels Koleksiyonum</h1>
      </div>
      <div className="flex items-center justify-end gap-4">
        <ImageEditor />
        <ClientOnly
          fallback={
            <div className="w-[140px] h-10 rounded-md border border-input bg-background px-3 py-2" />
          }
        >
          <Select value={theme} onValueChange={(value) => setTheme(value as "original" | "dark" | "blue" | "amber" | "emerald" | "violet" | "rose" | "cyan")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Tema Seç" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="original">Orijinal</SelectItem>
              <SelectItem value="dark">Koyu</SelectItem>
              <SelectItem value="blue">Mavi</SelectItem>
              <SelectItem value="amber">Turuncu</SelectItem>
              <SelectItem value="emerald">Yeşil</SelectItem>
              <SelectItem value="violet">Mor</SelectItem>
              <SelectItem value="rose">Pembe</SelectItem>
              <SelectItem value="cyan">Turkuaz</SelectItem>
            </SelectContent>
          </Select>
        </ClientOnly>
      </div>
    </div>
  )
}
