import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Download, Loader2, AlertCircle, FileText } from 'lucide-react';
import { getFileViewUrl } from '../lib/api';

export default function PDFViewerModal({ file, isOpen, onClose }) {
  const [loading, setLoading] = useState(true);
  const [viewUrl, setViewUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !file) {
      setViewUrl(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    getFileViewUrl(file.id)
      .then((data) => {
        const pageFragment = file.pageNumber ? `#page=${file.pageNumber}` : '';
        setViewUrl(`${data.url}${pageFragment}`);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading PDF signed URL:', err);
        setError(err.response?.data?.message || 'Failed to load PDF preview URL.');
        setLoading(false);
      });
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-5xl h-[90vh] bg-dark-900 border border-slate-800 rounded-2xl flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-dark-950/70">
          <div className="flex items-center gap-2.5 min-w-0 pr-4">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-100 font-mono truncate">
                {file.original_name}
              </h3>
              <p className="text-[11px] text-slate-400">
                Original PDF Document Viewer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {viewUrl && (
              <>
                <a
                  href={viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Open in New Tab</span>
                </a>
                <a
                  href={viewUrl}
                  download={file.original_name}
                  className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </a>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 bg-dark-950 relative flex items-center justify-center overflow-hidden">
          {loading && (
            <div className="text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-400" />
              <p className="text-xs font-mono">Generating secure document stream...</p>
            </div>
          )}

          {error && (
            <div className="max-w-md p-5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-center">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
              <p className="text-sm font-semibold mb-1">Preview Unavailable</p>
              <p className="text-xs text-rose-300/80 mb-4">{error}</p>
              <p className="text-[11px] text-slate-400">
                Ensure Supabase Storage bucket <code className="text-brand-300">pdf-documents</code> exists and service keys are set in backend <code className="text-brand-300">.env</code>.
              </p>
            </div>
          )}

          {!loading && !error && viewUrl && (
            <iframe
              src={viewUrl}
              title={file.original_name}
              className="w-full h-full border-none rounded-b-2xl bg-white"
            />
          )}
        </div>
      </div>
    </div>
  );
}
