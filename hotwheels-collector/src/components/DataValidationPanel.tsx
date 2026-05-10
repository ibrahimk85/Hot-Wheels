'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Info, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  severity: 'high' | 'medium' | 'low';
  entity: 'model' | 'variant' | 'collection' | 'image';
  entityId: number;
  field?: string;
  message: string;
  suggestion?: string;
}

interface ValidationResult {
  totalIssues: number;
  errors: number;
  warnings: number;
  info: number;
  issues: ValidationIssue[];
}

export function DataValidationPanel() {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    runValidation();
  }, []);

  const runValidation = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/data-management/validate');
      if (response.ok) {
        const data = await response.json();
        setResult(data);
      }
    } catch (error) {
      console.error('Validation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <Info className="h-4 w-4 text-yellow-600" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getEntityLink = (entity: string, entityId: number) => {
    switch (entity) {
      case 'model':
        return `/model/${entityId}`;
      case 'variant':
        return `/variants?variantId=${entityId}`;
      case 'collection':
        return `/collections/${entityId}`;
      default:
        return '#';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Veri Doğrulama</CardTitle>
            <CardDescription>
              Koleksiyon verilerinizin tutarlılığını kontrol edin
            </CardDescription>
          </div>
          <Button onClick={runValidation} disabled={loading} variant="outline" size="sm">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Yenile
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Doğrulama yapılıyor...</span>
          </div>
        ) : result ? (
          <div className="space-y-4">
            {result.totalIssues === 0 ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Harika!</AlertTitle>
                <AlertDescription>
                  Verilerinizde herhangi bir tutarsızlık bulunamadı.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                    <div className="text-sm text-muted-foreground">Hatalar</div>
                    <div className="text-2xl font-bold text-red-600">{result.errors}</div>
                  </div>
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                    <div className="text-sm text-muted-foreground">Uyarılar</div>
                    <div className="text-2xl font-bold text-yellow-600">{result.warnings}</div>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div className="text-sm text-muted-foreground">Bilgiler</div>
                    <div className="text-2xl font-bold text-blue-600">{result.info}</div>
                  </div>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {result.issues.map((issue, index) => (
                    <Alert key={index} variant={issue.type === 'error' ? 'destructive' : 'default'}>
                      <div className="flex items-start gap-2">
                        {getTypeIcon(issue.type)}
                        <div className="flex-1">
                          <AlertTitle className="flex items-center gap-2">
                            <span>{issue.message}</span>
                            <Badge variant={getSeverityColor(issue.severity)}>
                              {issue.severity}
                            </Badge>
                          </AlertTitle>
                          <AlertDescription className="mt-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs">
                                {issue.entity} #{issue.entityId}
                              </span>
                              {issue.field && (
                                <span className="text-xs text-muted-foreground">
                                  • {issue.field}
                                </span>
                              )}
                            </div>
                            {issue.suggestion && (
                              <div className="mt-2 text-sm">{issue.suggestion}</div>
                            )}
                            <Link
                              href={getEntityLink(issue.entity, issue.entityId)}
                              className="mt-2 inline-block text-sm text-primary hover:underline"
                            >
                              Detayları görüntüle →
                            </Link>
                          </AlertDescription>
                        </div>
                      </div>
                    </Alert>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            Doğrulama sonucu bulunamadı
          </div>
        )}
      </CardContent>
    </Card>
  );
}



