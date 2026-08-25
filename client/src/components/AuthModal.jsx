import React, { useState } from 'react';
import { X, Mail, Lock, AlertCircle, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ isOpen, onClose }) {
  const { signIn, signUp, isConfigured } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password);
        setSuccessMsg('Account created! Please check your email or sign in.');
      } else {
        await signIn(email, password);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-dark-900 border border-slate-800 rounded-2xl p-6 shadow-2xl glow-brand"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-400 mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-100 tracking-tight">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            {isSignUp
              ? 'Start searching your messy PDFs intelligently'
              : 'Sign in to access your indexed documents'}
          </p>
        </div>

        {/* Env Alert if unconfigured */}
        {!isConfigured && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Supabase Keys Required:</span> Update <code className="font-mono text-amber-300">.env</code> in both client and server with your Supabase credentials to enable authentication.
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@example.com"
                className="w-full bg-dark-950 border border-slate-700/80 rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-dark-950 border border-slate-700/80 rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-500/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Switch Mode */}
        <div className="mt-6 pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
          {isSignUp ? (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setIsSignUp(false); setError(null); setSuccessMsg(null); }}
                className="text-brand-400 hover:text-brand-300 font-medium ml-1"
              >
                Sign In
              </button>
            </>
          ) : (
            <>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => { setIsSignUp(true); setError(null); setSuccessMsg(null); }}
                className="text-brand-400 hover:text-brand-300 font-medium ml-1"
              >
                Create Account
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
