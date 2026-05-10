import jsPDF from 'jspdf';
import type {
  SummaryReportData,
  CollectionReportData,
  YearReportData,
  ValueReportData,
  MissingModelsReportData,
} from './report.service';

type ReportData =
  | SummaryReportData
  | CollectionReportData
  | YearReportData
  | ValueReportData
  | MissingModelsReportData;

type ReportType = 'summary' | 'collection' | 'year' | 'value' | 'missing';

interface PDFExportOptions {
  template?: 'executive' | 'detailed';
  includeCharts?: boolean;
}

/**
 * Enhanced PDF export service
 */
export class PDFExportService {
  private doc: jsPDF;
  private yPos: number = 20;
  private pageHeight: number;
  private pageWidth: number;
  private margin: number = 14;
  private template: 'executive' | 'detailed';

  constructor(options: PDFExportOptions = {}) {
    this.doc = new jsPDF();
    this.pageHeight = this.doc.internal.pageSize.height;
    this.pageWidth = this.doc.internal.pageSize.width;
    this.template = options.template || 'detailed';
  }

  /**
   * Add header to PDF
   */
  private addHeader(title: string, subtitle?: string) {
    this.doc.setFillColor(41, 128, 185);
    this.doc.rect(0, 0, this.pageWidth, 30, 'F');

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Hot Wheels Koleksiyon Raporu', this.margin, 15);

    if (subtitle) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(subtitle, this.margin, 22);
    }

    this.doc.setTextColor(0, 0, 0);
    this.yPos = 40;
  }

  /**
   * Add footer with page numbers
   */
  private addFooter() {
    const pageCount = this.doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(10);
      this.doc.setTextColor(128, 128, 128);
      this.doc.text(
        `Sayfa ${i} / ${pageCount}`,
        this.pageWidth / 2,
        this.pageHeight - 10,
        { align: 'center' }
      );
      this.doc.text(
        new Date().toLocaleDateString('tr-TR'),
        this.pageWidth - this.margin,
        this.pageHeight - 10,
        { align: 'right' }
      );
    }
  }

  /**
   * Check if new page is needed
   */
  private checkNewPage(requiredSpace: number = 20) {
    if (this.yPos + requiredSpace > this.pageHeight - 30) {
      this.doc.addPage();
      this.yPos = 20;
      return true;
    }
    return false;
  }

  /**
   * Add section title
   */
  private addSectionTitle(title: string) {
    this.checkNewPage(15);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(41, 128, 185);
    this.doc.text(title, this.margin, this.yPos);
    this.yPos += 8;
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(this.margin, this.yPos, this.pageWidth - this.margin, this.yPos);
    this.yPos += 10;
    this.doc.setTextColor(0, 0, 0);
  }

  /**
   * Add key-value pair
   */
  private addKeyValue(key: string, value: string | number) {
    this.checkNewPage(7);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`${key}:`, this.margin, this.yPos);
    this.doc.setFont('helvetica', 'normal');
    const text = String(value);
    const textWidth = this.doc.getTextWidth(text);
    if (textWidth > this.pageWidth - this.margin * 2 - 50) {
      // Split long text
      const lines = this.doc.splitTextToSize(text, this.pageWidth - this.margin * 2 - 50);
      this.doc.text(lines, this.margin + 50, this.yPos);
      this.yPos += lines.length * 5;
    } else {
      this.doc.text(text, this.margin + 50, this.yPos);
      this.yPos += 7;
    }
  }

  /**
   * Export summary report
   */
  exportSummary(data: SummaryReportData) {
    this.addHeader('Genel Özet Raporu');
    
    this.addSectionTitle('Özet İstatistikler');
    this.addKeyValue('Toplam Model', data.totalModels);
    this.addKeyValue('Toplam Varyant', data.totalVariants);
    this.addKeyValue('Sahip Olunan Varyant', data.ownedVariants);
    this.addKeyValue('Wishlist Sayısı', data.wishlistCount);
    
    this.addSectionTitle('Değer Bilgileri');
    this.addKeyValue('Toplam Değer', `${data.totalValue.total.toFixed(2)} TL`);
    this.addKeyValue('Kartlı Değer', `${data.totalValue.packed.toFixed(2)} TL`);
    this.addKeyValue('Kutusuz Değer', `${data.totalValue.loose.toFixed(2)} TL`);

    if (this.template === 'detailed' && data.collections.length > 0) {
      this.addSectionTitle('Koleksiyon Dağılımı');
      data.collections.slice(0, 20).forEach((c) => {
        this.checkNewPage(7);
        this.doc.text(
          `${c.name} (${c.year}): ${c.ownedCount}/${c.variantCount} varyant`,
          this.margin,
          this.yPos
        );
        this.yPos += 7;
      });
    }

    if (this.template === 'detailed' && data.years.length > 0) {
      this.addSectionTitle('Yıl Bazlı Dağılım');
      data.years.slice(0, 20).forEach((y) => {
        this.checkNewPage(7);
        this.doc.text(
          `${y.year}: ${y.ownedCount}/${y.variantCount} varyant`,
          this.margin,
          this.yPos
        );
        this.yPos += 7;
      });
    }

    this.addFooter();
    return this.doc;
  }

  /**
   * Export collection report
   */
  exportCollection(data: CollectionReportData) {
    this.addHeader('Koleksiyon Raporu', `${data.collectionName} (${data.year})`);
    
    this.addSectionTitle('Koleksiyon Bilgileri');
    this.addKeyValue('Koleksiyon Adı', data.collectionName);
    this.addKeyValue('Yıl', data.year);
    this.addKeyValue('Toplam Model', data.totalModels);
    this.addKeyValue('Sahip Olunan Model', data.ownedModels);
    this.addKeyValue('Eksik Model', data.missingModels);
    this.addKeyValue('Toplam Varyant', data.totalVariants);
    this.addKeyValue('Sahip Olunan Varyant', data.ownedVariants);

    this.addSectionTitle('Değer Bilgileri');
    this.addKeyValue('Toplam Değer', `${data.totalValue.total.toFixed(2)} TL`);
    this.addKeyValue('Kartlı Değer', `${data.totalValue.packed.toFixed(2)} TL`);
    this.addKeyValue('Kutusuz Değer', `${data.totalValue.loose.toFixed(2)} TL`);

    if (this.template === 'detailed' && data.models.length > 0) {
      this.addSectionTitle('Modeller');
      data.models.slice(0, 50).forEach((m) => {
        this.checkNewPage(7);
        const status = m.owned ? '✓' : '✗';
        this.doc.text(
          `${status} ${m.castingName} (${m.variantCount} varyant)`,
          this.margin,
          this.yPos
        );
        this.yPos += 7;
      });
    }

    this.addFooter();
    return this.doc;
  }

  /**
   * Export year report
   */
  exportYear(data: YearReportData) {
    this.addHeader('Yıl Raporu', `${data.year} Yılı`);
    
    this.addSectionTitle('Yıl Bilgileri');
    this.addKeyValue('Yıl', data.year);
    this.addKeyValue('Toplam Model', data.totalModels);
    this.addKeyValue('Sahip Olunan Model', data.ownedModels);
    this.addKeyValue('Toplam Varyant', data.totalVariants);
    this.addKeyValue('Sahip Olunan Varyant', data.ownedVariants);

    this.addSectionTitle('Değer Bilgileri');
    this.addKeyValue('Toplam Değer', `${data.totalValue.total.toFixed(2)} TL`);
    this.addKeyValue('Kartlı Değer', `${data.totalValue.packed.toFixed(2)} TL`);
    this.addKeyValue('Kutusuz Değer', `${data.totalValue.loose.toFixed(2)} TL`);

    if (this.template === 'detailed' && data.collections.length > 0) {
      this.addSectionTitle('Koleksiyon Dağılımı');
      data.collections.forEach((c) => {
        this.checkNewPage(7);
        this.doc.text(
          `${c.name}: ${c.ownedCount}/${c.variantCount} varyant`,
          this.margin,
          this.yPos
        );
        this.yPos += 7;
      });
    }

    this.addFooter();
    return this.doc;
  }

  /**
   * Export value report
   */
  exportValue(data: ValueReportData) {
    this.addHeader('Değer Analizi Raporu');
    
    this.addSectionTitle('Toplam Değer');
    this.addKeyValue('Toplam Değer', `${data.totalValue.total.toFixed(2)} TL`);
    this.addKeyValue('Kartlı Değer', `${data.totalValue.packed.toFixed(2)} TL`);
    this.addKeyValue('Kutusuz Değer', `${data.totalValue.loose.toFixed(2)} TL`);

    if (data.topValuableModels.length > 0) {
      this.addSectionTitle('En Değerli Modeller (Top 20)');
      data.topValuableModels.forEach((m, index) => {
        this.checkNewPage(7);
        this.doc.text(
          `${index + 1}. ${m.castingName}: ${m.value.toFixed(2)} TL`,
          this.margin,
          this.yPos
        );
        this.yPos += 7;
      });
    }

    if (this.template === 'detailed' && data.byCollection.length > 0) {
      this.addSectionTitle('Koleksiyon Bazlı Değer');
      data.byCollection.slice(0, 30).forEach((c) => {
        this.checkNewPage(7);
        this.doc.text(
          `${c.name} (${c.year}): ${c.value.toFixed(2)} TL (${c.variantCount} varyant)`,
          this.margin,
          this.yPos
        );
        this.yPos += 7;
      });
    }

    if (this.template === 'detailed' && data.byYear.length > 0) {
      this.addSectionTitle('Yıl Bazlı Değer');
      data.byYear.slice(0, 20).forEach((y) => {
        this.checkNewPage(7);
        this.doc.text(
          `${y.year}: ${y.value.toFixed(2)} TL (${y.variantCount} varyant)`,
          this.margin,
          this.yPos
        );
        this.yPos += 7;
      });
    }

    this.addFooter();
    return this.doc;
  }

  /**
   * Export missing models report
   */
  exportMissing(data: MissingModelsReportData) {
    const subtitle = [
      data.collectionName && `Koleksiyon: ${data.collectionName}`,
      data.year && `Yıl: ${data.year}`,
    ]
      .filter(Boolean)
      .join(' - ');

    this.addHeader('Eksik Modeller Raporu', subtitle || undefined);
    
    this.addSectionTitle('Özet');
    this.addKeyValue('Eksik Model Sayısı', data.totalMissing);
    if (data.collectionName) {
      this.addKeyValue('Koleksiyon', data.collectionName);
    }
    if (data.year) {
      this.addKeyValue('Yıl', data.year);
    }

    if (data.missingModels.length > 0) {
      this.addSectionTitle('Eksik Modeller');
      data.missingModels.forEach((m) => {
        this.checkNewPage(7);
        this.doc.text(
          `${m.castingName} - ${m.collectionName} (${m.year}) - ${m.subSeriesName}`,
          this.margin,
          this.yPos
        );
        this.yPos += 7;
      });
    }

    this.addFooter();
    return this.doc;
  }

  /**
   * Export report based on type
   */
  export(reportType: ReportType, data: ReportData) {
    switch (reportType) {
      case 'summary':
        return this.exportSummary(data as SummaryReportData);
      case 'collection':
        return this.exportCollection(data as CollectionReportData);
      case 'year':
        return this.exportYear(data as YearReportData);
      case 'value':
        return this.exportValue(data as ValueReportData);
      case 'missing':
        return this.exportMissing(data as MissingModelsReportData);
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }
  }

  /**
   * Save PDF
   */
  save(filename: string) {
    this.doc.save(filename);
  }

  /**
   * Get PDF as blob
   */
  getBlob(): Blob {
    return this.doc.output('blob');
  }
}

/**
 * Helper function to export report to PDF
 */
export function exportReportToPDF(
  reportType: ReportType,
  data: ReportData,
  options: PDFExportOptions = {}
): jsPDF {
  const service = new PDFExportService(options);
  return service.export(reportType, data);
}








