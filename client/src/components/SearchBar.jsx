import React, { useState } from 'react';
import { Search, Sparkles, X, Loader2, ArrowRight } from 'lucide-react';

const EXAMPLE_QUERIES = [
  'Java Chapter 1 notes',
  'Which PDF contains servlet notes?',
  'Find the internship eligibility document',
  'Database normalization 3NF',
];

export default function SearchBar({ onSearch, loading, activeQuery, onClear }) {
  const [query, setQuery] = useState(activeQuery || '');

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    onSearch(query.trim());
  };

  const handleChipClick = (example) => {
    setQuery(example);
    onSearch(example);
  };

  const handleClear = () => {
    setQuery('');
    if (onClear) onClear();
  };

  return (
    <div className="w-full">
      {/* Search Input Container */}
      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-400 transition-colors">
          <Search className="w-5 h-5" />
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe what is inside the file (e.g. 'Find my Java Chapter 1 PDF' or 'servlet notes')..."
          className="w-full pl-12 pr-28 py-3.5 sm:py-4 bg-dark-900/90 border border-slate-700/80 hover:border-slate-600 focus:border-brand-500 rounded-2xl text-slate-100 placeholder-slate-400 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-xl transition-all font-sans"
        />

        <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-dark-800 transition-colors"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:bg-dark-800 text-white disabled:text-slate-500 font-medium text-xs sm:text-sm transition-all shadow-md shadow-brand-500/20 disabled:shadow-none flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <>
                <span>Search</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Suggested Natural Queries */}
      <div className="mt-3 flex items-center flex-wrap gap-2 text-xs">
        <span className="text-slate-400 font-medium flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-brand-400" />
          <span>Try searching:</span>
        </span>
        {EXAMPLE_QUERIES.map((example, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleChipClick(example)}
            className="px-2.5 py-1 rounded-lg bg-dark-900 hover:bg-dark-850 border border-slate-800 hover:border-brand-500/30 text-slate-300 hover:text-brand-300 transition-all font-mono text-[11px] cursor-pointer"
          >
            "{example}"
          </button>
        ))}
      </div>
    </div>
  );
}
