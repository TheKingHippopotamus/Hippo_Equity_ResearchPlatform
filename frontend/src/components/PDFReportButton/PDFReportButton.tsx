import React, { useState } from 'react';
import { apiService } from '../../services/api';
import { translationService } from '../../services/translation';
import type { ReportConfig, SupportedLanguage } from '../../types/models';
import './PDFReportButton.css';

interface PDFReportButtonProps {
  stockSymbol: string;
  language?: SupportedLanguage;
  userId?: string;
  reportConfig?: ReportConfig;
  generateLabelOverride?: string;
  downloadLabelOverride?: string;
  disabled?: boolean;
  className?: string;
  onGenerate?: (url: string) => void;
}

export const PDFReportButton: React.FC<PDFReportButtonProps> = ({
  stockSymbol,
  language = 'en',
  userId = 'anonymous',
  reportConfig,
  generateLabelOverride,
  downloadLabelOverride,
  disabled = false,
  className,
  onGenerate,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [buttonLabel, setButtonLabel] = useState('Generate Report');
  const [downloadLabel, setDownloadLabel] = useState('Download Report');

  React.useEffect(() => {
    const loadTranslations = async () => {
      const [generate, download] = await Promise.all([
        translationService.translate('ui.generateReport', language),
        translationService.translate('ui.downloadReport', language),
      ]);
      setButtonLabel(generateLabelOverride || generate);
      setDownloadLabel(downloadLabelOverride || download);
    };
    loadTranslations();
  }, [language, generateLabelOverride, downloadLabelOverride]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setDownloadUrl(null);

    try {
      // Call ReportService API to generate PDF
      const result = await apiService.generatePDF(stockSymbol, language, userId, reportConfig);
      
      // Store the download URL
      setDownloadUrl(result.downloadUrl);
      
      if (onGenerate) {
        onGenerate(result.downloadUrl);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate PDF report';
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!downloadUrl) return;

    try {
      // Extract reportId from downloadUrl (format: /download/{reportId})
      const reportId = downloadUrl.split('/').pop();
      if (!reportId) {
        throw new Error('Invalid download URL');
      }

      // Download PDF blob
      const blob = await apiService.downloadPDF(reportId);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${stockSymbol}_report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to download PDF report';
      setError(errorMessage);
    }
  };

  return (
    <div className={`pdf-report-button ${className || ''}`.trim()}>
      {!downloadUrl ? (
        <button
          className="button button-primary pdf-generate-button"
          onClick={handleGenerate}
          disabled={isGenerating || disabled}
        >
          {isGenerating ? (
            <>
              <span className="pdf-loading-spinner" />
              <span>Generating...</span>
            </>
          ) : (
            buttonLabel
          )}
        </button>
      ) : (
        <button
          className="button button-primary pdf-download-button"
          onClick={handleDownload}
          disabled={disabled}
        >
          {downloadLabel}
        </button>
      )}

      {error && (
        <div className="pdf-error">
          <p>{error}</p>
          <button
            className="button button-secondary pdf-retry-button"
            onClick={handleGenerate}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default PDFReportButton;
