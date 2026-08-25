import React from 'react';
import { Sparkles, ArrowRight, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';

export default function HeroBanner() {
  return (
    <div className="relative overflow-hidden pt-8 pb-10">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-56 bg-brand-100/50 blur-3xl -z-10 pointer-events-none" />

      <div className="max-w-4xl mx-auto text-center px-4">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-mono mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          <span>Zero manual file naming required</span>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-100 tracking-tight leading-tight sm:leading-none mb-4">
          Find your files by what you remember,{' '}
          <span className="text-brand-600">
            not what you named them.
          </span>
        </h1>

        {/* Description */}
        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed mb-6">
          Upload PDFs with messy filenames like <code className="text-brand-300 bg-dark-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono text-xs">document_8472.pdf</code>. 
          Search by natural memory queries and see instant matches with highlighted explanations.
        </p>

        {/* Interactive Comparison Preview */}
        <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3 p-2.5 rounded-xl bg-dark-900/90 border border-slate-800 text-xs font-mono text-slate-300 shadow-xl max-w-full">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dark-950 border border-slate-800 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-rose-400/80"></span>
            <span>doc_8472.pdf</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-brand-400 shrink-0 hidden sm:block" />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-500/10 border border-brand-500/30 text-brand-300">
            <span>Query: "Java Chapter 1 notes"</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-brand-400 shrink-0 hidden sm:block" />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Relevance + Snippet</span>
          </div>
        </div>

      </div>
    </div>
  );
}
