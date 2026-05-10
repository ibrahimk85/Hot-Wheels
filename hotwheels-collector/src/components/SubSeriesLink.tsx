'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { saveScrollPosition } from './ScrollRestore';

interface SubSeriesLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function SubSeriesLink({ href, children, className }: SubSeriesLinkProps) {
  const pathname = usePathname();

  const handleClick = () => {
    // Save scroll position before navigating
    saveScrollPosition(pathname);
  };

  return (
    <Link href={href} onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}








