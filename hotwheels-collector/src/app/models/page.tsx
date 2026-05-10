// app/models/page.tsx

import { Card, CardContent } from '@/components/ui/card';
import { getSubSeriesCompletionSummary } from '@/features/models/model.service';
import { ModelsPageClient } from '@/components/ModelsPageClient';

export default async function ModelsPage() {
  let completionItems;
  try {
    completionItems = await getSubSeriesCompletionSummary();
  } catch (error) {
    console.error('Error fetching sub-series:', error);
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Modeller</h2>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Alt seriler yüklenirken bir hata oluştu. Lütfen tekrar deneyin.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completionItems.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Modeller</h2>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Henüz tamamlanma verisi olan alt seri bulunmamaktadır.
          </CardContent>
        </Card>
      </div>
    );
  }

  return <ModelsPageClient completionItems={completionItems} />;
}



