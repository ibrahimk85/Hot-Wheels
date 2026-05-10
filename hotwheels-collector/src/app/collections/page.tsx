import prisma from '@/db';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { BoulevardLogo } from '@/components/BoulevardLogo';
import { MainlineLogo } from '@/components/MainlineLogo';
import { PopCultureLogo } from '@/components/PopCultureLogo';
import { CarCultureLogo } from '@/components/CarCultureLogo';
import { CarCulture2PacksLogo } from '@/components/CarCulture2PacksLogo';
import { FastFuriousPremiumLogo } from '@/components/FastFuriousPremiumLogo';
import { FastFuriousLogo } from '@/components/FastFuriousLogo';
import { TeamTransportLogo } from '@/components/TeamTransportLogo';
import { Elite64Logo } from '@/components/Elite64Logo';
import { RLCLogo } from '@/components/RLCLogo';
import { NeonSpeedersLogo } from '@/components/NeonSpeedersLogo';
import { FivePacksLogo } from '@/components/FivePacksLogo';
import { ThemedMultipackLogo } from '@/components/ThemedMultipackLogo';
import { SilverSeriesLogo } from '@/components/SilverSeriesLogo';

export default async function CollectionsPage() {
  const collections = await prisma.collection.findMany({
    include: {
      year: true,
      _count: {
        select: {
          models: true,
        },
      },
    },
    orderBy: {
      yearId: 'desc',
    },
  });

  // Group collections by name
  const groupedCollections = new Map<string, typeof collections>();
  for (const collection of collections) {
    const name = collection.name;
    if (!groupedCollections.has(name)) {
      groupedCollections.set(name, []);
    }
    groupedCollections.get(name)!.push(collection);
  }

  // Process grouped collections
  const displayCollections: Array<{
    id: number;
    name: string;
    years: number[];
    totalModels: number;
    hasMultipleYears: boolean;
    href: string;
  }> = [];

  for (const [name, colls] of groupedCollections.entries()) {
    let displayYears: number[];
    let displayTotalModels: number;
    let sortedColls = colls.sort((a, b) => b.year.year - a.year.year);
    let hasMultipleYears = colls.length > 1;
    
    // For Boulevard, filter to only show 2020 and newer years (will show new years as they're added)
    if (name === 'Boulevard') {
      // Filter to only include 2020 and newer years (>= 2020)
      const filteredColls = colls.filter(c => c.year.year >= 2020);
      const sortedFilteredColls = filteredColls.sort((a, b) => b.year.year - a.year.year);
      
      if (sortedFilteredColls.length > 0) {
        // Get only the latest/newest year (currently 2025, will show newest as years are added)
        const latestYearCollection = sortedFilteredColls[0];
        displayYears = [latestYearCollection.year.year];
        displayTotalModels = latestYearCollection._count.models;
        sortedColls = sortedFilteredColls;
        // For Boulevard, we always show only one year in the card
        hasMultipleYears = false;
      } else {
        // Fallback if no 2021+ years found
        displayYears = [2021];
        displayTotalModels = 0;
        hasMultipleYears = false;
      }
    } else {
      // For other collections, show all years
      displayYears = sortedColls.map(c => c.year.year);
      displayTotalModels = colls.reduce((sum, c) => sum + c._count.models, 0);
    }
    
    // Link directly to collection name page
    // Convert collection name to URL-friendly format (lowercase, spaces to hyphens, & to and)
    // e.g., "Pop Culture" -> "pop-culture", "Fast & Furious Premium" -> "fast-and-furious-premium"
    const href = `/collections/${name.toLowerCase().replace(/\s+/g, '-').replace(/\s*&\s*/g, '-and-').replace(/-+/g, '-')}`;

    displayCollections.push({
      id: sortedColls[0].id,
      name,
      years: displayYears,
      totalModels: displayTotalModels,
      hasMultipleYears,
      href,
    });
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Koleksiyonlar</h2>
      {displayCollections.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Henüz koleksiyon bulunmamaktadır.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {displayCollections.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <Link href={c.href}>
                <CardContent 
                  className={
                    c.name === 'Boulevard' || c.name === 'Mainline' || c.name === 'Pop Culture' || c.name === 'Car Culture' || c.name === 'Car Culture 2-Packs' || c.name === 'Fast & Furious Premium' || c.name === 'Fast & Furious' || c.name === 'Team Transport' || c.name === 'Elite 64' || c.name === 'Red Line Club' || c.name === 'Neon Speeders' || c.name === 'Hot Wheels 5-Packs' || c.name === 'Hot Wheels Themed multipack' || c.name === 'Hot Wheels Silver Series'
                      ? 'p-2' // Logo için minimal padding
                      : 'p-6' // Diğer koleksiyonlar için normal padding
                  }
                >
                  {c.name === 'Boulevard' ? (
                    // Boulevard için logo göster
                    <BoulevardLogo />
                  ) : c.name === 'Mainline' ? (
                    // Mainline için logo göster
                    <MainlineLogo />
                  ) : c.name === 'Pop Culture' ? (
                    // Pop Culture için logo göster
                    <PopCultureLogo />
                  ) : c.name === 'Car Culture' ? (
                    // Car Culture için logo göster
                    <CarCultureLogo />
                  ) : c.name === 'Car Culture 2-Packs' ? (
                    // Car Culture 2-Packs için logo göster
                    <CarCulture2PacksLogo />
                  ) : c.name === 'Fast & Furious Premium' ? (
                    // Fast & Furious Premium için logo göster
                    <FastFuriousPremiumLogo />
                  ) : c.name === 'Fast & Furious' ? (
                    // Fast & Furious için logo göster
                    <FastFuriousLogo />
                  ) : c.name === 'Team Transport' ? (
                    // Team Transport için logo göster
                    <TeamTransportLogo />
                  ) : c.name === 'Elite 64' ? (
                    // Elite 64 için logo göster
                    <Elite64Logo />
                  ) : c.name === 'Red Line Club' ? (
                    // Red Line Club için logo göster
                    <RLCLogo />
                  ) : c.name === 'Neon Speeders' ? (
                    // Neon Speeders için logo göster
                    <NeonSpeedersLogo />
                  ) : c.name === 'Hot Wheels 5-Packs' ? (
                    // Hot Wheels 5-Packs için logo göster
                    <FivePacksLogo />
                  ) : c.name === 'Hot Wheels Themed multipack' ? (
                    // Hot Wheels Themed multipack için logo göster
                    <ThemedMultipackLogo />
                  ) : c.name === 'Hot Wheels Silver Series' ? (
                    // Hot Wheels Silver Series için logo göster
                    <SilverSeriesLogo />
                  ) : (
                    // Diğer koleksiyonlar için normal görünüm
                    <div className="flex flex-col gap-2">
                      <div className="font-semibold text-lg">
                        {c.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {c.hasMultipleYears 
                          ? `${c.years.join(', ')} yılları`
                          : `${c.years[0]} yılı`
                        }
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {c.totalModels} model
                      </div>
                    </div>
                  )}
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

