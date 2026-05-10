import type { Metadata } from "next";
import "@/app/globals.css";
import { ReactNode } from "react";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { DashboardShell } from "@/ui/layout/DashboardShell";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Providers } from "@/components/providers";
import { defaultLocale } from '@/i18n/config';
import { validateEnv } from '@/lib/env';

// Validate environment variables on app startup (skip strict failure during `next build`)
const isNextProductionBuild =
  process.env.NEXT_PHASE === 'phase-production-build';

if (typeof window === 'undefined') {
  try {
    validateEnv();
  } catch (error) {
    console.error('Environment validation failed:', error);
    const failHard =
      process.env.NODE_ENV === 'production' && !isNextProductionBuild;
    if (failHard) {
      throw error;
    }
  }
}

export const metadata: Metadata = {
  title: "Hot Wheels Koleksiyonum",
  description: "Hot Wheels koleksiyon yönetim uygulaması",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HW Collector",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#000000",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Load messages directly since middleware is disabled
  let messages;
  try {
    messages = (await import(`../../messages/${defaultLocale}.json`)).default;
  } catch (error) {
    // If import fails, use empty object
    messages = {};
  }
  
  return (
    <html lang={defaultLocale} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme') || 'original';
                  const validThemes = ['original', 'dark', 'blue', 'amber', 'emerald', 'violet', 'rose', 'cyan'];
                  if (validThemes.includes(theme)) {
                    document.documentElement.classList.remove('theme-original', 'theme-dark', 'theme-blue', 'theme-amber', 'theme-emerald', 'theme-violet', 'theme-rose', 'theme-cyan');
                    document.documentElement.classList.add('theme-' + theme);
                  } else {
                    document.documentElement.classList.add('theme-original');
                  }
                } catch (e) {
                  document.documentElement.classList.add('theme-original');
                }
              })();
            `,
          }}
        />
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <ThemeProvider>
              <DashboardShell>
                {children}
              </DashboardShell>
            </ThemeProvider>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
