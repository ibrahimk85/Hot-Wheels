'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, ExternalLink } from 'lucide-react';

export default function IntegrationsPage() {
  const [openaiKey, setOpenaiKey] = useState('');
  const [ebayKey, setEbayKey] = useState('');
  const [googleLensKey, setGoogleLensKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [googleSearchKey, setGoogleSearchKey] = useState('');
  const [googleSearchEngineId, setGoogleSearchEngineId] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  // Load existing API keys on mount
  useEffect(() => {
    async function loadKeys() {
      try {
        const [openaiRes, ebayRes, googleLensRes, geminiRes, googleSearchRes, googleSearchEngineRes] = await Promise.all([
          fetch('/api/settings/api-keys?key=openai_api_key'),
          fetch('/api/settings/api-keys?key=ebay_api_key'),
          fetch('/api/settings/api-keys?key=google_lens_api_key'),
          fetch('/api/settings/api-keys?key=gemini_api_key'),
          fetch('/api/settings/api-keys?key=google_search_api_key'),
          fetch('/api/settings/api-keys?key=google_search_engine_id'),
        ]);

        const openaiData = await openaiRes.json();
        const ebayData = await ebayRes.json();
        const googleLensData = await googleLensRes.json();
        const geminiData = await geminiRes.json();
        const googleSearchData = await googleSearchRes.json();
        const googleSearchEngineData = await googleSearchEngineRes.json();

        if (openaiData.value) setOpenaiKey(openaiData.value);
        if (ebayData.value) setEbayKey(ebayData.value);
        if (googleLensData.value) setGoogleLensKey(googleLensData.value);
        if (geminiData.value) setGeminiKey(geminiData.value);
        if (googleSearchData.value) setGoogleSearchKey(googleSearchData.value);
        if (googleSearchEngineData.value) setGoogleSearchEngineId(googleSearchEngineData.value);
      } catch (error) {
        console.error('Error loading API keys:', error);
      }
    }
    loadKeys();
  }, []);

  const handleSave = async (keyType: 'openai' | 'ebay' | 'google_lens' | 'gemini' | 'google_search' | 'google_search_engine') => {
    setSaving(keyType);
    try {
      const keyMap = {
        openai: { key: 'openai_api_key', value: openaiKey },
        ebay: { key: 'ebay_api_key', value: ebayKey },
        google_lens: { key: 'google_lens_api_key', value: googleLensKey },
        gemini: { key: 'gemini_api_key', value: geminiKey },
        google_search: { key: 'google_search_api_key', value: googleSearchKey },
        google_search_engine: { key: 'google_search_engine_id', value: googleSearchEngineId },
      };

      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keyMap[keyType]),
      });

      if (!response.ok) {
        throw new Error('Failed to save API key');
      }

      alert('API key kaydedildi!');
    } catch (error) {
      console.error('Error saving API key:', error);
      alert('API key kaydedilirken bir hata oluştu');
    } finally {
      setSaving(null);
    }
  };
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">API Entegrasyonları</h2>
        <p className="text-muted-foreground">
          Harici servislerle entegrasyon ayarlarını yönetin
        </p>
      </div>

      {/* eBay Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            eBay API
          </CardTitle>
          <CardDescription>
            eBay'den otomatik fiyat bilgisi çekmek için API key gerekir
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ebay-api-key">eBay API Key</Label>
            <Input
              id="ebay-api-key"
              type="password"
              placeholder="API key'inizi girin"
              value={ebayKey}
              onChange={(e) => setEbayKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              eBay Developer Program'dan API key alabilirsiniz
            </p>
          </div>
          <Button 
            onClick={() => handleSave('ebay')}
            disabled={saving === 'ebay'}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving === 'ebay' ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </CardContent>
      </Card>

      {/* OpenAI Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            OpenAI API
          </CardTitle>
          <CardDescription>
            AI Chat ve diğer AI özellikleri için OpenAI API key gerekir
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openai-api-key">OpenAI API Key</Label>
            <Input
              id="openai-api-key"
              type="password"
              placeholder="API key'inizi girin"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              OpenAI Platform'dan API key alabilirsiniz
            </p>
          </div>
          <Button 
            onClick={() => handleSave('openai')}
            disabled={saving === 'openai'}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving === 'openai' ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </CardContent>
      </Card>

      {/* Google Lens Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Google Lens API
          </CardTitle>
          <CardDescription>
            Görsel tanıma için Google Lens API key gerekir
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="google-lens-api-key">Google Lens API Key</Label>
            <Input
              id="google-lens-api-key"
              type="password"
              placeholder="API key'inizi girin"
              value={googleLensKey}
              onChange={(e) => setGoogleLensKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Google Cloud Console'dan API key alabilirsiniz
            </p>
          </div>
          <Button 
            onClick={() => handleSave('google_lens')}
            disabled={saving === 'google_lens'}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving === 'google_lens' ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </CardContent>
      </Card>

      {/* Gemini Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Gemini API
          </CardTitle>
          <CardDescription>
            Model resim arama için arama sorgusu optimizasyonu yapmak için Google Gemini API key gerekir
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gemini-api-key">Gemini API Key</Label>
            <Input
              id="gemini-api-key"
              type="password"
              placeholder="API key'inizi girin"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Google AI Studio'dan API key alabilirsiniz: <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://makersuite.google.com/app/apikey</a>
            </p>
          </div>
          <Button 
            onClick={() => handleSave('gemini')}
            disabled={saving === 'gemini'}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving === 'gemini' ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </CardContent>
      </Card>

      {/* Google Custom Search API Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Google Custom Search API
          </CardTitle>
          <CardDescription>
            Model resim arama özelliği için Google Custom Search API key ve Search Engine ID gerekir
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="google-search-api-key">Google Search API Key</Label>
            <Input
              id="google-search-api-key"
              type="password"
              placeholder="API key'inizi girin"
              value={googleSearchKey}
              onChange={(e) => setGoogleSearchKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Google Cloud Console'dan API key alabilirsiniz. Custom Search JSON API'yi etkinleştirmeniz gerekir.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="google-search-engine-id">Search Engine ID (CX)</Label>
            <Input
              id="google-search-engine-id"
              type="text"
              placeholder="Search Engine ID'nizi girin"
              value={googleSearchEngineId}
              onChange={(e) => setGoogleSearchEngineId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              <a href="https://programmablesearchengine.google.com/controlpanel/create" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Programmable Search Engine</a> oluşturduktan sonra Control Panel'den Engine ID'yi alabilirsiniz.
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => handleSave('google_search')}
              disabled={saving === 'google_search'}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving === 'google_search' ? 'Kaydediliyor...' : 'API Key Kaydet'}
            </Button>
            <Button 
              onClick={() => handleSave('google_search_engine')}
              disabled={saving === 'google_search_engine'}
              variant="outline"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving === 'google_search_engine' ? 'Kaydediliyor...' : 'Engine ID Kaydet'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hot Wheels Wiki */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Hot Wheels Wiki
          </CardTitle>
          <CardDescription>
            Hot Wheels Wiki'den otomatik veri çekme (API key gerekmez)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Wiki Entegrasyonu</p>
              <p className="text-sm text-muted-foreground">
                Mevcut scraping sistemi kullanılıyor
              </p>
            </div>
            <Button variant="outline" disabled>
              Aktif
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Price History */}
      <Card>
        <CardHeader>
          <CardTitle>Fiyat Geçmişi</CardTitle>
          <CardDescription>
            Model ve varyantlar için fiyat geçmişi takibi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Fiyat geçmişi otomatik olarak kaydediliyor. Manuel fiyat eklemek için model
              veya varyant detay sayfasını kullanın.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}




