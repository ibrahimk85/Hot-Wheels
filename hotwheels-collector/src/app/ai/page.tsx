import { AIImageUpload } from '@/components/AIImageUpload';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { ImageIcon, Sparkles, Info } from 'lucide-react';

export default function AIPage() {
  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <ImageIcon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">AI Görsel Tanıma</h1>
          <p className="text-muted-foreground mt-1">
            Hot Wheels modellerinizi fotoğraflayarak otomatik olarak tanıyın ve koleksiyonunuza ekleyin
          </p>
        </div>
      </div>

      {/* Ana İçerik - AI Görsel Tanıma */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sol Taraf - Ana Özellik (2/3 genişlik) */}
        <div className="lg:col-span-2">
          <AIImageUpload />
        </div>

        {/* Sağ Taraf - Bilgilendirme (1/3 genişlik) */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Nasıl Çalışır?</h3>
                    <p className="text-sm text-muted-foreground">
                      Hot Wheels modelinizin fotoğrafını yükleyin. AI, modeli otomatik olarak tanır ve koleksiyonunuzda olup olmadığını kontrol eder.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                    <Info className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Özellikler</h3>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Otomatik model tanıma</li>
                      <li>Koleksiyon kontrolü</li>
                      <li>Yeni model ekleme</li>
                      <li>Detaylı analiz logları</li>
                    </ul>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    <strong>Desteklenen formatlar:</strong> JPEG, PNG, HEIC (otomatik dönüştürülür)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}




