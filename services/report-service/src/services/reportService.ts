import PDFDocument from 'pdfkit';
type PDFDocumentType = InstanceType<typeof PDFDocument>;
import { createCanvas, loadImage, CanvasRenderingContext2D } from 'canvas';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import translationClient from '../config/translationClient.js';
import {
  ProcessedStockData,
  NewsArticle,
  FinancialAnalysis,
  ChartData,
  ReportAnalysisSectionId,
  ReportChartType,
  ReportConfig,
  ReportDesignConfig,
  ReportNewsMode,
  ReportSectionConfig,
  ReportSectionId,
  SupportedLanguage,
} from '../types/models.js';

interface ReportTheme {
  brandColor: string;
  accentColor: string;
  textColor: string;
  mutedTextColor: string;
  fontBody: string;
  fontHeading: string;
  fontItalic: string;
  densityScale: number;
  showCompanyName: boolean;
  showPageNumbers: boolean;
  footerDisclaimer: string;
  coverSubtitle: string;
  coverShowBadge: boolean;
  coverShowLogo: boolean;
  chartShowGrid: boolean;
  chartLineWidth: number;
}

/**
 * ReportService - Handles PDF generation for stock reports
 * Implements IReportService interface from design.md
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
class ReportService {
  private readonly DATA_SERVICE_URL: string;
  private readonly BRAND_COLOR = '#1a73e8'; // Primary brand color
  private readonly BRAND_COLOR_LIGHT = '#e8f0fe'; // Light brand color
  private readonly FONT_SIZE_TITLE = 24;
  private readonly FONT_SIZE_HEADING = 18;
  private readonly FONT_SIZE_BODY = 12;
  private readonly MARGIN = 50;
  private readonly PAGE_WIDTH = 612; // US Letter width in points
  private readonly PAGE_HEIGHT = 792; // US Letter height in points

  constructor() {
    this.DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://data-service:3001';
  }

  /**
   * Generate PDF report for a stock symbol
   * Property 14: PDF Report Content Completeness
   * Requirements: 5.1, 5.2, 5.3, 5.4
   * 
   * @param symbol Stock symbol
   * @param language Target language for translation
   * @param userId Optional user ID for metadata
   * @returns PDF buffer
   */
  async generatePDF(
    symbol: string,
    language: SupportedLanguage = 'en',
    userId: string = 'anonymous',
    reportConfig?: ReportConfig
  ): Promise<Buffer> {
    logger.info(`Generating PDF report for ${symbol} in language ${language}`);

    try {
      // Fetch stock data
      const stockData = await this.fetchStockData(symbol, language);
      const resolvedConfig = this.normalizeReportConfig(reportConfig);
      const theme = this.buildTheme(resolvedConfig.design);

      // Create PDF document
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: {
          top: this.MARGIN,
          bottom: this.MARGIN,
          left: this.MARGIN,
          right: this.MARGIN,
        },
      });
      doc.lineGap(theme.densityScale === 1 ? 2 : 0.5);

      // Collect PDF chunks
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      
      const pdfPromise = new Promise<Buffer>((resolve, reject) => {
        doc.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        doc.on('error', reject);
      });

      // Apply branding
      await this.applyBranding(doc, language, theme);

      const enabledSections = resolvedConfig.sections
        .filter((section) => section.enabled)
        .sort((a, b) => a.order - b.order);
      const hasCompanyOverview = enabledSections.some((section) => section.id === 'companyOverview');

      let isFirstSection = true;
      for (const section of enabledSections) {
        const startsNewPage = !isFirstSection && this.sectionStartsOnNewPage(section.id);
        const isAtTop = doc.y <= this.MARGIN + 1;
        if (startsNewPage && !isAtTop) {
          doc.addPage();
        }

        switch (section.id) {
          case 'cover':
            await this.addCoverPage(doc, stockData, language, theme);
            break;
          case 'stockSummary':
            await this.addStockSummary(doc, stockData, language, theme, !hasCompanyOverview);
            break;
          case 'companyOverview':
            await this.addCompanyOverview(doc, stockData, language, theme);
            break;
          case 'financialAnalysis':
            await this.addFinancialAnalysis(
              doc,
              stockData.analysis,
              language,
              theme,
              section.options?.analysisSections
            );
            break;
          case 'news':
            await this.addNewsArticles(doc, stockData.news, language, theme, {
              maxArticles: section.options?.newsCount,
              mode: section.options?.newsMode,
            });
            break;
          case 'priceChart':
            if (stockData.stockData.currentPrice > 0) {
              await this.addPriceChart(
                doc,
                stockData,
                language,
                theme,
                section.options?.chartType
              );
            }
            break;
          case 'appendix':
            await this.addAppendix(doc, language, theme, section.options?.appendixNotes);
            break;
          default:
            break;
        }

        isFirstSection = false;
      }

      // Finalize PDF
      doc.end();

      // Wait for PDF to be generated
      const pdfBuffer = await pdfPromise;
      
      logger.info(`PDF report generated successfully for ${symbol} (${pdfBuffer.length} bytes)`);
      return pdfBuffer;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to generate PDF for ${symbol}: ${errorMessage}`);
      throw new Error(`PDF generation failed: ${errorMessage}`);
    }
  }

  /**
   * Fetch stock data from DataService
   */
  private async fetchStockData(
    symbol: string,
    language: SupportedLanguage
  ): Promise<ProcessedStockData> {
    try {
      const response = await axios.get<ProcessedStockData>(
        `${this.DATA_SERVICE_URL}/stock/${symbol}`,
        {
          params: { language },
          timeout: 30000,
        }
      );
      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to fetch stock data: ${errorMessage}`);
      throw new Error(`Failed to fetch stock data: ${errorMessage}`);
    }
  }

  private getDefaultSections(): ReportSectionConfig[] {
    return [
      { id: 'cover', enabled: true, order: 0 },
      { id: 'stockSummary', enabled: true, order: 1 },
      { id: 'companyOverview', enabled: true, order: 2 },
      {
        id: 'financialAnalysis',
        enabled: true,
        order: 3,
        options: {
          analysisSections: [
            'competitors',
            'financialHealth',
            'growth',
            'profitability',
            'shareholderReturns',
            'valuation',
          ],
        },
      },
      {
        id: 'news',
        enabled: true,
        order: 4,
        options: { newsCount: 5, newsMode: 'full' },
      },
      {
        id: 'priceChart',
        enabled: true,
        order: 5,
        options: { chartType: 'line' },
      },
      {
        id: 'appendix',
        enabled: false,
        order: 6,
        options: { appendixNotes: 'Sources: Market data, filings, and public news feeds.' },
      },
    ];
  }

  private getPresetDesign(preset: ReportDesignConfig['preset']): ReportDesignConfig {
    const base = {
      header: { showCompanyName: true },
      footer: { showPageNumbers: true, disclaimer: '' },
      cover: { subtitle: '', showLogo: true, showBadge: true },
      chart: { showGrid: true, lineWidth: 2 },
    };

    switch (preset) {
      case 'investor':
        return {
          ...base,
          preset: 'investor',
          brandColor: '#0f766e',
          accentColor: '#ecfeff',
          fontFamily: 'serif',
          density: 'compact',
          cover: { subtitle: 'Investor Brief', showLogo: true, showBadge: true },
        };
      case 'minimal':
        return {
          ...base,
          preset: 'minimal',
          brandColor: '#111827',
          accentColor: '#f3f4f6',
          fontFamily: 'sans',
          density: 'compact',
          header: { showCompanyName: false },
          cover: { subtitle: 'Minimal Snapshot', showLogo: false, showBadge: true },
          chart: { showGrid: true, lineWidth: 1.5 },
        };
      case 'executive':
        return {
          ...base,
          preset: 'executive',
          brandColor: '#b45309',
          accentColor: '#fef3c7',
          fontFamily: 'serif',
          density: 'comfortable',
          cover: { subtitle: 'Executive Summary', showLogo: true, showBadge: true },
          chart: { showGrid: true, lineWidth: 2.5 },
        };
      case 'classic':
      default:
        return {
          ...base,
          preset: 'classic',
          brandColor: this.BRAND_COLOR,
          accentColor: this.BRAND_COLOR_LIGHT,
          fontFamily: 'sans',
          density: 'comfortable',
          cover: { subtitle: 'Equity Research Report', showLogo: true, showBadge: true },
        };
    }
  }

  private resolveDesignConfig(design?: ReportDesignConfig): ReportDesignConfig {
    const preset = design?.preset || 'classic';
    const presetDesign = this.getPresetDesign(preset);
    const merged: ReportDesignConfig = {
      ...presetDesign,
      ...design,
      header: { ...presetDesign.header, ...design?.header },
      footer: { ...presetDesign.footer, ...design?.footer },
      cover: { ...presetDesign.cover, ...design?.cover },
      chart: { ...presetDesign.chart, ...design?.chart },
    };

    merged.brandColor = this.sanitizeColor(merged.brandColor, presetDesign.brandColor);
    merged.accentColor = this.sanitizeColor(merged.accentColor, presetDesign.accentColor);
    merged.fontFamily = merged.fontFamily === 'serif' ? 'serif' : 'sans';
    merged.density = merged.density === 'compact' ? 'compact' : 'comfortable';

    if (merged.footer?.disclaimer) {
      merged.footer.disclaimer = merged.footer.disclaimer.trim().slice(0, 140);
    }
    if (merged.cover?.subtitle) {
      merged.cover.subtitle = merged.cover.subtitle.trim().slice(0, 80);
    }

    return merged;
  }

  private normalizeReportConfig(reportConfig?: ReportConfig): ReportConfig {
    const defaultSections = this.getDefaultSections();
    const design = this.resolveDesignConfig(reportConfig?.design);

    if (!reportConfig?.sections || reportConfig.sections.length === 0) {
      return { sections: defaultSections, design };
    }

    const allowedIds = new Set(defaultSections.map((section) => section.id));
    const normalizedSections = reportConfig.sections
      .filter((section) => allowedIds.has(section.id))
      .map((section, index) => {
        const fallback = defaultSections.find((item) => item.id === section.id);
        return {
          id: section.id,
          enabled: typeof section.enabled === 'boolean' ? section.enabled : fallback?.enabled ?? true,
          order: Number.isFinite(section.order) ? section.order : fallback?.order ?? index,
          options: this.normalizeSectionOptions(section.id, section.options, fallback?.options),
        };
      })
      .sort((a, b) => a.order - b.order)
      .map((section, index) => ({ ...section, order: index }));

    if (normalizedSections.length === 0) {
      return { sections: defaultSections, design };
    }

    if (!normalizedSections.some((section) => section.enabled)) {
      return { sections: defaultSections, design };
    }

    return { sections: normalizedSections, design };
  }

  private normalizeSectionOptions(
    id: ReportSectionId,
    options?: ReportSectionConfig['options'],
    fallback?: ReportSectionConfig['options']
  ): ReportSectionConfig['options'] {
    const normalized = { ...fallback, ...options };

    if (id === 'news') {
      const count = this.clampNumber(Number(normalized?.newsCount || 5), 1, 10);
      const mode: ReportNewsMode = normalized?.newsMode === 'summary' ? 'summary' : 'full';
      return { ...normalized, newsCount: count, newsMode: mode };
    }

    if (id === 'priceChart') {
      const chartType: ReportChartType =
        normalized?.chartType === 'bar' || normalized?.chartType === 'area'
          ? normalized.chartType
          : 'line';
      return { ...normalized, chartType };
    }

    if (id === 'financialAnalysis') {
      const allowed: ReportAnalysisSectionId[] = [
        'competitors',
        'financialHealth',
        'growth',
        'profitability',
        'shareholderReturns',
        'valuation',
      ];
      const next = (normalized?.analysisSections || []).filter((item) =>
        allowed.includes(item)
      );
      return {
        ...normalized,
        analysisSections: next.length > 0 ? next : allowed,
      };
    }

    if (id === 'appendix') {
      const notes = (normalized?.appendixNotes || fallback?.appendixNotes || '').trim();
      return { ...normalized, appendixNotes: notes.slice(0, 400) };
    }

    return normalized;
  }

  private buildTheme(design: ReportDesignConfig): ReportTheme {
    const fontFamily =
      design.fontFamily === 'serif'
        ? { body: 'Times-Roman', heading: 'Times-Bold', italic: 'Times-Italic' }
        : { body: 'Helvetica', heading: 'Helvetica-Bold', italic: 'Helvetica-Oblique' };
    const densityScale = design.density === 'compact' ? 0.85 : 1;

    return {
      brandColor: design.brandColor || this.BRAND_COLOR,
      accentColor: design.accentColor || this.BRAND_COLOR_LIGHT,
      textColor: '#111827',
      mutedTextColor: '#6b7280',
      fontBody: fontFamily.body,
      fontHeading: fontFamily.heading,
      fontItalic: fontFamily.italic,
      densityScale,
      showCompanyName: design.header?.showCompanyName ?? true,
      showPageNumbers: design.footer?.showPageNumbers ?? true,
      footerDisclaimer: design.footer?.disclaimer?.trim() || '',
      coverSubtitle: design.cover?.subtitle?.trim() || '',
      coverShowBadge: design.cover?.showBadge ?? true,
      coverShowLogo: design.cover?.showLogo ?? true,
      chartShowGrid: design.chart?.showGrid ?? true,
      chartLineWidth: this.clampNumber(design.chart?.lineWidth ?? 2, 1, 4),
    };
  }

  private sectionStartsOnNewPage(sectionId: ReportSectionId): boolean {
    return ['cover', 'companyOverview', 'financialAnalysis', 'news', 'priceChart', 'appendix'].includes(sectionId);
  }

  private clampNumber(value: number, min: number, max: number): number {
    if (Number.isNaN(value)) {
      return min;
    }
    return Math.min(Math.max(value, min), max);
  }

  private sanitizeColor(color: string | undefined, fallback?: string): string {
    if (color && /^#([0-9a-fA-F]{3}){1,2}$/.test(color)) {
      return color;
    }
    return fallback || this.BRAND_COLOR;
  }

  /**
   * Apply branding to PDF document
   * Requirements: 5.2
   */
  private async applyBranding(
    doc: PDFDocumentType,
    language: SupportedLanguage,
    theme: ReportTheme
  ): Promise<void> {
    const companyName = await this.getLabel('ui.companyName', language, 'Hippo Equity Research');
    const pageText = await this.getLabel('ui.page', language, 'Page');
    const headerHeight = 38;
    const footerY = this.PAGE_HEIGHT - this.MARGIN - 14;

    const drawHeaderFooter = (pageNumber: number) => {
      const previousX = doc.x;
      const previousY = doc.y;

      // Header
      doc.fillColor(theme.brandColor)
        .rect(0, 0, this.PAGE_WIDTH, headerHeight)
        .fill();

      if (theme.showCompanyName) {
        doc.fillColor('white')
          .fontSize(14)
          .font(theme.fontHeading)
          .text(companyName, this.MARGIN, 10, {
            width: this.PAGE_WIDTH - 2 * this.MARGIN,
          });
      }

      // Footer
      if (theme.footerDisclaimer) {
        doc.fillColor(theme.mutedTextColor)
          .fontSize(8)
          .font(theme.fontBody)
          .text(theme.footerDisclaimer, this.MARGIN, footerY - 10, {
            width: this.PAGE_WIDTH - 2 * this.MARGIN,
            align: 'left',
            lineBreak: false,
          });
      }

      if (theme.showPageNumbers) {
        doc.fillColor(theme.mutedTextColor)
          .fontSize(9)
          .font(theme.fontBody)
          .text(`${pageText} ${pageNumber}`, this.MARGIN, footerY, {
            align: 'right',
            width: this.PAGE_WIDTH - 2 * this.MARGIN,
            lineBreak: false,
          });
      }

      doc.x = previousX;
      doc.y = previousY;
    };

    let pageNumber = 1;
    drawHeaderFooter(pageNumber);

    doc.on('pageAdded', () => {
      pageNumber += 1;
      drawHeaderFooter(pageNumber);
    });
  }

  /**
   * Add cover page with logo
   * Requirements: 5.2
   */
  private async addCoverPage(
    doc: PDFDocumentType,
    stockData: ProcessedStockData,
    language: SupportedLanguage,
    theme: ReportTheme
  ): Promise<void> {
    // Try to include logo (placeholder for now)
    // In production, this would fetch from MinIO or external URL
    if (theme.coverShowLogo) {
      try {
        // await this.includeLogo(doc, stockData.symbol);
      } catch (error) {
        logger.warn('Logo inclusion failed, continuing without logo');
      }
    }

    doc.fillColor(theme.accentColor)
      .rect(0, 60, this.PAGE_WIDTH, 150)
      .fill();

    // Title
    const reportTitle = await translationClient.translate('ui.stockReport', language);
    doc.fontSize(this.FONT_SIZE_TITLE)
       .font(theme.fontHeading)
       .fillColor(theme.brandColor)
       .text(
         `${reportTitle || 'Stock Report'}: ${stockData.symbol}`,
         this.MARGIN,
         105,
         {
           align: 'center',
           width: this.PAGE_WIDTH - 2 * this.MARGIN,
         }
       );

    if (theme.coverSubtitle) {
      doc.fontSize(14)
        .font(theme.fontBody)
        .fillColor(theme.textColor)
        .text(theme.coverSubtitle, this.MARGIN, 145, {
          align: 'center',
          width: this.PAGE_WIDTH - 2 * this.MARGIN,
        });
    }

    if (theme.coverShowBadge) {
      const priceLabel = `$${stockData.stockData.currentPrice.toFixed(2)}`;
      const badgeText = `${stockData.symbol}  ${priceLabel}`;
      doc.fontSize(12).font(theme.fontHeading);
      const badgeWidth = doc.widthOfString(badgeText) + 24;
      const badgeX = (this.PAGE_WIDTH - badgeWidth) / 2;
      const badgeY = 185;
      doc.fillColor(theme.brandColor)
        .roundedRect(badgeX, badgeY, badgeWidth, 26, 13)
        .fill();
      doc.fillColor('white')
        .text(badgeText, badgeX, badgeY + 7, {
          width: badgeWidth,
          align: 'center',
        });
    }

    // Date
    const generatedDate = await translationClient.translate('ui.generatedOn', language);
    const date = new Date().toLocaleDateString();
    doc.fontSize(this.FONT_SIZE_BODY)
       .font(theme.fontBody)
       .fillColor(theme.mutedTextColor)
       .text(
         `${generatedDate || 'Generated on'}: ${date}`,
         this.MARGIN,
         235,
         {
           align: 'center',
           width: this.PAGE_WIDTH - 2 * this.MARGIN,
         }
       );

  }

  /**
   * Include company logo in PDF
   * Requirements: 5.2
   */
  async includeLogo(doc: PDFDocumentType, logoUrl: string): Promise<void> {
    try {
      // Fetch logo image
      const response = await axios.get(logoUrl, {
        responseType: 'arraybuffer',
        timeout: 5000,
      });

      const imageBuffer = Buffer.from(response.data);
      doc.image(imageBuffer, this.MARGIN, 50, {
        width: 100,
        height: 100,
        fit: [100, 100],
        align: 'center',
      });

      logger.info('Logo included successfully');
    } catch (error) {
      logger.warn(`Failed to include logo from ${logoUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Add stock summary section
   * Requirements: 5.1
   */
  private async addStockSummary(
    doc: PDFDocumentType,
    stockData: ProcessedStockData,
    language: SupportedLanguage,
    theme: ReportTheme,
    includeCompanyOverview: boolean = false
  ): Promise<void> {
    const [
      sectionTitle,
      currentPriceLabel,
      changeLabel,
      previousCloseLabel,
      tradingDateLabel,
    ] = await Promise.all([
      this.getLabel('ui.stockSummary', language),
      this.getLabel('metrics.currentPrice', language, 'Current Price'),
      this.getLabel('metrics.priceChange', language, 'Price Change'),
      this.getLabel('metrics.previousClose', language, 'Previous Close'),
      this.getLabel('metrics.tradingDate', language, 'Trading Date'),
    ]);

    this.addSectionHeader(doc, sectionTitle, theme);

    const data = stockData.stockData;
    
    // Current price
    doc.fontSize(this.FONT_SIZE_BODY)
       .font(theme.fontHeading)
       .fillColor(theme.textColor)
       .text(currentPriceLabel, this.MARGIN, doc.y + 10);
    
    doc.font(theme.fontBody)
       .text(`$${data.currentPrice.toFixed(2)}`, this.MARGIN + 150, doc.y - 12);

    // Price change
    doc.font(theme.fontHeading)
       .text(changeLabel, this.MARGIN, doc.y + 10);
    
    const changeColor = data.priceChange >= 0 ? '#00aa00' : '#aa0000';
    doc.font(theme.fontBody)
       .fillColor(changeColor)
       .text(
         `${data.priceChange >= 0 ? '+' : ''}${data.priceChange.toFixed(2)} (${data.priceChangePercent.toFixed(2)}%)`,
         this.MARGIN + 150,
         doc.y - 12
       );

    // Previous close
    doc.fillColor(theme.textColor)
       .font(theme.fontHeading)
       .text(previousCloseLabel, this.MARGIN, doc.y + 10);
    
    doc.font(theme.fontBody)
       .text(`$${data.previousClose.toFixed(2)}`, this.MARGIN + 150, doc.y - 12);

    // Trading date
    doc.font(theme.fontHeading)
       .text(tradingDateLabel, this.MARGIN, doc.y + 10);
    
    doc.font(theme.fontBody)
       .text(data.tradingDate, this.MARGIN + 150, doc.y - 12);

    doc.moveDown(1);
    void includeCompanyOverview;
  }

  private async addCompanyOverview(
    doc: PDFDocumentType,
    stockData: ProcessedStockData,
    language: SupportedLanguage,
    theme: ReportTheme
  ): Promise<void> {
    const sectionTitle = await this.getLabel('ui.companyDescription', language, 'Company Overview');
    this.addSectionHeader(doc, sectionTitle, theme);

    const overview = stockData.analysis?.companyDescription?.trim() || '';
    if (!overview) {
      doc.fontSize(this.FONT_SIZE_BODY)
         .font(theme.fontBody)
         .fillColor(theme.mutedTextColor)
         .text('No company overview data available.', {
           width: this.PAGE_WIDTH - 2 * this.MARGIN,
         });
      doc.moveDown(1);
      return;
    }

    this.renderLongFormText(doc, overview, theme, {
      fontSize: this.FONT_SIZE_BODY,
      align: 'justify',
    });
  }

  /**
   * Add financial analysis section
   * Requirements: 5.1
   */
  private async addFinancialAnalysis(
    doc: PDFDocumentType,
    analysis: FinancialAnalysis,
    language: SupportedLanguage,
    theme: ReportTheme,
    analysisSections?: ReportAnalysisSectionId[]
  ): Promise<void> {
    const sectionTitle = await this.getLabel('ui.financialAnalysis', language);
    const [industryLabel, ratingLabel, keyPointsLabel, summaryLabel] = await Promise.all([
      this.getLabel('ui.industry', language, 'Industry'),
      this.getLabel('ui.rating', language, 'Rating'),
      this.getLabel('ui.keyPoints', language, 'Key Points'),
      this.getLabel('ui.summary', language, 'Summary'),
    ]);

    const introHeight = this.getFinancialAnalysisIntroHeight(doc, analysis, {
      industry: industryLabel,
      rating: ratingLabel,
      keyPoints: keyPointsLabel,
      summary: summaryLabel,
    }, theme);
    this.ensureSpace(doc, introHeight);
    this.addSectionHeader(doc, sectionTitle, theme);

    // Add each analysis section
    const sections: Array<{
      id: ReportAnalysisSectionId;
      key: string;
      value: { keyPoints: string[]; rating?: number; summary: string; industry?: string };
    }> = [
      { id: 'competitors', key: 'ui.competitors', value: analysis.competitors },
      { id: 'financialHealth', key: 'ui.financialHealth', value: analysis.financialHealth },
      { id: 'growth', key: 'ui.growth', value: analysis.growth },
      { id: 'profitability', key: 'ui.profitability', value: analysis.profitability },
      { id: 'shareholderReturns', key: 'ui.shareholderReturns', value: analysis.shareholder_returns },
      { id: 'valuation', key: 'ui.valuation', value: analysis.valuation },
    ];

    const filteredSections = analysisSections && analysisSections.length > 0
      ? sections.filter((section) => analysisSections.includes(section.id))
      : sections;

    for (const section of filteredSections) {
      const title = await this.getLabel(section.key, language);
      this.addAnalysisSection(doc, title, section.value, {
        industry: industryLabel,
        rating: ratingLabel,
        keyPoints: keyPointsLabel,
        summary: summaryLabel,
      }, theme);
    }
  }

  /**
   * Add a single analysis section
   */
  private addAnalysisSection(
    doc: PDFDocumentType,
    title: string,
    section: { keyPoints: string[]; rating?: number; summary: string; industry?: string },
    labels: { industry: string; rating: string; keyPoints: string; summary: string },
    theme: ReportTheme
  ): void {
    const sectionHeight = this.getAnalysisSectionHeight(doc, title, section, labels, theme);
    this.ensureSpace(doc, sectionHeight);
    // Section title
    doc.fontSize(this.FONT_SIZE_HEADING)
       .font(theme.fontHeading)
       .fillColor(theme.brandColor)
       .text(title, this.MARGIN, doc.y + 10);
    doc.moveDown(0.5);

    // Industry (if available)
    if (section.industry) {
      doc.fontSize(this.FONT_SIZE_BODY)
         .font(theme.fontHeading)
         .fillColor(theme.textColor)
         .text(`${labels.industry}: ${section.industry}`, {
           width: this.PAGE_WIDTH - 2 * this.MARGIN,
         });
      doc.moveDown(0.5);
    }

    // Rating (if available)
    if (section.rating !== undefined) {
      doc.fontSize(this.FONT_SIZE_BODY)
         .font(theme.fontHeading)
         .fillColor(theme.textColor)
         .text(`${labels.rating}: ${section.rating}/5`, {
           width: this.PAGE_WIDTH - 2 * this.MARGIN,
         });
      doc.moveDown(0.5);
    }

    // Key points
    if (section.keyPoints && section.keyPoints.length > 0) {
      doc.fontSize(this.FONT_SIZE_BODY)
         .font(theme.fontHeading)
         .fillColor(theme.textColor)
         .text(labels.keyPoints, {
           width: this.PAGE_WIDTH - 2 * this.MARGIN,
         });
      doc.moveDown(0.3);
      this.addBulletList(doc, section.keyPoints, theme);
      doc.moveDown(0.5);
    }

    // Summary
    if (section.summary) {
      doc.fontSize(this.FONT_SIZE_BODY)
         .font(theme.fontHeading)
         .fillColor(theme.textColor)
         .text(labels.summary, {
           width: this.PAGE_WIDTH - 2 * this.MARGIN,
         });
      doc.moveDown(0.3);
      this.ensureSpace(doc, this.getTextHeight(doc, section.summary, this.PAGE_WIDTH - 2 * this.MARGIN));
      doc.fontSize(this.FONT_SIZE_BODY)
         .font(theme.fontBody)
         .fillColor(theme.textColor)
         .text(section.summary, {
           width: this.PAGE_WIDTH - 2 * this.MARGIN,
           align: 'justify',
         });
      doc.moveDown(1);
    }
  }

  /**
   * Add news articles section
   * Requirements: 5.1
   */
  private async addNewsArticles(
    doc: PDFDocumentType,
    articles: NewsArticle[],
    language: SupportedLanguage,
    theme: ReportTheme,
    options?: { maxArticles?: number; mode?: ReportNewsMode }
  ): Promise<void> {
    const sectionTitle = await this.getLabel('ui.newsArticles', language);
    const maxArticles = options?.maxArticles ?? 10;
    const mode = options?.mode ?? 'full';
    const selectedArticles = articles.slice(0, maxArticles);
    if (selectedArticles.length === 0) {
      this.addSectionHeader(doc, sectionTitle, theme);
      doc.fontSize(this.FONT_SIZE_BODY)
         .font(theme.fontBody)
         .fillColor(theme.mutedTextColor)
         .text('No news articles available.', {
           width: this.PAGE_WIDTH - 2 * this.MARGIN,
         });
      doc.moveDown(1);
      return;
    }

    selectedArticles.forEach((article, index) => {
      if (index > 0) {
        doc.addPage();
      }

      this.addSectionHeader(doc, sectionTitle, theme);

      const titleHeight = this.getTextHeight(
        doc,
        `${article.title}`,
        this.PAGE_WIDTH - 2 * this.MARGIN
      );
      const metaHeight = this.getTextHeight(
        doc,
        'Date | Sentiment',
        this.PAGE_WIDTH - 2 * this.MARGIN
      );
      this.ensureSpace(doc, titleHeight + metaHeight + 20);

      // Article title
      doc.fontSize(this.FONT_SIZE_HEADING)
         .font(theme.fontHeading)
         .fillColor(theme.brandColor)
         .text(`${article.title}`, {
           width: this.PAGE_WIDTH - 2 * this.MARGIN,
         });
      doc.moveDown(0.3);

      // Date and sentiment
      const date = new Date(article.publishedAt).toLocaleDateString();
      const sentimentLabel = this.getSentimentLabel(article.sentiment, language);
      doc.fontSize(10)
         .font(theme.fontBody)
         .fillColor(theme.mutedTextColor)
         .text(`${date} | ${sentimentLabel}`, {
           width: this.PAGE_WIDTH - 2 * this.MARGIN,
         });
      doc.moveDown(0.5);

      // Full content
      const contentText = mode === 'summary'
        ? (article.contentPreview || article.content || '')
        : (article.content || article.contentPreview || '');
      if (contentText) {
        this.renderNewsContentToFitPage(doc, contentText, theme, sectionTitle, article.title);
      }
    });
  }

  /**
   * Add price chart
   * Requirements: 5.4
   */
  private async addPriceChart(
    doc: PDFDocumentType,
    stockData: ProcessedStockData,
    language: SupportedLanguage,
    theme: ReportTheme,
    chartType: ReportChartType = 'line'
  ): Promise<void> {
    const tradingDate = this.parseTradingDate(stockData.stockData.tradingDate);
    const labels = this.buildDateLabels(tradingDate, 30);
    const values = this.buildPriceSeries(
      stockData.stockData.previousClose,
      stockData.stockData.currentPrice,
      labels.length
    );

    const chartData: ChartData = {
      labels,
      values,
      title: 'Price History',
      type: chartType,
    };

    const chartTitle = await this.getLabel('metrics.priceHistory', language, 'Price History');
    this.addSectionHeader(doc, chartTitle, theme);

    await this.renderCharts(doc, [chartData], language, theme);
  }

  private async addAppendix(
    doc: PDFDocumentType,
    language: SupportedLanguage,
    theme: ReportTheme,
    notes?: string
  ): Promise<void> {
    const sectionTitle = await this.getLabel('ui.appendix', language, 'Appendix');
    this.addSectionHeader(doc, sectionTitle, theme);

    const content = notes?.trim()
      ? notes.trim()
      : 'Sources: Market data, regulatory filings, and public news feeds.';

    doc.fontSize(this.FONT_SIZE_BODY)
       .font(theme.fontBody)
       .fillColor(theme.textColor)
       .text(content, {
         width: this.PAGE_WIDTH - 2 * this.MARGIN,
         align: 'justify',
       });
    doc.moveDown(1);
  }

  /**
   * Render charts as images and embed in PDF
   * Requirements: 5.4
   */
  async renderCharts(
    doc: PDFDocumentType,
    charts: ChartData[],
    language: SupportedLanguage,
    theme: ReportTheme
  ): Promise<void> {
    for (const chart of charts) {
      try {
        // Check if we need a new page
        if (doc.y > this.PAGE_HEIGHT - 300) {
          doc.addPage();
        }

        // Create canvas for chart
        const canvas = createCanvas(500, 300);
        const ctx = canvas.getContext('2d');

        // Draw chart background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 500, 300);

        // Draw chart based on type
        if (chart.type === 'line' || !chart.type) {
          this.drawLineChart(ctx, chart, theme);
        } else if (chart.type === 'bar') {
          this.drawBarChart(ctx, chart, theme);
        } else if (chart.type === 'area') {
          this.drawAreaChart(ctx, chart, theme);
        }

        // Convert canvas to image buffer
        const imageBuffer = canvas.toBuffer('image/png');

        // Add to PDF
        const chartX = this.MARGIN;
        const chartY = doc.y + 10;
        const chartWidth = 500;
        const chartHeight = 300;
        doc.image(imageBuffer, chartX, chartY, {
          width: 500,
          height: 300,
          fit: [500, 300],
        });

        this.renderChartAxisLabels(doc, chart, theme, {
          x: chartX,
          y: chartY,
          width: chartWidth,
          height: chartHeight,
        });

        doc.moveDown(3);
        logger.info('Chart rendered and embedded successfully');
      } catch (error) {
        logger.warn(`Failed to render chart: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Continue without chart
      }
    }
  }

  /**
   * Draw line chart on canvas
   */
  private drawLineChart(ctx: CanvasRenderingContext2D, chart: ChartData, theme: ReportTheme): void {
    const padding = 40;
    const chartWidth = 500 - 2 * padding;
    const chartHeight = 300 - 2 * padding - 20;
    const startX = padding;
    const startY = padding + 20;

    if (chart.values.length === 0) return;

    // Calculate scale
    const minValue = Math.min(...chart.values);
    const maxValue = Math.max(...chart.values);
    const range = maxValue - minValue || 1;
    const scaleY = chartHeight / range;

    // Draw grid and axes
    ctx.strokeStyle = theme.chartShowGrid ? '#e5e7eb' : 'transparent';
    ctx.lineWidth = 1;
    const steps = 4;
    for (let i = 0; i <= steps; i += 1) {
      const y = startY + (chartHeight / steps) * i;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + chartWidth, y);
      ctx.stroke();
    }

    if (theme.chartShowGrid) {
      ctx.strokeStyle = '#9ca3af';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(startX, startY + chartHeight);
      ctx.lineTo(startX + chartWidth, startY + chartHeight);
      ctx.stroke();
    }

    // Draw line
    ctx.strokeStyle = theme.brandColor;
    ctx.lineWidth = theme.chartLineWidth;
    ctx.beginPath();

    chart.values.forEach((value, index) => {
      const x = startX + (index / (chart.values.length - 1 || 1)) * chartWidth;
      const y = startY + chartHeight - (value - minValue) * scaleY;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw data points
    ctx.fillStyle = theme.brandColor;
    chart.values.forEach((value, index) => {
      const x = startX + (index / (chart.values.length - 1 || 1)) * chartWidth;
      const y = startY + chartHeight - (value - minValue) * scaleY;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  /**
   * Draw bar chart on canvas
   */
  private drawBarChart(ctx: CanvasRenderingContext2D, chart: ChartData, theme: ReportTheme): void {
    const padding = 40;
    const chartWidth = 500 - 2 * padding;
    const chartHeight = 300 - 2 * padding - 20;
    const startX = padding;
    const startY = padding + 20;

    // Draw axes
    ctx.strokeStyle = theme.chartShowGrid ? '#cccccc' : 'transparent';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX, startY + chartHeight);
    ctx.lineTo(startX + chartWidth, startY + chartHeight);
    ctx.stroke();

    if (chart.values.length === 0) return;

    // Calculate scale
    const minValue = Math.min(...chart.values);
    const maxValue = Math.max(...chart.values);
    const range = maxValue - minValue || 1;
    const scaleY = chartHeight / range;

    const barWidth = chartWidth / chart.values.length;

    // Draw bars
    chart.values.forEach((value, index) => {
      const x = startX + index * barWidth;
      const barHeight = (value - minValue) * scaleY;
      const y = startY + chartHeight - barHeight;

      ctx.fillStyle = theme.brandColor;
      ctx.fillRect(x + 5, y, barWidth - 10, barHeight);
    });
  }

  /**
   * Draw area chart on canvas
   */
  private drawAreaChart(ctx: CanvasRenderingContext2D, chart: ChartData, theme: ReportTheme): void {
    // Similar to line chart but with filled area
    const padding = 40;
    const chartWidth = 500 - 2 * padding;
    const chartHeight = 300 - 2 * padding - 20;
    const startX = padding;
    const startY = padding + 20;

    // Draw axes
    ctx.strokeStyle = theme.chartShowGrid ? '#cccccc' : 'transparent';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX, startY + chartHeight);
    ctx.lineTo(startX + chartWidth, startY + chartHeight);
    ctx.stroke();

    if (chart.values.length === 0) return;

    // Calculate scale
    const minValue = Math.min(...chart.values);
    const maxValue = Math.max(...chart.values);
    const range = maxValue - minValue || 1;
    const scaleY = chartHeight / range;

    // Draw filled area
    ctx.fillStyle = theme.chartShowGrid ? '#e8f0fe' : '#f3f4f6';
    ctx.beginPath();
    ctx.moveTo(startX, startY + chartHeight);

    chart.values.forEach((value, index) => {
      const x = startX + (index / (chart.values.length - 1 || 1)) * chartWidth;
      const y = startY + chartHeight - (value - minValue) * scaleY;
      ctx.lineTo(x, y);
    });

    ctx.lineTo(startX + chartWidth, startY + chartHeight);
    ctx.closePath();
    ctx.fill();

    // Draw line on top
    ctx.strokeStyle = theme.brandColor;
    ctx.lineWidth = theme.chartLineWidth;
    ctx.beginPath();

    chart.values.forEach((value, index) => {
      const x = startX + (index / (chart.values.length - 1 || 1)) * chartWidth;
      const y = startY + chartHeight - (value - minValue) * scaleY;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  }

  /**
   * Add section header
   */
  private addSectionHeader(doc: PDFDocumentType, title: string, theme?: ReportTheme): void {
    // Check if we need a new page
    this.ensureSpace(doc, 80);
    const accentColor = theme?.brandColor || this.BRAND_COLOR;
    const headingFont = theme?.fontHeading || 'Helvetica-Bold';

    doc.fontSize(this.FONT_SIZE_HEADING)
       .font(headingFont)
       .fillColor(accentColor)
       .text(title, this.MARGIN, doc.y + 20, {
         width: this.PAGE_WIDTH - 2 * this.MARGIN,
       });

    // Underline
    doc.moveTo(this.MARGIN, doc.y + 5)
       .lineTo(this.PAGE_WIDTH - this.MARGIN, doc.y + 5)
       .strokeColor(accentColor)
       .lineWidth(2)
       .stroke();

    doc.moveDown(1);
  }

  private async getLabel(
    key: string,
    language: SupportedLanguage,
    fallback?: string
  ): Promise<string> {
    const translated = await translationClient.translate(key, language);
    if (!translated || translated === key) {
      return fallback || this.humanizeKey(key);
    }
    return translated;
  }

  private humanizeKey(key: string): string {
    const base = key.split('.').pop() || key;
    const withSpaces = base
      .replace(/_/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();
    return withSpaces.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private ensureSpace(doc: PDFDocumentType, minHeight: number): void {
    if (doc.y + minHeight > this.PAGE_HEIGHT - this.MARGIN) {
      doc.addPage();
    }
  }

  private getTextHeight(doc: PDFDocumentType, text: string, width: number): number {
    return doc.heightOfString(text, {
      width,
      align: 'justify',
    });
  }

  private addBulletList(doc: PDFDocumentType, points: string[], theme?: ReportTheme): void {
    const bulletGap = 12;
    const textWidth = this.PAGE_WIDTH - 2 * this.MARGIN - bulletGap;

    points.forEach((point) => {
      const height = this.getTextHeight(doc, point, textWidth);
      this.ensureSpace(doc, height + 10);

      const startY = doc.y;
      doc.fontSize(this.FONT_SIZE_BODY)
         .font(theme?.fontBody || 'Helvetica')
         .fillColor(theme?.textColor || '#000000')
         .text('•', this.MARGIN, startY, { lineBreak: false });

      doc.x = this.MARGIN + bulletGap;
      doc.y = startY;
      doc.text(point, this.MARGIN + bulletGap, startY, {
        width: textWidth,
        align: 'left',
      });
      doc.moveDown(0.3);
    });
  }

  private renderNewsContentSinglePage(
    doc: PDFDocumentType,
    content: string,
    theme: ReportTheme,
    sectionTitle: string,
    articleTitle: string,
    fontSize: number
  ): void {
    const width = this.PAGE_WIDTH - 2 * this.MARGIN;
    let remaining = content.trim();

    while (remaining.length > 0) {
      const availableHeight = this.PAGE_HEIGHT - this.MARGIN - doc.y;
      doc.fontSize(fontSize).font(theme.fontBody);
      const chunk = this.fitTextToHeight(doc, remaining, width, availableHeight);

      if (!chunk) {
        doc.addPage();
        this.addSectionHeader(doc, sectionTitle, theme);
        doc.fontSize(this.FONT_SIZE_BODY)
          .font(theme.fontHeading)
          .fillColor(theme.textColor)
          .text(`${articleTitle} (continued)`, {
            width,
          });
        doc.moveDown(0.3);
        continue;
      }

      doc.fontSize(fontSize)
         .font(theme.fontBody)
         .fillColor(theme.textColor)
         .text(chunk, {
           width,
           align: 'justify',
         });

      remaining = remaining.slice(chunk.length).trim();
      if (remaining.length > 0) {
        doc.addPage();
        this.addSectionHeader(doc, sectionTitle, theme);
        doc.fontSize(this.FONT_SIZE_BODY)
          .font(theme.fontHeading)
          .fillColor(theme.textColor)
          .text(`${articleTitle} (continued)`, {
            width,
          });
        doc.moveDown(0.3);
      }
    }
  }

  private renderNewsContentToFitPage(
    doc: PDFDocumentType,
    content: string,
    theme: ReportTheme,
    sectionTitle: string,
    articleTitle: string
  ): void {
    const width = this.PAGE_WIDTH - 2 * this.MARGIN;
    const availableHeight = this.PAGE_HEIGHT - this.MARGIN - doc.y;
    const candidateFontSizes = [10, 9, 8];

    for (const size of candidateFontSizes) {
      doc.fontSize(size).font(theme.fontBody);
      if (this.getTextHeight(doc, content, width) <= availableHeight) {
        doc.fillColor(theme.textColor)
           .text(content, {
             width,
             align: 'justify',
           });
        return;
      }
    }

    const fallbackSize = candidateFontSizes[candidateFontSizes.length - 1];
    this.renderNewsContentSinglePage(doc, content, theme, sectionTitle, articleTitle, fallbackSize);
  }

  private fitTextToHeight(
    doc: PDFDocumentType,
    text: string,
    width: number,
    maxHeight: number
  ): string {
    if (maxHeight <= 0) {
      return '';
    }

    const sentences = text.split(/(?<=[.!?])\s+/);
    let buffer = '';
    for (const sentence of sentences) {
      const next = buffer ? `${buffer} ${sentence}` : sentence;
      if (this.getTextHeight(doc, next, width) <= maxHeight) {
        buffer = next;
      } else {
        break;
      }
    }

    if (buffer) {
      return buffer;
    }

    const words = text.split(/\s+/);
    let wordBuffer = '';
    for (const word of words) {
      const next = wordBuffer ? `${wordBuffer} ${word}` : word;
      if (this.getTextHeight(doc, next, width) <= maxHeight) {
        wordBuffer = next;
      } else {
        break;
      }
    }

    return wordBuffer;
  }

  private parseTradingDate(dateValue: string): Date {
    const parsed = new Date(dateValue);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
    return new Date();
  }

  private buildDateLabels(endDate: Date, points: number): string[] {
    const labels: string[] = [];
    for (let i = points - 1; i >= 0; i -= 1) {
      const date = new Date(endDate);
      date.setDate(endDate.getDate() - i);
      labels.push(
        date.toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
        })
      );
    }
    return labels;
  }

  private buildPriceSeries(previousClose: number, currentPrice: number, points: number): number[] {
    if (points <= 1) {
      return [currentPrice || previousClose || 0];
    }
    const series: number[] = [];
    for (let i = 0; i < points; i += 1) {
      const ratio = i / (points - 1);
      const value = previousClose + (currentPrice - previousClose) * ratio;
      series.push(Number.isFinite(value) ? value : 0);
    }
    return series;
  }

  private renderLongFormText(
    doc: PDFDocumentType,
    text: string,
    theme: ReportTheme,
    options: { fontSize: number; align?: 'left' | 'center' | 'right' | 'justify' }
  ): void {
    const width = this.PAGE_WIDTH - 2 * this.MARGIN;
    let remaining = text.trim();
    const align = options.align ?? 'justify';

    while (remaining.length > 0) {
      const availableHeight = this.PAGE_HEIGHT - this.MARGIN - doc.y;
      doc.fontSize(options.fontSize)
         .font(theme.fontBody)
         .fillColor(theme.textColor);
      const chunk = this.fitTextToHeight(doc, remaining, width, availableHeight);

      if (!chunk) {
        doc.addPage();
        continue;
      }

      doc.text(chunk, {
        width,
        align,
      });
      remaining = remaining.slice(chunk.length).trim();
      if (remaining.length > 0) {
        doc.addPage();
      }
    }

    doc.moveDown(1);
  }

  private renderChartAxisLabels(
    doc: PDFDocumentType,
    chart: ChartData,
    theme: ReportTheme,
    bounds: { x: number; y: number; width: number; height: number }
  ): void {
    const padding = 40;
    const chartWidth = bounds.width - 2 * padding;
    const chartHeight = bounds.height - 2 * padding - 20;
    const startX = bounds.x + padding;
    const startY = bounds.y + padding + 20;
    const labelColor = theme.mutedTextColor;

    if (!chart.values.length) {
      return;
    }

    const minValue = Math.min(...chart.values);
    const maxValue = Math.max(...chart.values);
    const range = maxValue - minValue || 1;
    const steps = 4;

    doc.fontSize(9).font(theme.fontBody).fillColor(labelColor);
    for (let i = 0; i <= steps; i += 1) {
      const value = maxValue - (range / steps) * i;
      const y = startY + (chartHeight / steps) * i - 4;
      doc.text(value.toFixed(2), bounds.x, y, {
        width: startX - bounds.x - 6,
        align: 'right',
      });
    }

    if (chart.labels && chart.labels.length > 0) {
      const labelCount = chart.labels.length;
      const labelStep = Math.max(1, Math.ceil(labelCount / 6));
      chart.labels.forEach((label, index) => {
        if (index % labelStep !== 0 && index !== labelCount - 1) {
          return;
        }
        const x = startX + (index / (labelCount - 1 || 1)) * chartWidth - 20;
        const y = startY + chartHeight + 6;
        doc.text(label, x, y, { width: 40, align: 'center' });
      });
    }
  }


  private getAnalysisSectionHeight(
    doc: PDFDocumentType,
    title: string,
    section: { keyPoints: string[]; rating?: number; summary: string; industry?: string },
    labels: { industry: string; rating: string; keyPoints: string; summary: string },
    theme: ReportTheme
  ): number {
    const width = this.PAGE_WIDTH - 2 * this.MARGIN;
    const bulletGap = 12;
    const bulletWidth = width - bulletGap;
    let height = 0;

    doc.fontSize(this.FONT_SIZE_HEADING).font(theme.fontHeading);
    height += this.getTextHeight(doc, title, width) + 12;

    doc.fontSize(this.FONT_SIZE_BODY).font(theme.fontHeading);
    if (section.industry) {
      height += this.getTextHeight(doc, `${labels.industry}: ${section.industry}`, width) + 6;
    }
    if (section.rating !== undefined) {
      height += this.getTextHeight(doc, `${labels.rating}: ${section.rating}/5`, width) + 6;
    }
    if (section.keyPoints && section.keyPoints.length > 0) {
      height += this.getTextHeight(doc, labels.keyPoints, width) + 4;
      doc.fontSize(this.FONT_SIZE_BODY).font(theme.fontBody);
      section.keyPoints.forEach((point) => {
        height += this.getTextHeight(doc, point, bulletWidth) + 6;
      });
    }
    if (section.summary) {
      doc.fontSize(this.FONT_SIZE_BODY).font(theme.fontHeading);
      height += this.getTextHeight(doc, labels.summary, width) + 4;
      doc.fontSize(this.FONT_SIZE_BODY).font(theme.fontBody);
      height += this.getTextHeight(doc, section.summary, width) + 8;
    }

    return height + 10;
  }

  private getFinancialAnalysisIntroHeight(
    doc: PDFDocumentType,
    analysis: FinancialAnalysis,
    labels: { industry: string; rating: string; keyPoints: string; summary: string },
    theme: ReportTheme
  ): number {
    const width = this.PAGE_WIDTH - 2 * this.MARGIN;
    let height = 80;

    if (analysis.companyDescription) {
      doc.fontSize(this.FONT_SIZE_BODY).font(theme.fontBody);
      height += this.getTextHeight(doc, analysis.companyDescription, width) + 12;
    }

    const firstSection = analysis.competitors;
    if (firstSection) {
      height += this.getAnalysisSectionHeight(doc, 'Competitors', firstSection, labels, theme);
    }

    return height;
  }


  /**
   * Get sentiment label (synchronous version for PDF)
   */
  private getSentimentLabel(sentiment: number, language: SupportedLanguage): string {
    // Map sentiment to labels (simplified, would use translation service in production)
    if (sentiment <= -1) return 'Very Negative';
    if (sentiment === 0) return 'Negative';
    if (sentiment === 1) return 'Neutral';
    if (sentiment === 2 || sentiment === 3) return 'Positive';
    return 'Very Positive';
  }
}

// Singleton instance
const reportService = new ReportService();

export default reportService;
