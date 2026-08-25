import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import HeroBanner from './components/HeroBanner';
import UploadDropzone from './components/UploadDropzone';
import SearchBar from './components/SearchBar';
import SearchResults from './components/SearchResults';
import AnswerSection from './components/AnswerSection';
import FileList from './components/FileList';
import AuthModal from './components/AuthModal';
import PDFViewerModal from './components/PDFViewerModal';
import { useAuth } from './context/AuthContext';
import { fetchFiles, searchFiles } from './lib/api';
import { Sparkles, AlertCircle, Info, FileSearch, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function App() {
  const { user, isConfigured } = useAuth();
  
  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [activePdfFile, setActivePdfFile] = useState(null);
  
  // Data state
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState(null);

  // Search state
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [parsedTerms, setParsedTerms] = useState([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [answer, setAnswer] = useState(null);

  // Fetch files when user changes
  useEffect(() => {
    if (user) {
      loadUserFiles();
    } else {
      setFiles([]);
      setSearchResults([]);
      setAnswer(null);
      setSearchPerformed(false);
    }
  }, [user]);

  const loadUserFiles = async () => {
    setLoadingFiles(true);
    setFilesError(null);
    try {
      const data = await fetchFiles();
      setFiles(data);
    } catch (err) {
      console.error('Error loading files:', err);
      // If error is 401 or auth not ready
      setFilesError(err.response?.data?.message || 'Could not load your uploaded files.');
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleSearch = async (queryText) => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    setSearchQuery(queryText);
    setSearchLoading(true);
    setSearchPerformed(true);
    setSearchResults([]);
    setParsedTerms([]);
    setTotalMatches(0);
    setAnswer(null);

    try {
      const data = await searchFiles(queryText);
      setSearchResults(data.results || []);
      setParsedTerms(data.parsedTerms || []);
      setTotalMatches(data.total || 0);
      setAnswer(data.answer || null);
    } catch (err) {
      console.error('Search error:', err);
      alert(err.response?.data?.message || 'Failed to complete search.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchPerformed(false);
    setParsedTerms([]);
    setTotalMatches(0);
    setAnswer(null);
  };

  const handleUploadSuccess = (uploadedDocs) => {
    loadUserFiles();
    // If a search was active, re-run search with new docs
    if (searchQuery.trim()) {
      handleSearch(searchQuery);
    }
  };

  const handleFileDeleted = (deletedId) => {
    setFiles((prev) => prev.filter((f) => f.id !== deletedId));
    setSearchResults((prev) => prev.filter((f) => f.id !== deletedId));
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark-950 text-slate-100 selection:bg-brand-500/30 selection:text-brand-100">
      
      {/* Navigation */}
      <Navbar
        onOpenAuth={() => setAuthModalOpen(true)}
        fileCount={files.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        
        {/* Value Proposition Hero */}
        <HeroBanner />

        {/* Not Configured Banner Alert */}
        {!isConfigured && (
          <div className="mb-8 p-4 rounded-2xl bg-dark-900 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3 shadow-lg">
            <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-300">Supabase Setup Required for Full Auth & Live Database</p>
              <p className="text-slate-300">
                To connect your database, copy <code className="text-amber-300 bg-dark-950 px-1 py-0.5 rounded">.env.example</code> to <code className="text-amber-300 bg-dark-950 px-1 py-0.5 rounded">.env</code> in both <code className="text-amber-300 font-mono">client/</code> and <code className="text-amber-300 font-mono">server/</code>, then run the SQL script in <code className="text-amber-300 font-mono">supabase/schema.sql</code> in your Supabase SQL Editor.
              </p>
            </div>
          </div>
        )}

        {/* Unauthenticated Call to Action Banner */}
        {!user && (
          <div className="mb-8 p-6 rounded-2xl bg-brand-50 border border-brand-200 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div>
              <h3 className="text-base font-bold text-slate-100 mb-1">
                Sign in to isolate and search your personal PDFs
              </h3>
              <p className="text-xs text-slate-300 max-w-xl">
                File Not Found uses Supabase Row Level Security (RLS) so your uploaded PDFs and search data remain strictly private to your account.
              </p>
            </div>
            <button
              onClick={() => setAuthModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shrink-0 transition-all shadow-md shadow-brand-500/25 flex items-center gap-2 cursor-pointer"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Core MVP App Workspace */}
        <div className="space-y-8">
          
          {/* Section 1: Search Interface */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider font-mono text-slate-300 flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-brand-400" />
                <span>Search Document Contents</span>
              </h2>
            </div>

            <SearchBar
              onSearch={handleSearch}
              loading={searchLoading}
              activeQuery={searchQuery}
              onClear={handleClearSearch}
            />

            {/* Render Search Results */}
            {searchPerformed && (
              <div className="pt-2">
                <AnswerSection
                  answer={answer}
                  loading={searchLoading}
                  hasResults={searchResults.length > 0}
                  onOpenSource={(source) => setActivePdfFile({
                    id: source.document_id,
                    original_name: source.filename,
                    pageNumber: source.page_number,
                  })}
                />
                <SearchResults
                  results={searchResults}
                  parsedTerms={parsedTerms}
                  query={searchQuery}
                  total={totalMatches}
                  onOpenPdf={(doc) => setActivePdfFile(doc)}
                />
              </div>
            )}
          </section>

          {/* Section 2: Upload Area */}
          <section className="space-y-4 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider font-mono text-slate-300">
                Upload New PDF Documents
              </h2>
              <span className="text-xs text-slate-400 font-mono">PDF Only • Auto-Extract</span>
            </div>

            <UploadDropzone
              onUploadSuccess={handleUploadSuccess}
              onRequireAuth={() => setAuthModalOpen(true)}
              isAuthenticated={Boolean(user)}
            />
          </section>

          {/* Section 3: Recent Uploaded Documents */}
          {user && (
            <section className="space-y-4 pt-4 border-t border-slate-800/80">
              <FileList
                files={files}
                loading={loadingFiles}
                onOpenPdf={(doc) => setActivePdfFile(doc)}
                onFileDeleted={handleFileDeleted}
              />
            </section>
          )}

        </div>

      </main>

      {/* Modals */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      <PDFViewerModal
        file={activePdfFile}
        isOpen={Boolean(activePdfFile)}
        onClose={() => setActivePdfFile(null)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-400 font-mono">
        <p>File Not Found &copy; {new Date().getFullYear()} — Smart Retrieval by Content</p>
      </footer>

    </div>
  );
}
