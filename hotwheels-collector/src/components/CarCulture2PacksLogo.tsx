'use client';

import Image from 'next/image';
import { useState } from 'react';

export function CarCulture2PacksLogo() {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    return (
      <div className="flex items-center justify-center min-h-[120px]">
        <div className="text-center text-muted-foreground text-sm">
          Car Culture 2-Packs Logo
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="relative w-full h-32">
        <Image
          src="/2-packs.jpg"
          alt="Hot Wheels Car Culture 2-Packs"
          fill
          className="object-contain"
          unoptimized
          onError={() => setImageError(true)}
        />
      </div>
    </div>
  );
}
