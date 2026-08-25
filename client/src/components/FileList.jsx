import React, { useState } from 'react';
import { FileText, Eye, Trash2, Calendar, FileCheck, Layers, Loader2, Sparkles } from 'lucide-react';
import { deleteFile } from '../lib/api';

export default function FileList({ files, loading, onOpenPdf, onFileDeleted }) {
  const [deletingId, setDeletingId] = useState(null);

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const handleDelete = async (file) => {
    if (!window.confirm(`Are you sure you want to delete "${file.original_name}"?`)) {
      return;
    }
    setDeletingId(file.id);
    try {
      await deleteFile(file.id);
      if (onFileDeleted) onFileDeleted(file.id);
    } catch (err) {
      console.error('Delete error:', err);
      alert(err.response?.data?.message || 'Failed to delete file.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-400" />
        <p className="text-xs">Loading indexed documents...</p>
      </div>
    );
  }

  if (!files || files.length === 0) {
    return (
      <div className="text-center py-10 px-4 rounded-2xl bg-dark-900/40 border border-slate-800/80">
        <div className="w-10 h-10 rounded-xl bg-dark-850 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-2.5">
          <Layers className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-semibold text-slate-300 mb-1">No PDFs uploaded yet</h4>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Upload your PDF notes, slides, or documents above to enable natural content retrieval.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-brand-400" />
          <span>Your Indexed Documents ({files.length})</span>
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {files.map((file) => (
          <div
            key={file.id}
            className="flex flex-col justify-between p-4 rounded-2xl bg-dark-900/80 border border-slate-800 hover:border-slate-700 transition-all shadow-sm"
          >
            {/* Header info */}
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-slate-100 font-mono truncate" title={file.original_name}>
                      {file.original_name}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {formatFileSize(file.file_size)} • {file.page_count || 1} {file.page_count === 1 ? 'page' : 'pages'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onOpenPdf(file)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-brand-300 hover:bg-brand-500/10 transition-colors"
                    title="View PDF"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === file.id}
                    onClick={() => handleDelete(file)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                    title="Delete document"
                  >
                    {deletingId === file.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Summary / Extracted snippet preview */}
              {file.summary && (
                <p className="text-xs text-slate-400 line-clamp-2 mt-2 font-sans bg-dark-950/60 p-2 rounded-lg border border-slate-850">
                  {file.summary}
                </p>
              )}
            </div>

            {/* Upload Date footer */}
            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                {new Date(file.created_at).toLocaleDateString()}
              </span>
              <span className="text-emerald-400/90 font-medium">Text Extracted</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
