'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { saveScrollPosition } from './ScrollRestore';

interface ModelLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function ModelLink({ href, children, className }: ModelLinkProps) {
  const pathname = usePathname();

  const handleClick = () => {
    // Save scroll position before navigating to model detail
    saveScrollPosition(pathname);
  };

  return (
    <Link href={href} onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}








