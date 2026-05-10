'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { locales, localeNames, type Locale, defaultLocale } from '@/i18n/config';
import { Languages } from 'lucide-react';
import { useState, useEffect } from 'react';

export function LanguageSelector() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLanguageChange = (newLocale: string) => {
    // Store locale preference
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', newLocale);
    }
    
    // Reload page to apply new locale
    const pathWithoutLocale = pathname.replace(/^\/(tr|en)/, '') || '/';
    const newPath = newLocale === defaultLocale 
      ? pathWithoutLocale 
      : `/${newLocale}${pathWithoutLocale}`;
    
    window.location.href = newPath;
  };

  // Prevent hydration mismatch by only rendering on client
  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <Languages className="h-4 w-4 text-muted-foreground" />
        <div className="w-[140px] h-10 rounded-md border border-input bg-background" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2" suppressHydrationWarning>
      <Languages className="h-4 w-4 text-muted-foreground" />
      <Select value={locale} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-[140px]" suppressHydrationWarning>
          <SelectValue placeholder="Dil Seç" />
        </SelectTrigger>
        <SelectContent>
          {locales.map((loc) => (
            <SelectItem key={loc} value={loc}>
              {localeNames[loc]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

