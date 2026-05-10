import prisma from '@/db';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

export default async function GalleryPage() {
  // Check if Elite 64 and RLC collections exist
  const elite64Collections = await prisma.collection.findMany({
    where: {
      name: 'Elite 64',
    },
    select: {
      id: true,
    },
  });

  const rlcCollections = await prisma.collection.findMany({
    where: {
      name: 'Red Line Club',
    },
    select: {
      id: true,
    },
  });

  const hasElite64 = elite64Collections.length > 0;
  const hasRLC = rlcCollections.length > 0;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Gallery</h2>
      
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {hasElite64 && (
          <Link href="/gallery/elite64">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6 flex flex-col items-center justify-center gap-4 min-h-[200px]">
                <div className="text-6xl">🏎️</div>
                <div className="text-xl font-semibold text-center">Elite 64</div>
                <div className="text-sm text-muted-foreground text-center">
                  Elite 64 Gallery Resimleri
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
        
        {hasRLC && (
          <Link href="/gallery/rlc">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6 flex flex-col items-center justify-center gap-4 min-h-[200px]">
                <div className="text-6xl">🔥</div>
                <div className="text-xl font-semibold text-center">Red Line Club</div>
                <div className="text-sm text-muted-foreground text-center">
                  Red Line Club Gallery Resimleri
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      {!hasElite64 && !hasRLC && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Henüz gallery koleksiyonu bulunmamaktadır.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

