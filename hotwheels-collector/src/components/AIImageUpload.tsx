'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, CheckCircle2, AlertCircle, Package, PackageCheck, Loader2, Info, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AIModelAddForm } from './AIModelAddForm';

const STORAGE_KEY = 'ai_image_recognition_result';

// heic2any dynamic import - HEIC dönüştürme için gerekli
let heic2anyModule: any = null;
let heic2anyLoading = false;
let heic2anyPromise: Promise<any> | null = null;

async function getHeic2Any() {
  if (typeof window === 'undefined') return null;
  
  if (heic2anyModule) return heic2anyModule;
  
  if (heic2anyLoading && heic2anyPromise) {
    return heic2anyPromise;
  }
  
  heic2anyLoading = true;
  heic2anyPromise = import('heic2any')
    .then((module) => {
      console.log('[Frontend] heic2any module loaded:', {
        hasDefault: !!module.default,
        defaultType: typeof module.default,
        moduleKeys: Object.keys(module),
        moduleType: typeof module,
      });
      
      // heic2any modülü genellikle default export olarak gelir
      // Ancak bazı durumlarda farklı export formatları olabilir
      let heic2anyFunc: any = null;
      
      // Önce default export'u kontrol et
      if (module.default && typeof module.default === 'function') {
        heic2anyFunc = module.default;
      }
      // Eğer default yoksa, modülün kendisini kontrol et
      else if (typeof module === 'function') {
        heic2anyFunc = module;
      }
      // Named export kontrolü
      else if (module.convert && typeof module.convert === 'function') {
        heic2anyFunc = module.convert;
      }
      else if (module.heic2any && typeof module.heic2any === 'function') {
        heic2anyFunc = module.heic2any;
      }
      
      heic2anyLoading = false;
      
      // Fonksiyon kontrolü
      if (!heic2anyFunc || typeof heic2anyFunc !== 'function') {
        console.error('[Frontend] heic2any is not a function. Module structure:', {
          hasDefault: !!module.default,
          defaultType: typeof module.default,
          moduleKeys: Object.keys(module),
          moduleType: typeof module,
          moduleValue: module,
        });
        heic2anyModule = null;
        heic2anyPromise = null;
        return null;
      }
      
      console.log('[Frontend] heic2any function found:', typeof heic2anyFunc);
      heic2anyModule = heic2anyFunc;
      return heic2anyModule;
    })
    .catch((err) => {
      console.error('[Frontend] heic2any import failed:', {
        error: err,
        message: err?.message,
        name: err?.name,
        stack: err?.stack,
      });
      heic2anyLoading = false;
      heic2anyPromise = null;
      heic2anyModule = null;
      return null;
    });
  
  return heic2anyPromise;
}

interface RecognitionResult {
  modelName: string;
  confidence: number;
  details?: {
    color?: string;
    year?: number;
    series?: string;
    subSeries?: string;
    castingName?: string;
    castingId?: string;
    wheelType?: string;
    specialDetails?: string;
  };
}

interface InventoryCheckResult {
  found: boolean;
  model?: {
    id: number;
    castingName: string;
    collectionName: string;
    year: number;
    subSeriesName?: string;
    owned: boolean;
    variants?: Array<{
      id: number;
      year: number;
      color: string | null;
      owned: boolean;
      quantity: number;
    }>;
  };
  similarity?: number;
}

interface ConditionResult {
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  hasDamage: boolean;
  notes: string[];
}

interface ImageFile {
  file: File;
  preview: string;
  id: string;
}

export function AIImageUpload() {
  const router = useRouter();
  const [files, setFiles] = useState<ImageFile[]>([]);
  const MAX_IMAGES = 5;
  const [recognizing, setRecognizing] = useState(false);
  const [recognitionResult, setRecognitionResult] = useState<RecognitionResult | null>(null);
  const [conditionResult, setConditionResult] = useState<ConditionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelId, setModelId] = useState<number | null>(null);
  const [loadingModelId, setLoadingModelId] = useState(false);
  const [inventoryCheck, setInventoryCheck] = useState<InventoryCheckResult | null>(null);
  const [checkingInventory, setCheckingInventory] = useState(false);
  const [updatingOwned, setUpdatingOwned] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDebugLog, setShowDebugLog] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  // Sayfa yüklendiğinde localStorage'dan sonuçları yükle
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.recognitionResult) {
          setRecognitionResult(data.recognitionResult);
        }
        if (data.inventoryCheck) {
          setInventoryCheck(data.inventoryCheck);
        }
        if (data.modelId) {
          setModelId(data.modelId);
        }
        if (data.debugLog && Array.isArray(data.debugLog)) {
          setDebugLog(data.debugLog);
        }
        if (data.showAddForm) {
          setShowAddForm(data.showAddForm);
        }
      }
    } catch (err) {
      console.error('Error loading saved recognition result:', err);
    }
  }, []);

  // Sonuçlar değiştiğinde localStorage'a kaydet (preview hariç - çok büyük olabilir)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (recognitionResult || inventoryCheck) {
      try {
        const dataToSave = {
          recognitionResult,
          inventoryCheck,
          modelId,
          debugLog,
          showAddForm,
          timestamp: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      } catch (err) {
        console.error('Error saving recognition result:', err);
      }
    }
  }, [recognitionResult, inventoryCheck, modelId, debugLog, showAddForm]);

  // Sıfırla butonu fonksiyonu
  const handleReset = () => {
    setRecognitionResult(null);
    setInventoryCheck(null);
    setConditionResult(null);
    setModelId(null);
    setFiles([]);
    setError(null);
    setShowAddForm(false);
    setDebugLog([]);
    setShowDebugLog(false);
    
    // localStorage'ı da temizle
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // Resmi listeden kaldır
  const removeImage = (id: string) => {
    setFiles(prev => {
      const newFiles = prev.filter(f => f.id !== id);
      // Preview URL'lerini temizle
      const removed = prev.find(f => f.id === id);
      if (removed && removed.preview.startsWith('blob:')) {
        URL.revokeObjectURL(removed.preview);
      }
      return newFiles;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    // Maksimum resim sayısı kontrolü
    const remainingSlots = MAX_IMAGES - files.length;
    if (selectedFiles.length > remainingSlots) {
      setError(`En fazla ${MAX_IMAGES} resim yükleyebilirsiniz. ${remainingSlots} resim daha ekleyebilirsiniz.`);
      return;
    }

    setError(null);
    setRecognitionResult(null);
    setConditionResult(null);
    setInventoryCheck(null);
    setShowAddForm(false);

    const newFiles: ImageFile[] = [];

    for (const selectedFile of selectedFiles) {
      // HEIC formatını kontrol et
      const isHeic = selectedFile.type === 'image/heic' || 
                     selectedFile.type === 'image/heif' ||
                     selectedFile.name.toLowerCase().endsWith('.heic') ||
                     selectedFile.name.toLowerCase().endsWith('.heif');

      try {
        let fileToAdd = selectedFile;
        let previewUrl = '';

        if (isHeic) {
          // HEIC dosyaları için frontend'de dönüştürme zorunlu
          const heic2any = await getHeic2Any();
          
          if (!heic2any || typeof heic2any !== 'function') {
            console.error('[Frontend] heic2any not available or not a function');
            setError('HEIC dosyaları için tarayıcı desteği gerekli. Lütfen dosyayı önce JPEG veya PNG formatına çevirin.');
            continue;
          }

          let convertedBlob;
          try {
            // heic2any fonksiyonunu çağır
            // heic2any parametreleri: { blob, toType, quality? }
            console.log('[Frontend] Starting HEIC conversion:', {
              fileName: selectedFile.name,
              fileType: selectedFile.type,
              fileSize: selectedFile.size,
              heic2anyType: typeof heic2any,
            });
            
            const conversionResult = await heic2any({
              blob: selectedFile,
              toType: 'image/jpeg',
              quality: 0.9,
            });
            
            console.log('[Frontend] HEIC conversion result:', {
              resultType: typeof conversionResult,
              isArray: Array.isArray(conversionResult),
              result: conversionResult,
            });
            
            // Sonuç kontrolü - heic2any bazen array, bazen tek blob döndürür
            if (!conversionResult) {
              throw new Error('Conversion returned null or undefined');
            }
            
            // Array ise ilk elemanı al, değilse direkt kullan
            convertedBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
            
            if (!convertedBlob) {
              throw new Error('Converted blob is null or undefined after array check');
            }
            
            // Blob tipini kontrol et
            if (!(convertedBlob instanceof Blob)) {
              console.error('[Frontend] Converted result is not a Blob:', {
                type: typeof convertedBlob,
                constructor: convertedBlob?.constructor?.name,
                value: convertedBlob,
              });
              throw new Error(`Conversion result is not a Blob, got: ${typeof convertedBlob}`);
            }
            
            console.log('[Frontend] HEIC conversion successful:', {
              originalSize: selectedFile.size,
              convertedSize: convertedBlob.size,
              convertedType: convertedBlob.type,
            });
            
          } catch (conversionError: any) {
            console.error('[Frontend] heic2any conversion failed:', {
              error: conversionError,
              message: conversionError?.message,
              name: conversionError?.name,
              stack: conversionError?.stack,
              fileName: selectedFile.name,
              fileType: selectedFile.type,
              fileSize: selectedFile.size,
              heic2anyAvailable: !!heic2any,
              heic2anyType: typeof heic2any,
            });
            
            // Boş obje hatasını özel olarak yakala
            let errorMessage = 'Bilinmeyen hata';
            if (conversionError?.message) {
              errorMessage = conversionError.message;
            } else if (conversionError && typeof conversionError === 'object' && Object.keys(conversionError).length === 0) {
              errorMessage = 'HEIC dönüştürme başarısız - tarayıcı desteği eksik olabilir. Lütfen dosyayı önce JPEG veya PNG formatına çevirin.';
            } else if (conversionError?.toString && conversionError.toString() !== '[object Object]') {
              errorMessage = conversionError.toString();
            } else if (typeof conversionError === 'string') {
              errorMessage = conversionError;
            }
            
            setError(`HEIC dönüştürme başarısız: ${selectedFile.name}. ${errorMessage}`);
            continue;
          }

          // Dönüştürülmüş blob'dan File oluştur
          fileToAdd = new File([convertedBlob], selectedFile.name.replace(/\.(heic|heif)$/i, '.jpg'), {
            type: 'image/jpeg',
            lastModified: selectedFile.lastModified,
          });
          
          console.log('[Frontend] HEIC converted successfully:', {
            originalName: selectedFile.name,
            convertedName: fileToAdd.name,
            originalSize: selectedFile.size,
            convertedSize: fileToAdd.size,
            type: fileToAdd.type,
          });
        } else {
          // Normal resim dosyası kontrolü
          if (!selectedFile.type.startsWith('image/')) {
            setError(`Geçersiz dosya tipi: ${selectedFile.name}`);
            continue;
          }
        }

        // Preview oluştur
        previewUrl = URL.createObjectURL(fileToAdd);

        newFiles.push({
          file: fileToAdd,
          preview: previewUrl,
          id: `${Date.now()}-${Math.random()}`,
        });
      } catch (err: any) {
        console.error('[Frontend] File processing error:', err);
        setError(`Dosya işleme hatası: ${selectedFile.name} - ${err.message}`);
      }
    }

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
    }

    // Input'u temizle (aynı dosyayı tekrar seçebilmek için)
    e.target.value = '';
  };

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleRecognize = async () => {
    if (files.length === 0) return;

    setRecognizing(true);
    setError(null);
    setDebugLog([]);
    addDebugLog(`${files.length} görsel yüklendi, Gemini API'ye gönderiliyor...`);

    try {
      const formData = new FormData();
      files.forEach((imgFile, index) => {
        formData.append('images', imgFile.file);
      });

      addDebugLog('Tüm görseller analiz ediliyor...');
      
      // Çoklu görsel tanıma
      const recognizeResponse = await fetch('/api/ai/recognize', {
        method: 'POST',
        body: formData,
      });

      if (!recognizeResponse.ok) {
        const errorData = await recognizeResponse.json().catch(() => ({}));
        const errorMessage = errorData.details || errorData.error || 'Model tanıma başarısız';
        addDebugLog(`Hata: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      const recognizeData = await recognizeResponse.json();
      setRecognitionResult(recognizeData);
      
      addDebugLog(`Model tanındı: ${recognizeData.modelName} (Güven: ${(recognizeData.confidence * 100).toFixed(0)}%)`);
      if (recognizeData.details?.year) addDebugLog(`Yıl: ${recognizeData.details.year}`);
      if (recognizeData.details?.series) addDebugLog(`Koleksiyon: ${recognizeData.details.series}`);
      if (recognizeData.details?.subSeries) addDebugLog(`Alt Seri: ${recognizeData.details.subSeries}`);
      if (recognizeData.details?.color) addDebugLog(`Renk: ${recognizeData.details.color}`);
      if (recognizeData.details?.wheelType) addDebugLog(`Jant Tipi: ${recognizeData.details.wheelType}`);

      // Otomatik envanter kontrolü
      addDebugLog('Koleksiyonda aranıyor...');
      await checkInventory(recognizeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setRecognizing(false);
    }
  };

  const checkInventory = async (recognitionData: RecognitionResult) => {
    if (!recognitionData) return;

    setCheckingInventory(true);
    try {
      const response = await fetch('/api/ai/check-inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelName: recognitionData.modelName,
          year: recognitionData.details?.year,
          collection: recognitionData.details?.series,
          subSeries: recognitionData.details?.subSeries,
          color: recognitionData.details?.color,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setInventoryCheck(data);
        
        if (data.found && data.model) {
          addDebugLog(`Model bulundu: ${data.model.castingName} (ID: ${data.model.id})`);
          addDebugLog(`Eşleşme: ${data.similarity ? (data.similarity * 100).toFixed(0) : 'N/A'}%`);
          setModelId(data.model.id); // Model ID'yi set et
        } else {
          addDebugLog('Model koleksiyonda bulunamadı - Yeni model formu gösteriliyor');
          setModelId(null); // Model bulunamadı
          // Model bulunamadı, form göster
          setShowAddForm(true);
        }
      } else {
        // API hatası durumunda da form göster
        addDebugLog('Envanter kontrolü başarısız - Yeni model formu gösteriliyor');
        setShowAddForm(true);
      }
    } catch (err) {
      addDebugLog(`Envanter kontrolü hatası: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`);
      console.error('Error checking inventory:', err);
    } finally {
      setCheckingInventory(false);
    }
  };

  const handleOwnedToggle = async (owned: boolean) => {
    if (!inventoryCheck?.model) return;

    setUpdatingOwned(true);
    try {
      // Model owned durumunu güncelle
      const response = await fetch(`/api/models/${inventoryCheck.model.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ owned }),
      });

      if (response.ok) {
        // Envanter kontrolünü yenile
        if (recognitionResult) {
          await checkInventory(recognitionResult);
        }
      }
    } catch (err) {
      console.error('Error updating owned status:', err);
      setError('Sahiplik durumu güncellenemedi');
    } finally {
      setUpdatingOwned(false);
    }
  };

  const handleFormSuccess = (modelId: number) => {
    setShowAddForm(false);
    setModelId(modelId);
    router.push(`/model/${modelId}`);
  };

  return (
    <Card className="h-full">
      <CardContent className="space-y-6 pt-6">
        {/* Resim Yükleme Alanı */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="image-upload" className="text-base font-semibold">
              Resim Yükle {files.length > 0 && `(${files.length}/${MAX_IMAGES})`}
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Aynı modelin farklı açılardan çekilmiş fotoğraflarını yükleyin (maksimum {MAX_IMAGES} resim). 
              AI tüm resimleri analiz ederek daha doğru sonuç verecektir.
            </p>
          </div>
          
          {/* Çoklu Resim Preview Grid */}
          {files.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {files.map((imgFile) => (
                <div key={imgFile.id} className="relative group">
                  <div className="relative rounded-lg overflow-hidden border-2 border-border aspect-square">
                    <img
                      src={imgFile.preview}
                      alt={`Preview ${imgFile.id}`}
                      className="w-full h-full object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeImage(imgFile.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {imgFile.file.name}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Yükleme Alanı */}
          {files.length < MAX_IMAGES && (
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <Input
                id="image-upload"
                type="file"
                accept="image/*,.heic,.heif"
                onChange={handleFileChange}
                multiple
                className="hidden"
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <div className="p-3 rounded-full bg-primary/10">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">
                    {files.length === 0 ? 'Resim seçmek için tıklayın' : `${MAX_IMAGES - files.length} resim daha ekleyin`}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    veya sürükleyip bırakın
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  JPEG, PNG desteklenir • HEIC dosyaları otomatik dönüştürülür
                </p>
              </label>
            </div>
          )}

          {/* Tanıma Butonu */}
          {files.length > 0 && (
            <Button
              onClick={handleRecognize}
              disabled={recognizing}
              className="w-full"
              size="lg"
            >
              {recognizing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {files.length} Resim Analiz Ediliyor...
                </>
              ) : (
                `${files.length} Resmi Analiz Et`
              )}
            </Button>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {recognitionResult && (
          <div className="space-y-3 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Model Tanındı</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-8 w-8 p-0"
                title="Sonucu Sıfırla"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1 text-sm text-foreground">
              <div>
                <span className="font-medium">Model Adı:</span>{' '}
                {modelId ? (
                  <Link 
                    href={`/model/${modelId}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {recognitionResult.modelName}
                  </Link>
                ) : loadingModelId ? (
                  <span className="text-muted-foreground">{recognitionResult.modelName} (araniyor...)</span>
                ) : (
                  <span>{recognitionResult.modelName}</span>
                )}
              </div>
              <div>
                <span className="font-medium">Güven:</span>{' '}
                {(recognitionResult.confidence * 100).toFixed(0)}%
              </div>
              {recognitionResult.details?.year && (
                <div>
                  <span className="font-medium">Yıl:</span> {recognitionResult.details.year}
                </div>
              )}
              {recognitionResult.details?.series && (
                <div>
                  <span className="font-medium">Koleksiyon:</span> {recognitionResult.details.series}
                </div>
              )}
              {recognitionResult.details?.subSeries && (
                <div>
                  <span className="font-medium">Alt Seri:</span> {recognitionResult.details.subSeries}
                </div>
              )}
              {recognitionResult.details?.color && (
                <div>
                  <span className="font-medium">Renk:</span> {recognitionResult.details.color}
                </div>
              )}
              {recognitionResult.details?.wheelType && (
                <div>
                  <span className="font-medium">Jant Tipi:</span> {recognitionResult.details.wheelType}
                </div>
              )}
              {recognitionResult.details?.castingId && (
                <div>
                  <span className="font-medium">Casting ID:</span>{' '}
                  {recognitionResult.details.castingId}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Envanter Kontrol Sonucu */}
        {checkingInventory && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 border border-border rounded-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Koleksiyonda aranıyor...</span>
          </div>
        )}

        {inventoryCheck && !checkingInventory && (
          <div className="space-y-3 p-4 bg-secondary/50 border border-border rounded-lg">
            {inventoryCheck.found && inventoryCheck.model ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PackageCheck className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-foreground">
                      Bu model koleksiyonunda kayıtlı
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="h-8 w-8 p-0"
                    title="Sonucu Sıfırla"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Model:</span>{' '}
                    <Link
                      href={`/model/${inventoryCheck.model.id}`}
                      className="text-primary hover:underline"
                    >
                      {inventoryCheck.model.castingName}
                    </Link>
                  </div>
                  <div>
                    <span className="font-medium">Koleksiyon:</span>{' '}
                    {inventoryCheck.model.collectionName} ({inventoryCheck.model.year})
                  </div>
                  {inventoryCheck.model.subSeriesName && (
                    <div>
                      <span className="font-medium">Alt Seri:</span>{' '}
                      {inventoryCheck.model.subSeriesName}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Sahiplik Durumu:</span>{' '}
                    {inventoryCheck.model.owned ? (
                      <span className="text-green-600">Bende Var</span>
                    ) : (
                      <span className="text-muted-foreground">Bende Yok</span>
                    )}
                  </div>
                  {inventoryCheck.similarity && (
                    <div className="text-xs text-muted-foreground">
                      Eşleşme: {(inventoryCheck.similarity * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant={inventoryCheck.model.owned ? 'default' : 'outline'}
                    onClick={() => handleOwnedToggle(!inventoryCheck.model!.owned)}
                    disabled={updatingOwned}
                  >
                    {updatingOwned ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Güncelleniyor...
                      </>
                    ) : inventoryCheck.model.owned ? (
                      <>
                        <PackageCheck className="mr-2 h-4 w-4" />
                        Bende Var
                      </>
                    ) : (
                      <>
                        <Package className="mr-2 h-4 w-4" />
                        Bende Yok
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-orange-600" />
                    <h3 className="font-semibold text-foreground">
                      Yeni araç bulundu!
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="h-8 w-8 p-0"
                    title="Sonucu Sıfırla"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Bu model koleksiyonunuzda kayıtlı değil. Koleksiyona eklemek ister misiniz?
                </p>
              </>
            )}
          </div>
        )}

        {/* Yeni Model Ekleme Formu */}
        {showAddForm && !inventoryCheck?.found && recognitionResult && (
          <AIModelAddForm
            initialData={{
              modelName: recognitionResult.modelName,
              year: recognitionResult.details?.year,
              collection: recognitionResult.details?.series,
              subSeries: recognitionResult.details?.subSeries,
              color: recognitionResult.details?.color,
              wheelType: recognitionResult.details?.wheelType,
              castingId: recognitionResult.details?.castingId,
              specialDetails: recognitionResult.details?.specialDetails,
            }}
            onSuccess={handleFormSuccess}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {conditionResult && (
          <div className="space-y-2 p-4 bg-secondary/50 border border-border rounded-lg">
            <h3 className="font-semibold text-foreground">Durum Analizi</h3>
            <div className="space-y-1 text-sm text-foreground">
              <div>
                <span className="font-medium">Durum:</span>{' '}
                {conditionResult.condition === 'excellent' && 'Mükemmel'}
                {conditionResult.condition === 'good' && 'İyi'}
                {conditionResult.condition === 'fair' && 'Orta'}
                {conditionResult.condition === 'poor' && 'Kötü'}
              </div>
              {conditionResult.hasDamage && (
                <div className="text-destructive">
                  <span className="font-medium">Hasar:</span> Tespit edildi
                </div>
              )}
              {conditionResult.notes.length > 0 && (
                <div>
                  <span className="font-medium">Notlar:</span>
                  <ul className="list-disc list-inside ml-2">
                    {conditionResult.notes.map((note, idx) => (
                      <li key={idx}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Debug Log Panel */}
        {recognitionResult && debugLog.length > 0 && (
          <div className="space-y-2 p-4 bg-muted/50 border border-border rounded-lg">
            <button
              onClick={() => setShowDebugLog(!showDebugLog)}
              className="flex items-center gap-2 w-full text-left"
            >
              <Info className="h-4 w-4" />
              <span className="font-semibold text-sm">Analiz Logları</span>
              {showDebugLog ? (
                <ChevronUp className="h-4 w-4 ml-auto" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-auto" />
              )}
            </button>
            {showDebugLog && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {debugLog.map((log, idx) => (
                  <div key={idx} className="text-xs font-mono text-muted-foreground p-1 bg-background rounded">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

