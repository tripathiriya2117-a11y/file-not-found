import React from 'react';
import { FileText, Eye, Download, Sparkles, CheckCircle2, AlertCircle, FileSearch, ArrowUpRight } from 'lucide-react';

/**
 * Component to highlight matched search terms safely in a text snippet.
 */
function HighlightedSnippet({ text, terms = [] }) {
  if (!text) return null;
  if (!terms || terms.length === 0) {
    return <span className="text-slate-300">{text}</span>;
  }

  // Create regex from all terms
  const escapedTerms = terms
    .filter(t => t && t.length > 0)
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  if (!escapedTerms) {
    return <span className="text-slate-300">{text}</span>;
  }

  const regex = new RegExp(`(${escapedTerms})`, 'gi');
  const parts = text.split(regex);

  return (
    <p className="text-sm text-slate-300 leading-relaxed font-sans">
      {parts.map((part, i) => {
        const isMatch = terms.some(t => t.toLowerCase() === part.toLowerCase());
        return isMatch ? (
          <mark key={i} className="search-highlight">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </p>
  );
}

export default function SearchResults({ results, parsedTerms, query, onOpenPdf, total = 0 }) {
  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getRelevanceBadgeColor = (relevance) => {
    if (relevance >= 85) {
      return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
    } else if (relevance >= 70) {
      return 'bg-brand-500/10 text-brand-300 border-brand-500/30';
    } else {
      return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
    }
  };

  if (!results || results.length === 0) {
    return (
      <div className="text-center py-12 px-4 rounded-2xl bg-dark-900/40 border border-slate-800">
        <div className="w-12 h-12 rounded-2xl bg-dark-850 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
          <FileSearch className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-200 mb-1">No matching documents found</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          We searched the extracted text content of your uploaded PDFs for "{query}", but couldn't find a strong match. Try broader keywords or upload additional documents.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="flex items-center justify-between text-xs text-slate-400 font-mono px-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          <span>
            Found <strong className="text-slate-200">{total}</strong> {total === 1 ? 'matching document' : 'matching documents'} for "{query}"
          </span>
        </div>
        <span className="text-[11px] text-slate-400">Ranked by Content Relevance</span>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {results.map((doc, index) => (
          <div
            key={doc.id}
            className="group relative rounded-2xl bg-dark-900/90 border border-slate-800 hover:border-brand-500/40 p-5 transition-all glass-panel-hover shadow-lg"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              
              {/* Document Details & Snippet */}
              <div className="flex-1 min-w-0">
                {/* Top Row: Rank & Name & Badges */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-md bg-dark-800 text-slate-400 font-mono text-[11px] flex items-center justify-center font-bold">
                    #{index + 1}
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-sm font-semibold text-slate-100 truncate">
                    <FileText className="w-4 h-4 text-brand-400 shrink-0" />
                    <span className="truncate">{doc.original_name}</span>
                  </div>

                  {/* Relevance signal, not a probability */}
                  <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded-full border ${getRelevanceBadgeColor(doc.relevance)}`}>
                    Relevance {doc.relevance}
                  </span>

                  {/* Page Badge */}
                  {doc.pageNumber && (
                    <span className="text-[11px] font-mono text-slate-400 bg-dark-950 px-2 py-0.5 rounded border border-slate-800">
                      Page {doc.pageNumber} of {doc.page_count || 1}
                    </span>
                  )}
                </div>

                {/* Why It Matched Section */}
                {doc.whyMatched && (
                  <div className="my-2.5 p-2.5 rounded-xl bg-brand-500/5 border border-brand-500/20 text-xs text-brand-200 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-brand-300 font-medium">Why it matched: </strong>
                      <span>{doc.whyMatched}</span>
                    </div>
                  </div>
                )}

                {/* Content Snippet with Highlighting */}
                <div className="mt-2 p-3 rounded-xl bg-dark-950/80 border border-slate-800/80 font-mono text-xs">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block mb-1">
                    Matching Content Snippet
                  </span>
                  <HighlightedSnippet text={doc.snippet} terms={parsedTerms} />
                </div>

                {/* Metadata row */}
                <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400 font-mono">
                  <span>Size: {formatFileSize(doc.file_size)}</span>
                  <span>•</span>
                  <span>Uploaded: {new Date(doc.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex sm:flex-col gap-2 shrink-0 self-end sm:self-start">
                <button
                  type="button"
                  onClick={() => onOpenPdf(doc)}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-all shadow-md shadow-brand-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View PDF</span>
                </button>
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
