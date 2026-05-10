'use client';

import Image from 'next/image';
import { useState } from 'react';

export function BoulevardLogo() {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    return (
      <div className="flex items-center justify-center min-h-[120px]">
        <div className="text-center text-muted-foreground text-sm">
          Boulevard Logo
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="relative w-full h-32">
        <Image
          src="/boulevard-logo.png"
          alt="Hot Wheels Boulevard"
          fill
          className="object-contain"
          unoptimized
          onError={() => setImageError(true)}
        />
      </div>
    </div>
  );
}

