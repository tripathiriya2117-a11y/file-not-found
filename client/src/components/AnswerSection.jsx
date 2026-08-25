import React from 'react';
import { BookOpen, FileText, Loader2 } from 'lucide-react';

export default function AnswerSection({ answer, loading, onOpenSource, hasResults }) {
  if (loading) {
    return (
      <section className="p-5 rounded-2xl bg-brand-500/5 border border-brand-500/20">
        <div className="flex items-center gap-2 text-sm font-semibold text-brand-200">
          <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
          <span>AI-generated answer</span>
        </div>
        <p className="mt-2 text-xs text-slate-400">Reading the most relevant retrieved passages...</p>
      </section>
    );
  }

  if (!answer || (!answer.generated && !hasResults)) return null;

  if (!answer.generated) {
    return (
      <section className="p-5 rounded-2xl bg-dark-900/70 border border-slate-800">
        <p className="text-sm text-slate-300">Couldn't generate an answer. Here are the relevant documents.</p>
      </section>
    );
  }

  return (
    <section className="p-5 rounded-2xl bg-brand-500/5 border border-brand-500/20">
      <div className="flex items-center gap-2 text-sm font-semibold text-brand-200">
        <BookOpen className="w-4 h-4 text-brand-400" />
        <span>AI-generated answer</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-200">{answer.text}</p>

      {answer.sources?.length > 0 && (
        <div className="mt-4 pt-3 border-t border-brand-500/15">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2">Sources</p>
          <div className="flex flex-wrap gap-2">
            {answer.sources.map((source) => (
              <button
                key={`${source.document_id}-${source.page_number}`}
                type="button"
                onClick={() => onOpenSource(source)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-dark-900/70 border border-slate-700 text-xs text-slate-300 hover:text-brand-300 hover:border-brand-500/40 transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-brand-400" />
                <span className="max-w-[18rem] truncate">{source.filename}</span>
                <span className="text-slate-500">p. {source.page_number}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="mt-3 text-[11px] text-slate-500">Answer generated from your indexed documents.</p>
    </section>
  );
}