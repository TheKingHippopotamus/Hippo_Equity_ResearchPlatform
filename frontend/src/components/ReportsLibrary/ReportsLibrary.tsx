import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../../services/api';
import './ReportsLibrary.css';

interface ReportItem {
  id: string;
  symbol: string;
  language: string;
  fileSize?: string | number;
  generatedAt: string;
  downloadUrl?: string;
  /** Set for bundled sample reports served as static files. */
  file?: string;
}

interface ReportsLibraryProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  /** Bump to force a reload (e.g. after a new report is generated). */
  refreshKey?: number;
}

const formatBytes = (n?: string | number): string => {
  const bytes = typeof n === 'string' ? parseInt(n, 10) : n ?? 0;
  if (!bytes || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
};

export const ReportsLibrary: React.FC<ReportsLibraryProps> = ({ userId, isOpen, onClose, refreshKey }) => {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sampleMode, setSampleMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.listReports(userId, 50);
      let list = ((res && res.reports) || []) as ReportItem[];
      if (list.length === 0) {
        // Fresh install / no provider: fall back to bundled sample reports.
        try {
          const m = await fetch('/static/sample-reports/manifest.json');
          if (m.ok) {
            const data = await m.json();
            list = (data.samples || []) as ReportItem[];
            setSampleMode(list.length > 0);
          } else {
            setSampleMode(false);
          }
        } catch {
          setSampleMode(false);
        }
      } else {
        setSampleMode(false);
      }
      setReports(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, refreshKey, load]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleDownload = async (r: ReportItem) => {
    if (r.file) {
      const a = document.createElement('a');
      a.href = r.file;
      a.download = `${r.symbol}_sample_report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    setBusyId(r.id);
    setError(null);
    try {
      const blob = await apiService.downloadPDF(r.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${r.symbol}_report_${(r.generatedAt || '').slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleView = async (r: ReportItem) => {
    if (r.file) {
      window.open(r.file, '_blank', 'noopener');
      return;
    }
    setBusyId(r.id);
    setError(null);
    try {
      const blob = await apiService.downloadPDF(r.id);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open report');
    } finally {
      setBusyId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="reports-overlay" onClick={onClose}>
      <aside
        className="reports-drawer"
        role="dialog"
        aria-label="Reports library"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="reports-drawer-header">
          <div className="reports-drawer-title">
            <h2>Reports</h2>
            <span className="reports-sub">Stored PDF reports · object storage</span>
          </div>
          <div className="reports-header-actions">
            <button className="reports-icon-btn" onClick={load} disabled={loading} title="Refresh" aria-label="Refresh">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 4v5h-5" />
              </svg>
            </button>
            <button className="reports-icon-btn" onClick={onClose} title="Close" aria-label="Close">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        {sampleMode && (
          <div className="reports-sample-note">
            Showing bundled sample reports. Configure a data provider to generate your own.
          </div>
        )}

        {error && <div className="reports-error" role="alert">{error}</div>}

        <div className="reports-body">
          {loading ? (
            <div className="reports-empty"><span className="reports-spinner" /> Loading…</div>
          ) : reports.length === 0 ? (
            <div className="reports-empty">
              <p className="reports-empty-title">No reports yet</p>
              <p className="reports-empty-hint">Generate a PDF and it will appear here.</p>
            </div>
          ) : (
            <ul className="reports-list">
              {reports.map((r) => (
                <li key={r.id} className="reports-item">
                  <div className="reports-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 16h4" />
                    </svg>
                  </div>
                  <div className="reports-item-info">
                    <div className="reports-item-main">
                      <span className="reports-symbol">{r.symbol}</span>
                      <span className="reports-lang">{(r.language || 'en').toUpperCase()}</span>
                    </div>
                    <div className="reports-meta">
                      <span>{formatDate(r.generatedAt)}</span>
                      <span className="reports-dot">·</span>
                      <span>{formatBytes(r.fileSize)}</span>
                    </div>
                  </div>
                  <div className="reports-actions">
                    <button className="button button-secondary reports-act" disabled={busyId === r.id} onClick={() => handleView(r)}>View</button>
                    <button className="button button-primary reports-act" disabled={busyId === r.id} onClick={() => handleDownload(r)}>
                      {busyId === r.id ? '…' : 'Download'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="reports-drawer-footer">
          {reports.length > 0 && <span>{reports.length} report{reports.length === 1 ? '' : 's'}</span>}
        </footer>
      </aside>
    </div>
  );
};

export default ReportsLibrary;
