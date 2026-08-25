import React from 'react';
import { FileSearch, LogIn, LogOut, User, Sparkles, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onOpenAuth, fileCount = 0 }) {
  const { user, signOut, isConfigured } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-dark-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Tagline */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20 ring-1 ring-brand-400/30">
            <FileSearch className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-slate-100 tracking-tight font-mono">
                File<span className="text-brand-400">NotFound</span>
              </span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                v1.0 MVP
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Smart PDF Retrieval by Content
            </p>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Index count badge */}
          {user && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-900/90 border border-slate-800 text-xs text-slate-300">
              <Database className="w-3.5 h-3.5 text-brand-400" />
              <span>{fileCount} {fileCount === 1 ? 'PDF indexed' : 'PDFs indexed'}</span>
            </div>
          )}

          {/* Supabase Status Indicator */}
          {!isConfigured && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              Setup .env Required
            </div>
          )}

          {/* User Auth controls */}
          {user ? (
            <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-300 bg-dark-900 py-1.5 px-3 rounded-lg border border-slate-800/80">
                <div className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-[10px]">
                  {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="max-w-[140px] truncate font-mono text-slate-200">
                  {user.email}
                </span>
              </div>
              <button
                onClick={signOut}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/20"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-all shadow-md shadow-brand-500/20 hover:shadow-brand-500/30"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In / Sign Up</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
}
