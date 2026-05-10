"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, List, Package, Car, Settings, Sparkles, Target, FileText, Trophy, Bot, LayoutDashboard, Users, BarChart3, Database, Calendar, Images } from "lucide-react"
import { cn } from "@/lib/utils"
import { mainNavItems } from "./nav-items"
import { LanguageSelector } from "@/components/LanguageSelector"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  List,
  Package,
  Car,
  Settings,
  Sparkles,
  Target,
  FileText,
  Trophy,
  Bot,
  LayoutDashboard,
  Users,
  BarChart3,
  Database,
  Calendar,
  Images,
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="hidden md:flex h-screen w-64 flex-col border-r bg-sidebar">
      <div className="flex h-[140px] items-start justify-start border-b p-4">
        <Image
          src="/hot-wheels-logo2.png"
          alt="Hot Wheels"
          width={360}
          height={120}
          className="h-[120px] w-[360px] object-contain"
          priority
          unoptimized
        />
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {mainNavItems.map((item) => {
          const Icon = iconMap[item.icon] || Home
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t p-4" suppressHydrationWarning>
        <LanguageSelector />
      </div>
    </div>
  )
}




