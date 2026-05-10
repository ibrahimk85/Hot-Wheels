'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { saveScrollPosition } from './ScrollRestore';

export function BackToModelsButton() {
  const handleClick = () => {
    // Save current scroll position before navigating
    if (typeof window !== 'undefined') {
      saveScrollPosition();
    }
  };

  return (
    <Button variant="outline" asChild>
      <Link href="/models" onClick={handleClick}>
        ← Modeller sayfasına dön
      </Link>
    </Button>
  );
}
