# File Not Found 📄🔍
> **"Find your files by what you remember, not what you named them."**

File Not Found is a full-stack smart digital file retrieval web application. It allows users to upload PDF documents with messy or unhelpful filenames (such as `document_8472.pdf` or `scan_003.pdf`) and later locate them instantly by describing their actual contents, concepts, or topics using natural language queries.

---

## ⚡ Core Features

- **Dark & Modern UI**: Sleek, distraction-free interface built with Tailwind CSS and Lucide icons.
- **Drag-and-Drop Multi-PDF Upload**: Batch upload up to 10 PDF documents simultaneously with live progress feedback and file validation.
- **Automated Text Extraction & Chunking**: Backend extracts selectable text, calculates page counts and word counts, and segments content into searchable chunks.
- **Hybrid Semantic + Keyword Search**:
  - Uses **Google Gemini `gemini-embedding-001` (768d)** + **Supabase `pgvector`** for conceptual matching.
  - Automatically falls back to PostgreSQL Full-Text Search and in-memory phrase matching if no API key is provided.
- **Ranked Results with Relevance Scores**: Displays match confidence percentage (e.g. 98% Match) and page references.
- **Contextual Highlights & "Why It Matched" Explanations**: Every search result explains exactly why and where the document matched the user's query.
- **In-App PDF Viewer & Download**: View original PDFs securely via temporary signed URLs or download them directly.
- **Strict User Isolation**: Powered by Supabase Auth and PostgreSQL Row Level Security (RLS).

---

## 🛠 Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React, Axios
- **Backend**: Node.js, Express, `multer`, `pdf-parse`, `@google/generative-ai`, `@supabase/supabase-js`, `dotenv`, `cors`
- **Database & Storage**: Supabase (PostgreSQL with `pgvector` & full-text search indexes & Supabase Storage)

---

## 📁 Project Structure

```
file-not-found/
├── client/                     # Frontend React + Vite application
│   ├── src/
│   │   ├── components/         # Navbar, HeroBanner, UploadDropzone, SearchBar,
│   │   │                       # SearchResults, FileList, PDFViewerModal, AuthModal
│   │   ├── context/            # AuthContext (Supabase authentication provider)
│   │   ├── lib/                # API client and Supabase client
│   │   ├── App.jsx             # Main workspace application
│   │   ├── index.css           # Tailwind styling & dark glass theme
│   │   └── main.jsx
│   ├── .env.example
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
├── server/                     # Backend Node.js + Express API
│   ├── src/
│   │   ├── config/             # Supabase admin client initialization
│   │   ├── middleware/         # Supabase JWT auth verification middleware
│   │   ├── routes/             # /api/files (upload, list, view-url, delete)
│   │   │                       # /api/search (content search endpoint)
│   │   ├── services/           # embeddingService.js (Gemini gemini-embedding-001)
│   │   │                       # pdfService.js (text extraction & chunking)
│   │   │                       # searchService.js (hybrid ranking, snippet & explanation logic)
│   │   └── index.js            # Express server entrypoint
│   ├── test/                   # Automated backend pipeline tests
│   ├── .env.example
│   └── package.json
├── supabase/
│   └── schema.sql              # Database tables, pgvector, RLS policies & hybrid search RPC
├── package.json                # Root scripts
└── README.md
```

---

## 🚀 Setup and Installation Guide

### 1. Prerequisites
- Node.js (v18 or newer)
- npm (v9 or newer)
- A Supabase project (Free tier on [supabase.com](https://supabase.com))
- *(Optional)* Google Gemini API key from [Google AI Studio](https://aistudio.google.com) for semantic vector search

---

### 2. Supabase Configuration

#### A. Database Schema & pgvector
1. Open your Supabase Dashboard and go to the **SQL Editor**.
2. Copy and paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
3. This sets up:
   - `pgvector` extension
   - `documents` table with Row Level Security (RLS)
   - `document_chunks` table with `embedding vector(768)` and full-text `tsv`
   - HNSW index and `hybrid_match_document_chunks` RPC function

#### B. Storage Bucket
1. In the Supabase Dashboard, navigate to **Storage**.
2. Create a new bucket named **`pdf-documents`**.
3. Set the bucket to **Private**.

---

### 3. Environment Variables Setup

#### Backend (`server/.env`):
```env
PORT=5000
FRONTEND_ORIGIN=http://localhost:5173
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_BUCKET_NAME=pdf-documents

# Optional: Google Gemini API Key for Semantic Vector Embeddings
GEMINI_API_KEY=your-gemini-api-key
```

#### Frontend (`client/.env`):
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_API_BASE_URL=http://localhost:5000/api
```

---

### 4. Running the Application

```bash
# Start backend server (Port 5000)
cd server
npm run dev

# Start frontend app (Port 3000)
cd client
npm run dev
```

Run tests anytime with:
```bash
cd server
npm test
```
