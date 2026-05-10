// Middleware disabled when using localePrefix: 'never'
// next-intl works with getRequestConfig only in this mode
// This prevents routing conflicts with Next.js App Router
// 
// When localePrefix is 'never', next-intl doesn't need middleware
// because there are no locale segments in the URL.
// The getRequestConfig in src/i18n/request.ts handles locale resolution.

export default function middleware() {
  // No-op middleware - routing handled by getRequestConfig
}

export const config = {
  matcher: [
    // Match nothing - effectively disable middleware
    '/',
  ],
};

