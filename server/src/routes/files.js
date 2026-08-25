import express from 'express';
import multer from 'multer';
import { supabaseAdmin, STORAGE_BUCKET } from '../config/supabase.js';
import { extractTextFromPDF, chunkText } from '../services/pdfService.js';
import { generateBatchEmbeddings, isSemanticEnabled } from '../services/embeddingService.js';
import { generateSmartMetadata } from '../services/metadataService.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = express.Router();

// Memory storage for multer (holds PDF in buffer before uploading to Supabase Storage & extracting text)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max per file
    files: 5, // up to 5 files per batch to keep memory use bounded
    parts: 6,
    fields: 1,
    fieldSize: 10 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf')
    ) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.originalname}. Only PDF files are supported.`));
    }
  },
});

// Apply auth middleware to all file routes
router.use(requireAuth);

/**
 * POST /api/files/upload
 * Accepts multiple PDF files, extracts text, generates AI smart metadata & embeddings,
 * stores in Supabase Storage and Postgres.
 */
router.post('/upload', rateLimit({ name: 'upload', windowMs: 10 * 60 * 1000, max: 10 }), upload.array('files', 5), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No PDF files provided.' });
    }

    const userId = req.user.id;
    const processedFiles = [];
    const errors = [];

    for (const file of files) {
      let storagePath = null;
      let documentId = null;
      let storageUploaded = false;
      try {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const sanitizedBaseName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniqueStorageFilename = `${Date.now()}_${sanitizedBaseName}`;
        storagePath = `${userId}/${uniqueStorageFilename}`;

        // 1. Extract text and metadata from PDF
        const extraction = await extractTextFromPDF(file.buffer);

        // 2. Generate AI Smart Metadata (Clean Title, 1-Sentence Summary, Topic Tags)
        const smartMeta = await generateSmartMetadata(extraction.text, originalName, extraction.summary);

        // 3. Upload file binary to Supabase Storage bucket (original file preserved)
        const { error: storageError } = await supabaseAdmin.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, file.buffer, {
            contentType: 'application/pdf',
            upsert: false,
          });

        if (storageError) {
          console.error(`Storage upload error for ${originalName}:`, storageError);
          throw new Error(`Storage upload failed: ${storageError.message}`);
        }
        storageUploaded = true;

        // 4. Insert document record into Postgres
        const insertPayload = {
          user_id: userId,
          filename: uniqueStorageFilename,
          original_name: originalName,
          smart_title: smartMeta.smart_title || originalName,
          tags: smartMeta.tags || [],
          file_size: file.size,
          mime_type: 'application/pdf',
          storage_path: storagePath,
          page_count: extraction.pageCount,
          extracted_text: extraction.text,
          summary: smartMeta.summary || extraction.summary,
        };

        let { data: docData, error: docError } = await supabaseAdmin
          .from('documents')
          .insert(insertPayload)
          .select()
          .single();

        if (docError) {
          // If columns don't exist yet (before migration), fallback to basic insert
          if (docError.message.includes('smart_title') || docError.message.includes('tags')) {
            delete insertPayload.smart_title;
            delete insertPayload.tags;
            const { data: fallbackDoc, error: fallbackError } = await supabaseAdmin
              .from('documents')
              .insert(insertPayload)
              .select()
              .single();
            if (fallbackError) throw new Error(`Database record creation failed: ${fallbackError.message}`);
            docData = fallbackDoc;
          } else {
            console.error(`DB insert error for ${originalName}:`, docError);
            throw new Error(`Database record creation failed: ${docError.message}`);
          }
        }
        documentId = docData.id;

        // 5. Generate and store searchable chunks with vector embeddings (if enabled)
        const chunks = chunkText(extraction.text, extraction.pageCount, { pages: extraction.pages });
        if (chunks.length > 0) {
          let chunkEmbeddings = [];
          let embeddingFailure = null;
          if (isSemanticEnabled()) {
            try {
              chunkEmbeddings = await generateBatchEmbeddings(chunks.map(c => c.content));
              const failedEmbeddingCount = chunkEmbeddings.filter(embedding => !Array.isArray(embedding)).length;
              if (failedEmbeddingCount > 0) {
                embeddingFailure = `${failedEmbeddingCount} of ${chunks.length} chunk embeddings could not be generated.`;
              }
            } catch (embedErr) {
              embeddingFailure = `Vector embedding generation failed: ${embedErr.message}`;
              console.warn(`Vector embedding generation failed for ${originalName}:`, embedErr.message);
            }
          }

          const chunkRecords = chunks.map((chunk, idx) => ({
            document_id: docData.id,
            user_id: userId,
            chunk_index: chunk.chunk_index,
            page_number: chunk.page_number,
            content: chunk.content,
            embedding: chunkEmbeddings[idx] || null,
          }));

          const { error: chunkError } = await supabaseAdmin
            .from('document_chunks')
            .insert(chunkRecords);

          if (chunkError) {
            throw new Error(`Document indexing failed: chunk insertion failed: ${chunkError.message}`);
          }

          if (embeddingFailure) {
            throw new Error(`Document indexing incomplete: ${embeddingFailure} Keyword search fallback remains available.`);
          }
        } else {
          throw new Error('Document indexing failed: no searchable text chunks were generated.');
        }

        processedFiles.push({
          id: docData.id,
          original_name: docData.original_name,
          smart_title: docData.smart_title || smartMeta.smart_title || docData.original_name,
          tags: docData.tags || smartMeta.tags || [],
          filename: docData.filename,
          file_size: docData.file_size,
          page_count: docData.page_count,
          summary: docData.summary,
          word_count: extraction.wordCount,
          created_at: docData.created_at,
          status: 'success',
        });
      } catch (err) {
        console.error(`Failed processing ${file.originalname}:`, err);
        if (documentId) {
          const { error: cleanupDbError } = await supabaseAdmin
            .from('documents')
            .delete()
            .eq('id', documentId)
            .eq('user_id', userId);
          if (cleanupDbError) {
            console.error(`Database cleanup failed for ${file.originalname}:`, cleanupDbError);
          }
        }
        if (storageUploaded && storagePath) {
          const { error: cleanupStorageError } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .remove([storagePath]);
          if (cleanupStorageError) {
            console.error(`Storage cleanup failed for ${file.originalname}:`, cleanupStorageError);
          }
        }
        errors.push({
          filename: file.originalname,
          error: err.message,
        });
      }
    }

    return res.status(201).json({
      message: `Processed ${processedFiles.length} of ${files.length} files successfully.`,
      uploaded: processedFiles,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('File upload route error:', error);
    return res.status(500).json({
      error: 'UploadError',
      message: error.message || 'Failed to upload and process files.',
    });
  }
});

/**
 * GET /api/files
 * Returns all documents uploaded by the authenticated user with smart titles and tags.
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    // Select smart_title, tags, and summary alongside standard fields
    const { data: documents, error } = await supabaseAdmin
      .from('documents')
      .select('id, filename, original_name, smart_title, tags, file_size, mime_type, page_count, summary, created_at, storage_path')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      // Fallback if smart_title column is not yet migrated
      if (error.message.includes('smart_title') || error.message.includes('tags')) {
        const { data: fallbackDocs } = await supabaseAdmin
          .from('documents')
          .select('id, filename, original_name, file_size, mime_type, page_count, summary, created_at, storage_path')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        return res.json({ documents: fallbackDocs || [] });
      }
      console.error('Error fetching documents:', error);
      return res.status(500).json({ error: 'DatabaseError', message: error.message });
    }

    return res.json({ documents: documents || [] });
  } catch (error) {
    console.error('Fetch documents error:', error);
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
});

/**
 * GET /api/files/:id/view-url
 * Generates a temporary signed URL for viewing/downloading the PDF.
 */
router.get('/:id/view-url', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: doc, error: docError } = await supabaseAdmin
      .from('documents')
      .select('id, storage_path, original_name, smart_title, user_id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (docError || !doc) {
      return res.status(404).json({ error: 'DocumentNotFound', message: 'Document not found or access denied.' });
    }

    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(doc.storage_path, 3600);

    if (signError) {
      console.error('Error creating signed URL:', signError);
      return res.status(500).json({ error: 'StorageError', message: 'Failed to generate signed URL.' });
    }

    return res.json({
      url: signedData.signedUrl,
      filename: doc.smart_title || doc.original_name,
      original_name: doc.original_name,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error('View URL error:', error);
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
});

/**
 * DELETE /api/files/:id
 * Deletes the document from storage and database.
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: doc, error: docError } = await supabaseAdmin
      .from('documents')
      .select('id, storage_path')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (docError || !doc) {
      return res.status(404).json({ error: 'DocumentNotFound', message: 'Document not found or access denied.' });
    }

    if (doc.storage_path) {
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([doc.storage_path]);
    }

    const { error: deleteError } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting document record:', deleteError);
      return res.status(500).json({ error: 'DatabaseError', message: deleteError.message });
    }

    return res.json({ message: 'Document deleted successfully.', id });
  } catch (error) {
    console.error('Delete document error:', error);
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
});

export default router;
