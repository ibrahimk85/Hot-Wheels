'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, List, Package, Car, Settings, Sparkles, Target, FileText, Trophy, Bot, LayoutDashboard, BarChart3, Database, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/dashboard', label: 'Özelleştirilebilir', icon: LayoutDashboard },
  { href: '/variants', label: 'Varyantlar', icon: List },
  { href: '/models', label: 'Modeller', icon: Car },
  { href: '/collections', label: 'Koleksiyonlar', icon: Package },
  { href: '/ai', label: 'AI', icon: Bot },
  { href: '/analytics', label: 'İstatistikler', icon: BarChart3 },
  { href: '/data-management', label: 'Veri Yönetimi', icon: Database },
  { href: '/calendar', label: 'Takvim', icon: Calendar },
  { href: '/recommendations', label: 'Öneriler', icon: Sparkles },
  { href: '/goals', label: 'Hedefler', icon: Target },
  { href: '/achievements', label: 'Başarımlar', icon: Trophy },
  { href: '/reports', label: 'Raporlar', icon: FileText },
  { href: '/settings', label: 'Ayarlar', icon: Settings },
];

export function MobileNavigation() {
  const pathname = usePathname();

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

