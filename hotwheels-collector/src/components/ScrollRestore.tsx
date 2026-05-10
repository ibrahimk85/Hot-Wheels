'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const SCROLL_POSITION_KEY_PREFIX = 'models-scroll-position-';

export function ScrollRestore() {
  const pathname = usePathname();

  useEffect(() => {
    // Restore scroll position for any models page
    if (pathname.startsWith('/models')) {
      const key = SCROLL_POSITION_KEY_PREFIX + pathname;
      const savedPosition = sessionStorage.getItem(key);
      if (savedPosition) {
        // Use setTimeout to ensure the page has rendered
        setTimeout(() => {
          window.scrollTo(0, parseInt(savedPosition, 10));
          sessionStorage.removeItem(key);
        }, 100);
      }
    }
  }, [pathname]);

  return null;
}

export function saveScrollPosition(pathname?: string) {
  if (typeof window !== 'undefined') {
    const currentPath = pathname || window.location.pathname;
    if (currentPath.startsWith('/models')) {
      const key = SCROLL_POSITION_KEY_PREFIX + currentPath;
      sessionStorage.setItem(key, window.scrollY.toString());
    }
  }
}








