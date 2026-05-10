'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Share2, Copy, Check, QrCode, Download, Facebook, Twitter, MessageCircle } from 'lucide-react';

interface ShareDialogProps {
  type: 'collection' | 'model' | 'variant';
  targetId: number;
  targetName?: string;
}

export function ShareDialog({ type, targetId, targetName }: ShareDialogProps) {
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const generateShareLink = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/share/generate-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          targetId,
          isPublic,
          expiresInDays,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to generate share link: ${response.status}`
        );
      }

      const data = await response.json();
      const fullUrl = `${window.location.origin}/share/${data.shareId}`;
      setShareLink(fullUrl);

      // QR kod oluştur (browser-only)
      if (typeof window !== 'undefined') {
        const QRCodeModule = await import('qrcode');
        const qrCode = await QRCodeModule.default.toDataURL(fullUrl, {
          width: 300,
          margin: 2,
        });
        setQrCodeDataUrl(qrCode);
      }
    } catch (error) {
      console.error('Error generating share link:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Paylaşım linki oluşturulurken bir hata oluştu.'
      );
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (shareLink) {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareToSocial = (platform: 'facebook' | 'twitter' | 'whatsapp') => {
    if (!shareLink) return;

    const text = encodeURIComponent(
      targetName
        ? `${targetName} koleksiyonumu paylaşıyorum!`
        : 'Hot Wheels koleksiyonumu paylaşıyorum!'
    );
    const url = encodeURIComponent(shareLink);

    let shareUrl = '';

    switch (platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${text}%20${url}`;
        break;
    }

    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  const downloadQRCode = () => {
    if (!qrCodeDataUrl) return;

    const link = document.createElement('a');
    link.download = `qr-code-${targetId}.png`;
    link.href = qrCodeDataUrl;
    link.click();
  };

  useEffect(() => {
    if (open && !shareLink) {
      generateShareLink();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          Paylaş
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Paylaşım Linki Oluştur</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="isPublic">Herkese Açık</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isPublic"
                checked={isPublic}
                onCheckedChange={(checked) => setIsPublic(checked === true)}
              />
              <label
                htmlFor="isPublic"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Link herkes tarafından görüntülenebilir
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiresInDays">Süre Sınırı (Gün)</Label>
            <Input
              id="expiresInDays"
              type="number"
              placeholder="Sınırsız (boş bırakın)"
              min="1"
              value={expiresInDays || ''}
              onChange={(e) =>
                setExpiresInDays(
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
            />
          </div>

          {loading ? (
            <div className="text-center py-4 text-muted-foreground">
              Link oluşturuluyor...
            </div>
          ) : shareLink ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Paylaşım Linki</Label>
                <div className="flex gap-2">
                  <Input value={shareLink} readOnly className="flex-1" />
                  <Button
                    onClick={copyToClipboard}
                    variant="outline"
                    size="icon"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {qrCodeDataUrl && (
                <div className="space-y-2">
                  <Label>QR Kod</Label>
                  <div className="flex flex-col items-center gap-2 p-4 bg-muted rounded-lg">
                    <img
                      src={qrCodeDataUrl}
                      alt="QR Code"
                      className="w-48 h-48"
                    />
                    <Button
                      onClick={downloadQRCode}
                      variant="outline"
                      size="sm"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      QR Kodu İndir
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Sosyal Medya Paylaşımı</Label>
                <div className="flex gap-2">
                  <Button
                    onClick={() => shareToSocial('facebook')}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Facebook className="h-4 w-4 mr-2" />
                    Facebook
                  </Button>
                  <Button
                    onClick={() => shareToSocial('twitter')}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Twitter className="h-4 w-4 mr-2" />
                    Twitter
                  </Button>
                  <Button
                    onClick={() => shareToSocial('whatsapp')}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button onClick={generateShareLink} className="w-full">
              Link Oluştur
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

