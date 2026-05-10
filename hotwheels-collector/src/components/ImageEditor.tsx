'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageIcon, Loader2 } from 'lucide-react';
import { ClientOnly } from '@/components/ClientOnly';

interface ImageData {
  id: number;
  path: string;
  alt?: string | null;
  variant?: {
    model?: {
      name: string;
    } | null;
  } | null;
  model?: {
    name: string;
  } | null;
}

export function ImageEditor() {
  const [open, setOpen] = useState(false);
  const [imageSource, setImageSource] = useState<'upload' | 'database'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string>('');
  const [dbImages, setDbImages] = useState<ImageData[]>([]);
  const [originalPreview, setOriginalPreview] = useState<string>('');
  const [processedPreview, setProcessedPreview] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [threshold, setThreshold] = useState(240);

  useEffect(() => {
    if (open && imageSource === 'database') {
      loadDatabaseImages();
    }
  }, [open, imageSource]);

  const loadDatabaseImages = async () => {
    try {
      const res = await fetch('/api/images/list');
      if (!res.ok) throw new Error('Failed to load images');
      const images = await res.json();
      setDbImages(images as ImageData[]);
    } catch (error) {
      console.error('Failed to load images:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setOriginalPreview(URL.createObjectURL(file));
      setProcessedPreview('');
      setAnalysisResult(null);
    }
  };

  const handleDatabaseSelect = (imageId: string) => {
    setSelectedImageId(imageId);
    const image = dbImages.find((img) => img.id === parseInt(imageId));
    if (image) {
      setOriginalPreview(`/images${image.path}`);
      setProcessedPreview('');
      setAnalysisResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile && !selectedImageId) return;

    setIsProcessing(true);
    try {
      const formData = new FormData();
      if (imageSource === 'upload' && selectedFile) {
        formData.append('file', selectedFile);
      } else if (imageSource === 'database' && selectedImageId) {
        const image = dbImages.find((img) => img.id === parseInt(selectedImageId));
        if (image) {
          const response = await fetch(`/images${image.path}`);
          const blob = await response.blob();
          const file = new File([blob], image.path.split('/').pop() || 'image.png', { type: 'image/png' });
          formData.append('file', file);
        }
      }

      const res = await fetch('/api/images/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || errorData.details || 'Analysis failed');
      }
      const data = await res.json();
      setAnalysisResult(data);
    } catch (error) {
      console.error('Analyze error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Analiz başarısız oldu';
      alert(`Analiz hatası: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveBackground = async () => {
    if (!selectedFile && !selectedImageId) return;

    setIsProcessing(true);
    try {
      const formData = new FormData();
      if (imageSource === 'upload' && selectedFile) {
        formData.append('file', selectedFile);
      } else if (imageSource === 'database' && selectedImageId) {
        const image = dbImages.find((img) => img.id === parseInt(selectedImageId));
        if (image) {
          const response = await fetch(`/images${image.path}`);
          const blob = await response.blob();
          const file = new File([blob], image.path.split('/').pop() || 'image.png', { type: 'image/png' });
          formData.append('file', file);
        }
      }
      formData.append('threshold', threshold.toString());

      const res = await fetch('/api/images/remove-background', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Background removal failed');
      const data = await res.json();
      if (data.success) {
        setProcessedPreview(data.imageData);
      }
    } catch (error) {
      console.error('Remove background error:', error);
      alert('Arka plan kaldırma başarısız oldu');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOptimize = async () => {
    if (!selectedFile && !selectedImageId) return;

    setIsProcessing(true);
    try {
      const formData = new FormData();
      if (imageSource === 'upload' && selectedFile) {
        formData.append('file', selectedFile);
      } else if (imageSource === 'database' && selectedImageId) {
        const image = dbImages.find((img) => img.id === parseInt(selectedImageId));
        if (image) {
          const response = await fetch(`/images${image.path}`);
          const blob = await response.blob();
          const file = new File([blob], image.path.split('/').pop() || 'image.png', { type: 'image/png' });
          formData.append('file', file);
        }
      }

      const res = await fetch('/api/images/optimize', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Optimization failed');
      const data = await res.json();
      if (data.success) {
        setProcessedPreview(data.imageData);
      }
    } catch (error) {
      console.error('Optimize error:', error);
      alert('Optimizasyon başarısız oldu');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ClientOnly
      fallback={
        <Button variant="outline" size="sm" disabled>
          <ImageIcon className="h-4 w-4 mr-2" />
          Görüntü Düzenleme
        </Button>
      }
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <ImageIcon className="h-4 w-4 mr-2" />
            Görüntü Düzenleme
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Görüntü Düzenleme Aracı</DialogTitle>
          <DialogDescription>
            Görüntüleri analiz edin, arka planı kaldırın ve optimize edin
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2 border-b pb-4">
            <Button
              variant={imageSource === 'upload' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setImageSource('upload')}
            >
              Dosya Yükle
            </Button>
            <Button
              variant={imageSource === 'database' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setImageSource('database')}
            >
              Veritabanından Seç
            </Button>
          </div>

          {imageSource === 'upload' ? (
            <div className="space-y-2">
              <Label htmlFor="file-upload">Görüntü Dosyası Seç</Label>
              <Input
                id="file-upload"
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleFileSelect}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Veritabanından Görüntü Seç</Label>
              <ClientOnly
                fallback={
                  <div className="h-10 rounded-md border border-input bg-background px-3 py-2" />
                }
              >
                <Select value={selectedImageId} onValueChange={handleDatabaseSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Görüntü seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {dbImages.map((img) => (
                      <SelectItem key={img.id} value={img.id.toString()}>
                        {img.path} {img.variant?.model?.name || img.model?.name ? `(${img.variant?.model?.name || img.model?.name})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ClientOnly>
            </div>
          )}

          {(originalPreview || processedPreview) && (
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Orijinal</CardTitle>
                </CardHeader>
                <CardContent>
                  {originalPreview && (
                    <div className="bg-transparent p-4 rounded border">
                      <Image
                        src={originalPreview}
                        alt="Original"
                        width={300}
                        height={300}
                        className="w-full h-auto object-contain"
                        unoptimized
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>İşlenmiş</CardTitle>
                </CardHeader>
                <CardContent>
                  {processedPreview ? (
                    <div className="bg-transparent p-4 rounded border">
                      <Image
                        src={processedPreview}
                        alt="Processed"
                        width={300}
                        height={300}
                        className="w-full h-auto object-contain"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Henüz işlenmedi</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleAnalyze} disabled={isProcessing || (!selectedFile && !selectedImageId)}>
              {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Gemini ile Analiz Et
            </Button>
            <Button onClick={handleRemoveBackground} disabled={isProcessing || (!selectedFile && !selectedImageId)} variant="outline">
              {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Beyaz Arka Planı Kaldır
            </Button>
            <Button onClick={handleOptimize} disabled={isProcessing || (!selectedFile && !selectedImageId)} variant="outline">
              {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Görüntüyü Optimize Et
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="threshold">Threshold: {threshold}</Label>
            <Input
              id="threshold"
              type="range"
              min="200"
              max="255"
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
            />
          </div>

          {analysisResult && (
            <Card>
              <CardHeader>
                <CardTitle>Analiz Sonuçları</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                  {JSON.stringify(analysisResult, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </ClientOnly>
  );
}







