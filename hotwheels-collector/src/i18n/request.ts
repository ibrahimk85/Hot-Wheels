import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, locales } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
  // Always use default locale since we're not using locale segments
  let locale: typeof defaultLocale = defaultLocale;

  // Try to get locale from request if available
  try {
    const requestedLocale = await requestLocale;
    if (requestedLocale && locales.includes(requestedLocale as typeof defaultLocale)) {
      locale = requestedLocale as typeof defaultLocale;
    }
  } catch (error) {
    // If requestLocale fails, use default
    locale = defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

