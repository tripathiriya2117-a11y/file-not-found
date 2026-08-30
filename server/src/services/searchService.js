import { supabaseAdmin } from '../config/supabase.js';
import { generateEmbedding, isSemanticEnabled } from './embeddingService.js';

// Common stop words, prepositions, and query prefixes to filter for intelligent search
const STOP_WORDS = new Set([
  'find', 'my', 'which', 'pdf', 'pdfs', 'file', 'files', 'document', 'documents',
  'notes', 'note', 'contains', 'contain', 'containing', 'having', 'show', 'shows',
  'get', 'give', 'about', 'what', 'where', 'who', 'is', 'are', 'the', 'a', 'an',
  'of', 'in', 'for', 'with', 'and', 'or', 'to', 'from', 'on', 'at', 'by', 'that',
  'this', 'these', 'those', 'me', 'i', 'please', 'tell', 'search', 'into', 'onto',
  'over', 'under', 'before', 'after', 'during', 'through', 'also', 'such', 'using',
  'used', 'been', 'were', 'was', 'have', 'has', 'had', 'its', 'their', 'your',
  'all', 'any', 'some', 'both', 'each', 'more', 'most', 'other', 'so', 'then'
]);

// Minimum cosine similarity required before a chunk is even considered a
// candidate semantic match. Below this the match is statistically noise
// (unrelated text in this index clusters around ~0.50–0.56).
const MIN_SEMANTIC_SIMILARITY = 0.6;

// Below this relevance score a result is treated as a weak / fabricated match
// and is dropped entirely rather than shown as a misleading ~50% hit.
const MIN_RELEVANCE = 50;

/**
 * Extracts meaningful search keywords and clean phrases from a natural query.
 * e.g. "Find my Java Chapter 1 PDF" -> cleanQuery: "java chapter 1", terms: ["java", "chapter", "1"]
 */
export function parseNaturalQuery(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') {
    return { rawQuery: '', cleanQuery: '', terms: [], originalTerms: [] };
  }

  const trimmed = rawQuery.trim();
  const tokens = trimmed
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const meaningfulTerms = tokens.filter(token => !STOP_WORDS.has(token) && token.length > 0);

  return {
    rawQuery: trimmed,
    cleanQuery: meaningfulTerms.join(' '),
    terms: meaningfulTerms,
    originalTerms: tokens,
  };
}

/**
 * Searches documents for the authenticated user using Hybrid Semantic (pgvector)
 * with automatic fallback to full-text / phrase search.
 *
 * @param {string} userId - UUID of the authenticated user.
 * @param {string} rawQuery - Natural language query from the user.
 * @returns {Promise<{query: string, parsedTerms: string[], total: number, results: Array}>}
 */
export async function searchDocuments(userId, rawQuery) {
  const { cleanQuery, terms, rawQuery: queryText } = parseNaturalQuery(rawQuery);

  if (!queryText || terms.length === 0) {
    return {
      query: queryText,
      parsedTerms: [],
      total: 0,
      results: [],
    };
  }

  // 1. Try Hybrid Semantic + Keyword Search if Gemini embeddings are enabled
  if (isSemanticEnabled()) {
    try {
      const queryEmbedding = await generateEmbedding(cleanQuery);
      if (queryEmbedding && Array.isArray(queryEmbedding)) {
        const { data: hybridChunks, error: rpcError } = await supabaseAdmin.rpc(
          'hybrid_match_document_chunks',
          {
            query_embedding: queryEmbedding,
            query_text: cleanQuery,
            target_user_id: userId,
            match_count: 15,
            semantic_weight: 0.6,
            keyword_weight: 0.4,
          }
        );

        if (!rpcError && hybridChunks && hybridChunks.length > 0) {
          const docIds = [...new Set(hybridChunks.map(c => c.document_id))];
          const { data: docs, error: docFetchError } = await supabaseAdmin
            .from('documents')
            .select('id, filename, original_name, smart_title, tags, file_size, page_count, storage_path, created_at, summary')
            .in('id', docIds)
            .eq('user_id', userId);

          if (docFetchError) {
            const hybridSchemaError = new Error(`Hybrid search document lookup failed: ${docFetchError.message}`);
            hybridSchemaError.code = 'HYBRID_SCHEMA_ERROR';
            throw hybridSchemaError;
          }

          if (docs && docs.length > 0) {
            const docsMap = new Map(docs.map(d => [d.id, d]));
            const scoredResults = [];

            for (const chunk of hybridChunks) {
              const doc = docsMap.get(chunk.document_id);
              if (!doc) continue;

              const similarity = chunk.similarity || 0;
              const combinedScore = chunk.combined_score || 0;

              if (similarity < MIN_SEMANTIC_SIMILARITY) continue;

              const snippet = extractContextualSnippet(chunk.content, terms);
              
              // Relevance is a ranking signal, not a probability.
              const relevance = Math.min(
                99,
                 Math.max(MIN_RELEVANCE, Math.round(similarity > 0 ? similarity * 100 : 40 + combinedScore * 30))
              );

              // Formulate explainable match reasoning
              let whyMatched = '';
              if (similarity > 0.5) {
                whyMatched = `Semantic match (${Math.round(similarity * 100)}% conceptual similarity) on Page ${chunk.page_number}`;
              } else {
                whyMatched = `Matched content on Page ${chunk.page_number}`;
              }

              const cleanedSnippet = snippet.replace(/[\n\r]+/g, ' ').replace(/\.\.\./g, '').trim();
              if (cleanedSnippet.length > 15) {
                const firstSentence = cleanedSnippet.split(/[.!?]/)[0].trim();
                if (firstSentence && firstSentence.length < 80) {
                  whyMatched += ` — Context: "${firstSentence}"`;
                }
              }

              scoredResults.push({
                id: doc.id,
                filename: doc.filename,
                original_name: doc.original_name,
                smart_title: doc.smart_title || doc.original_name,
                tags: doc.tags || [],
                file_size: doc.file_size,
                page_count: doc.page_count,
                storage_path: doc.storage_path,
                created_at: doc.created_at,
                summary: doc.summary,
                score: Math.round(combinedScore * 100),
                relevance,
                pageNumber: chunk.page_number,
                snippet,
                whyMatched,
                searchMode: similarity > 0 ? 'hybrid-semantic' : 'keyword',
              });
            }

            if (scoredResults.length > 0) {
              const uniqueResults = deduplicateDocumentResults(scoredResults);
              return {
                query: queryText,
                parsedTerms: terms,
                total: uniqueResults.length,
                results: uniqueResults,
              };
            }
          }
        }
      }
    } catch (semanticError) {
      if (semanticError.code === 'HYBRID_SCHEMA_ERROR') {
        throw semanticError;
      }
      console.warn('⚠️ Hybrid semantic search encountered error, falling back to keyword search:', semanticError.message);
    }
  }

  // 2. Keyword & Phrase Fallback Search
  return executeKeywordSearch(userId, queryText, cleanQuery, terms);
}

/**
 * Calibrated keyword, phrase and chunk proximity search engine.
 */
async function executeKeywordSearch(userId, queryText, cleanQuery, terms) {
  let [docsResult, chunksResult] = await Promise.all([
    supabaseAdmin
      .from('documents')
      .select('id, filename, original_name, smart_title, tags, file_size, page_count, extracted_text, summary, created_at, storage_path')
      .eq('user_id', userId),
    supabaseAdmin
      .from('document_chunks')
      .select('id, document_id, chunk_index, page_number, content')
      .eq('user_id', userId),
  ]);

  if (docsResult.error && (docsResult.error.message.includes('smart_title') || docsResult.error.message.includes('tags'))) {
    [docsResult, chunksResult] = await Promise.all([
      supabaseAdmin
        .from('documents')
        .select('id, filename, original_name, file_size, page_count, extracted_text, summary, created_at, storage_path')
        .eq('user_id', userId),
      supabaseAdmin
        .from('document_chunks')
        .select('id, document_id, chunk_index, page_number, content')
        .eq('user_id', userId),
    ]);
  }

  if (docsResult.error) {
    console.error('Error fetching documents for search:', docsResult.error);
    throw new Error('Failed to query documents database.');
  }

  const documents = docsResult.data || [];
  const chunks = chunksResult.data || [];

  const chunksByDocId = new Map();
  for (const chunk of chunks) {
    if (!chunksByDocId.has(chunk.document_id)) {
      chunksByDocId.set(chunk.document_id, []);
    }
    chunksByDocId.get(chunk.document_id).push(chunk);
  }

  const scoredResults = [];

  for (const doc of documents) {
    const docChunks = chunksByDocId.get(doc.id) || [];
    const docFullText = (doc.extracted_text || '').toLowerCase();
    const docTitle = ((doc.smart_title || '') + ' ' + (doc.original_name || '')).toLowerCase();

    let bestChunk = null;
    let bestChunkScore = 0;
    let bestChunkPage = 1;
    let bestChunkMatchedTerms = [];
    const allDocMatchedTerms = new Set();

    // Check exact phrase match in whole doc
    const exactPhraseInDoc = cleanQuery.length > 3 && (docFullText.includes(cleanQuery.toLowerCase()) || docTitle.includes(cleanQuery.toLowerCase()));

    // Score chunks individually
    for (const chunk of docChunks) {
      const chunkTextLower = chunk.content.toLowerCase();
      let chunkScore = 0;
      let matchedTermsInChunk = [];

      // Exact phrase match in chunk
      if (cleanQuery.length > 3 && chunkTextLower.includes(cleanQuery.toLowerCase())) {
        chunkScore += 80;
        matchedTermsInChunk.push(cleanQuery);
      }

      // Individual term matches
      let termsFoundCount = 0;
      for (const term of terms) {
        const regex = new RegExp(`\\b${escapeRegex(term)}`, 'gi');
        const matches = chunkTextLower.match(regex);
        if (matches && matches.length > 0) {
          termsFoundCount++;
          chunkScore += Math.min(30, matches.length * 8); // Capped term frequency
          if (!matchedTermsInChunk.includes(term)) {
            matchedTermsInChunk.push(term);
          }
          allDocMatchedTerms.add(term);
        }
      }

      // Bonus if all search terms appear in this single chunk
      if (terms.length > 1 && termsFoundCount === terms.length) {
        chunkScore += 35;
      }

      if (chunkScore > bestChunkScore) {
        bestChunkScore = chunkScore;
        bestChunk = chunk;
        bestChunkPage = chunk.page_number;
        bestChunkMatchedTerms = matchedTermsInChunk;
      }
    }

    // Title / filename match check
    let titleMatchedTermsCount = 0;
    for (const term of terms) {
      if (docTitle.includes(term)) {
        titleMatchedTermsCount++;
        allDocMatchedTerms.add(term);
      }
    }

    // Fallback: check full document text if no chunks scored
    if (bestChunkScore === 0) {
      for (const term of terms) {
        if (docFullText.includes(term)) {
          allDocMatchedTerms.add(term);
        }
      }
      if (allDocMatchedTerms.size > 0) {
        bestChunk = {
          content: doc.summary || doc.extracted_text.substring(0, 300),
          page_number: 1,
        };
      }
    }

    // Term coverage ratio across the document
    const termCoverage = terms.length > 0 ? (allDocMatchedTerms.size / terms.length) : 0;

    // Meaningful Match Filtering
    const isMeaningful = 
      exactPhraseInDoc ||
      (terms.length > 1 && termCoverage >= 0.5 && bestChunkScore >= 16) ||
      (terms.length === 1 && (titleMatchedTermsCount > 0 || bestChunkScore >= 16));

    if (isMeaningful) {
      // Dynamic relevance calculation
      let relevance = 0;

      if (exactPhraseInDoc) {
        relevance = Math.min(99, Math.max(92, 90 + Math.min(9, Math.round(bestChunkScore * 0.1))));
      } else if (terms.length > 1 && termCoverage === 1.0 && bestChunkMatchedTerms.length === terms.length) {
        relevance = Math.min(90, Math.max(80, 80 + Math.min(10, Math.round(bestChunkScore * 0.1))));
      } else if (terms.length > 1 && termCoverage >= 0.5) {
        relevance = Math.min(75, Math.max(52, Math.round((termCoverage * 40) + Math.min(35, bestChunkScore * 0.5))));
      } else {
        relevance = Math.min(70, Math.max(45, Math.round(35 + Math.min(35, bestChunkScore * 0.8) + (titleMatchedTermsCount * 10))));
      }

      const snippetText = bestChunk ? bestChunk.content : (doc.summary || doc.extracted_text.substring(0, 300));
      const snippet = extractContextualSnippet(snippetText, terms);
      const whyMatched = generateMatchExplanation({
        originalName: doc.smart_title || doc.original_name,
        cleanQuery,
        terms,
        matchedTerms: Array.from(allDocMatchedTerms),
        exactPhrase: exactPhraseInDoc,
        pageNumber: bestChunkPage,
        snippet,
      });

      scoredResults.push({
        id: doc.id,
        filename: doc.filename,
        original_name: doc.original_name,
        smart_title: doc.smart_title || doc.original_name,
        tags: doc.tags || [],
        file_size: doc.file_size,
        page_count: doc.page_count,
        storage_path: doc.storage_path,
        created_at: doc.created_at,
        summary: doc.summary,
        score: bestChunkScore + (titleMatchedTermsCount * 15) + (exactPhraseInDoc ? 30 : 0),
        relevance,
        pageNumber: bestChunkPage,
        snippet,
        whyMatched,
        searchMode: 'keyword-fallback',
      });
    }
  }

  const uniqueResults = deduplicateDocumentResults(scoredResults);

  return {
    query: queryText,
    parsedTerms: terms,
    total: uniqueResults.length,
    results: uniqueResults,
  };
}

function deduplicateDocumentResults(results) {
  const bestByDocumentId = new Map();

  for (const result of results) {
    const documentId = result.id || result.document_id;
    if (!documentId) continue;

    const current = bestByDocumentId.get(documentId);
    if (!current || isBetterDocumentResult(result, current)) {
      bestByDocumentId.set(documentId, result);
    }
  }

  return [...bestByDocumentId.values()].sort((a, b) => {
    if (b.relevance !== a.relevance) return b.relevance - a.relevance;
    return (b.score || 0) - (a.score || 0);
  });
}

function isBetterDocumentResult(candidate, current) {
  if ((candidate.score || 0) !== (current.score || 0)) {
    return (candidate.score || 0) > (current.score || 0);
  }
  if ((candidate.relevance || 0) !== (current.relevance || 0)) {
    return (candidate.relevance || 0) > (current.relevance || 0);
  }
  return (candidate.snippet || '').length > (current.snippet || '').length;
}

/**
 * Extracts a window of text around matching keywords.
 */
function extractContextualSnippet(text, terms, maxLength = 240) {
  if (!text) return '';

  const lowerText = text.toLowerCase();
  let firstIndex = -1;

  for (const term of terms) {
    const idx = lowerText.indexOf(term);
    if (idx !== -1 && (firstIndex === -1 || idx < firstIndex)) {
      firstIndex = idx;
    }
  }

  if (firstIndex === -1) {
    const trimmed = text.substring(0, maxLength).trim();
    return trimmed + (text.length > maxLength ? '...' : '');
  }

  const start = Math.max(0, firstIndex - 60);
  const end = Math.min(text.length, start + maxLength);
  let snippet = text.substring(start, end).trim();

  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Generates an intuitive human-readable explanation of why a document matched.
 */
function generateMatchExplanation({ originalName, cleanQuery, terms, matchedTerms, exactPhrase, pageNumber, snippet }) {
  const parts = [];

  if (exactPhrase) {
    parts.push(`Contains exact phrase "${cleanQuery}" on Page ${pageNumber}`);
  } else if (matchedTerms && matchedTerms.length > 0) {
    const termList = matchedTerms.map(t => `"${t}"`).join(', ');
    parts.push(`Matched key terms ${termList} on Page ${pageNumber}`);
  } else {
    parts.push(`Content in document references "${terms.join(' ')}"`);
  }

  const cleanedSnippet = snippet.replace(/[\n\r]+/g, ' ').replace(/\.\.\./g, '').trim();
  if (cleanedSnippet.length > 0) {
    const firstSentence = cleanedSnippet.split(/[.!?]/)[0].trim();
    if (firstSentence && firstSentence.length > 15 && firstSentence.length < 90) {
      parts.push(`Context: "${firstSentence}"`);
    }
  }

  return parts.join(' — ');
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
