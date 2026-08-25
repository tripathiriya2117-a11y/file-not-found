import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, X, Plus } from 'lucide-react';
import { uploadFiles } from '../lib/api';

export default function UploadDropzone({ onUploadSuccess, onRequireAuth, isAuthenticated }) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateAndAddFiles = (files) => {
    setUploadError(null);
    const pdfFiles = [];
    const invalidFiles = [];

    Array.from(files).forEach((file) => {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // 25MB check
        if (file.size <= 25 * 1024 * 1024) {
          pdfFiles.push(file);
        } else {
          invalidFiles.push(`${file.name} (exceeds 25MB limit)`);
        }
      } else {
        invalidFiles.push(`${file.name} (only PDF supported)`);
      }
    });

    if (invalidFiles.length > 0) {
      setUploadError(`Some files were skipped: ${invalidFiles.join(', ')}`);
    }

    if (pdfFiles.length > 0) {
      setSelectedFiles((prev) => {
        const combined = [...prev, ...pdfFiles];
        // deduplicate by filename + size
        const unique = combined.filter((v, i, a) => a.findIndex(t => (t.name === v.name && t.size === v.size)) === i);
        return unique.slice(0, 10); // cap to 10
      });
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e) => {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartUpload = async () => {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setProgress(15);
    setStatusMessage('Uploading PDF to Supabase Storage...');
    setUploadError(null);

    try {
      // Simulate stepped progression for text extraction
      const progressTimer = setTimeout(() => {
        setProgress(60);
        setStatusMessage('Extracting text content & metadata...');
      }, 800);

      const chunkTimer = setTimeout(() => {
        setProgress(85);
        setStatusMessage('Building search index & chunks...');
      }, 1600);

      const response = await uploadFiles(selectedFiles, (percent) => {
        setProgress(Math.min(90, Math.max(15, percent)));
      });

      clearTimeout(progressTimer);
      clearTimeout(chunkTimer);

      setProgress(100);
      const failedUploads = response.errors || [];
      if (failedUploads.length > 0) {
        setStatusMessage(`Indexed ${response.uploaded?.length || 0} of ${selectedFiles.length}; ${failedUploads.length} failed.`);
        setUploadError(failedUploads.map((failure) => `${failure.filename}: ${failure.error}`).join(' '));
      } else {
        setStatusMessage('Done! Indexed into database.');
      }

      setTimeout(() => {
        setSelectedFiles([]);
        setUploading(false);
        setProgress(0);
        setStatusMessage('');
        if (onUploadSuccess) onUploadSuccess(response.uploaded);
      }, 800);

    } catch (err) {
      console.error('Upload failed:', err);
      setUploadError(err.response?.data?.message || err.message || 'Upload failed. Please check server connection.');
      setUploading(false);
      setProgress(0);
      setStatusMessage('');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="w-full">
      {/* Drop area container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all ${
          isDragging
            ? 'border-brand-400 bg-brand-500/10 shadow-lg shadow-brand-500/20'
            : 'border-slate-800 bg-dark-900/60 hover:border-slate-700 hover:bg-dark-900/80'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-transform ${
            isDragging ? 'scale-110 bg-brand-500/20 text-brand-400' : 'bg-dark-850 text-slate-400 border border-slate-800'
          }`}>
            <UploadCloud className="w-7 h-7" />
          </div>

          <h3 className="text-base sm:text-lg font-semibold text-slate-100 mb-1">
            Drag & drop PDF files here, or{' '}
            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) onRequireAuth();
                else fileInputRef.current?.click();
              }}
              className="text-brand-400 hover:text-brand-300 underline underline-offset-4 cursor-pointer"
            >
              browse
            </button>
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mb-4">
            Upload up to 5 PDFs (25MB each). We automatically extract all text and make it searchable.
          </p>

          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) onRequireAuth();
              else fileInputRef.current?.click();
            }}
            className="px-4 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 border border-slate-700/80 text-slate-200 text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-brand-400" />
            <span>Select PDF Files</span>
          </button>
        </div>

        {/* Selected files queue */}
        {selectedFiles.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-800 text-left">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                Selected for Upload ({selectedFiles.length})
              </span>
              {!uploading && (
                <button
                  type="button"
                  onClick={() => setSelectedFiles([])}
                  className="text-xs text-slate-500 hover:text-rose-400"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {selectedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-dark-950/80 border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <FileText className="w-4 h-4 text-brand-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-slate-200 font-mono truncate">{file.name}</p>
                      <p className="text-slate-500 text-[11px]">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  {!uploading && (
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Upload Button & Live Status */}
            {uploading ? (
              <div className="space-y-2 p-3 rounded-lg bg-dark-950 border border-brand-500/30">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-brand-300">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-400" />
                    <span>{statusMessage}</span>
                  </div>
                  <span className="font-mono text-brand-400">{progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-dark-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-indigo-400 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartUpload}
                className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload & Extract {selectedFiles.length} {selectedFiles.length === 1 ? 'PDF' : 'PDFs'}</span>
              </button>
            )}
          </div>
        )}

        {/* Error message */}
        {uploadError && (
          <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{uploadError}</span>
          </div>
        )}

      </div>
    </div>
  );
}
