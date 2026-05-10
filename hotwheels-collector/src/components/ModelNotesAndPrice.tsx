'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ModelNotesAndPriceProps {
  modelId: number;
  initialNotes: string | null;
  initialPackedPurchasePrice: number | null;
  initialPackedMarketPrice: number | null;
  initialPackedOriginalPrice: number | null;
  initialLoosePurchasePrice: number | null;
  initialLooseMarketPrice: number | null;
}

export function ModelNotesAndPrice({
  modelId,
  initialNotes,
  initialPackedPurchasePrice,
  initialPackedMarketPrice,
  initialPackedOriginalPrice,
  initialLoosePurchasePrice,
  initialLooseMarketPrice,
}: ModelNotesAndPriceProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes || '');
  const [packedPurchasePrice, setPackedPurchasePrice] = useState(initialPackedPurchasePrice?.toString() || '');
  const [packedMarketPrice, setPackedMarketPrice] = useState(initialPackedMarketPrice?.toString() || '');
  const [packedOriginalPrice, setPackedOriginalPrice] = useState(initialPackedOriginalPrice?.toString() || '');
  const [loosePurchasePrice, setLoosePurchasePrice] = useState(initialLoosePurchasePrice?.toString() || '');
  const [looseMarketPrice, setLooseMarketPrice] = useState(initialLooseMarketPrice?.toString() || '');
  const [saving, setSaving] = useState(false);
  const [priceSaved, setPriceSaved] = useState(false);

  // Update state when props change
  useEffect(() => {
    setNotes(initialNotes || '');
    setPackedPurchasePrice(initialPackedPurchasePrice?.toString() || '');
    setPackedMarketPrice(initialPackedMarketPrice?.toString() || '');
    setPackedOriginalPrice(initialPackedOriginalPrice?.toString() || '');
    setLoosePurchasePrice(initialLoosePurchasePrice?.toString() || '');
    setLooseMarketPrice(initialLooseMarketPrice?.toString() || '');
    setPriceSaved(false); // Reset saved state when props change
  }, [initialNotes, initialPackedPurchasePrice, initialPackedMarketPrice, initialPackedOriginalPrice, initialLoosePurchasePrice, initialLooseMarketPrice]);

  const handleSaveNotes = async () => {
    if (!modelId) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('id', modelId.toString());
      formData.append('notes', notes);

      const response = await fetch('/api/models/update-notes', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error('Error saving notes:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrice = async () => {
    if (!modelId) return;
    setSaving(true);
    setPriceSaved(false);
    try {
      const formData = new FormData();
      formData.append('id', modelId.toString());
      formData.append('packedPurchasePrice', packedPurchasePrice || '');
      formData.append('packedMarketPrice', packedMarketPrice || '');
      formData.append('packedOriginalPrice', packedOriginalPrice || '');
      formData.append('loosePurchasePrice', loosePurchasePrice || '');
      formData.append('looseMarketPrice', looseMarketPrice || '');

      console.log('Sending price update request for model:', modelId);
      console.log('Price values:', {
        packedPurchasePrice,
        packedMarketPrice,
        packedOriginalPrice,
        loosePurchasePrice,
        looseMarketPrice,
      });

      const response = await fetch('/api/models/update-price', {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status, response.statusText);
      console.log('Response ok:', response.ok);

      if (response.ok) {
        const result = await response.json();
        console.log('Price saved successfully:', result);
        setPriceSaved(true);
        router.refresh();
        // Reset saved state after 3 seconds
        setTimeout(() => {
          setPriceSaved(false);
        }, 3000);
      } else {
        // Try to get error message from response
        let errorMessage = 'Failed to save price';
        try {
          const errorData = await response.json();
          console.error('Error response data:', errorData);
          errorMessage = errorData.error || errorData.details || errorMessage;
        } catch (parseError) {
          // If response is not JSON, get text
          try {
            const errorText = await response.text();
            console.error('Error saving price (text):', errorText);
            errorMessage = errorText || errorMessage;
          } catch (textError) {
            console.error('Error saving price (status):', response.status, response.statusText);
            errorMessage = `Error ${response.status}: ${response.statusText}`;
          }
        }
        // You could show a toast notification here if you have one
        alert(errorMessage);
      }
    } catch (err) {
      console.error('Error saving price:', err);
      setPriceSaved(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Notlar */}
      <div className="pt-2 border-t">
        <div className="font-semibold text-sm mb-2">Notlar:</div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notlarınızı buraya yazın..."
          className="min-h-[100px]"
        />
        <Button
          onClick={handleSaveNotes}
          disabled={saving}
          className="mt-2 w-full"
          size="sm"
        >
          {saving ? 'Kaydediliyor...' : 'Notları Kaydet'}
        </Button>
      </div>

      {/* Fiyat */}
      <div className="pt-2 border-t">
        <div className="font-semibold text-sm mb-2">Fiyat:</div>
        <div className="space-y-4">
          {/* Packed Fiyatlar */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Packed (Kutusunda)</Label>
            <div className="space-y-2">
              <div>
                <Label htmlFor="packedPurchasePrice" className="text-xs text-muted-foreground">
                  Alınan Fiyat (€)
                </Label>
                <Input
                  id="packedPurchasePrice"
                  type="number"
                  step="0.01"
                  value={packedPurchasePrice}
                  onChange={(e) => setPackedPurchasePrice(e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="packedMarketPrice" className="text-xs text-muted-foreground">
                  Piyasa Değeri (€)
                </Label>
                <Input
                  id="packedMarketPrice"
                  type="number"
                  step="0.01"
                  value={packedMarketPrice}
                  onChange={(e) => setPackedMarketPrice(e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="packedOriginalPrice" className="text-xs text-muted-foreground">
                  Orjinal Fiyat (€)
                </Label>
                <Input
                  id="packedOriginalPrice"
                  type="number"
                  step="0.01"
                  value={packedOriginalPrice}
                  onChange={(e) => setPackedOriginalPrice(e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          
          {/* Loose Fiyatlar */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Loose (Kutusuz)</Label>
            <div className="space-y-2">
              <div>
                <Label htmlFor="loosePurchasePrice" className="text-xs text-muted-foreground">
                  Alınan Fiyat (€)
                </Label>
                <Input
                  id="loosePurchasePrice"
                  type="number"
                  step="0.01"
                  value={loosePurchasePrice}
                  onChange={(e) => setLoosePurchasePrice(e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="looseMarketPrice" className="text-xs text-muted-foreground">
                  Piyasa Değeri (€)
                </Label>
                <Input
                  id="looseMarketPrice"
                  type="number"
                  step="0.01"
                  value={looseMarketPrice}
                  onChange={(e) => setLooseMarketPrice(e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          
          <Button
            onClick={handleSavePrice}
            disabled={saving}
            className={`w-full ${priceSaved ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
            size="sm"
          >
            {saving ? 'Kaydediliyor...' : priceSaved ? '✓ Kaydedildi' : 'Fiyatı Kaydet'}
          </Button>
        </div>
      </div>
    </>
  );
}



