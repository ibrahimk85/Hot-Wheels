"use client"

import { ReactNode } from "react"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"
import { MobileNavigation } from "@/components/MobileNavigation"

interface DashboardShellProps {
  children: ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col w-0">
        <Topbar />
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          <div className="mx-auto max-w-7xl p-4 md:p-6">
            {children}
          </div>
        </main>
        <MobileNavigation />
      </div>
    </div>
  )
}




