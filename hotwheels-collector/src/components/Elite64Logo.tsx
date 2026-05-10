'use client';

import Image from 'next/image';
import { useState } from 'react';

export function Elite64Logo() {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    return (
      <div className="flex items-center justify-center min-h-[120px]">
        <div className="text-center text-muted-foreground text-sm">
          Elite 64 Logo
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="relative w-full h-32">
        <Image
          src="/elite64.png"
          alt="Hot Wheels Elite 64"
          fill
          className="object-contain"
          unoptimized
          onError={() => setImageError(true)}
        />
      </div>
    </div>
  );
}

















