import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_MODEL_NAME = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;

let genAI = null;
let embeddingModel = null;

if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your-gemini-api-key') {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL_NAME });
    console.log(`✨ Gemini Semantic Embedding initialized with model: ${EMBEDDING_MODEL_NAME} (${EMBEDDING_DIMENSIONS}d)`);
  } catch (err) {
    console.warn('⚠️ Failed to initialize Gemini embedding client:', err.message);
  }
} else {
  console.log('ℹ️ GEMINI_API_KEY not configured. Semantic vector search is disabled (using keyword search fallback).');
}

/**
 * Returns true if Gemini embeddings are configured and available.
 */
export function isSemanticEnabled() {
  return Boolean(embeddingModel && GEMINI_API_KEY && GEMINI_API_KEY !== 'your-gemini-api-key');
}

/**
 * Generates a 768-dimensional vector embedding for a given text with retry support.
 * @param {string} text - Input text.
 * @param {number} retries - Number of retry attempts for transient errors.
 * @returns {Promise<number[]|null>} - 768-float array or null on failure.
 */
export async function generateEmbedding(text, retries = 2) {
  if (!isSemanticEnabled() || !text || text.trim().length === 0) {
    return null;
  }

  const cleanText = text.replace(/[\n\r]+/g, ' ').trim().substring(0, 8000);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await embeddingModel.embedContent({
        content: { parts: [{ text: cleanText }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      });

      if (result && result.embedding && result.embedding.values) {
        return result.embedding.values;
      }
      return null;
    } catch (error) {
      if (attempt < retries) {
        // Exponential backoff: 300ms, 600ms
        await new Promise(r => setTimeout(r, (attempt + 1) * 300));
      } else {
        console.warn(`⚠️ Embedding generation failed after ${retries + 1} attempts: ${error.message}`);
        return null;
      }
    }
  }
  return null;
}

/**
 * Generates embeddings for a batch of text chunks with controlled concurrency.
 * @param {string[]} textArray - Array of text chunks.
 * @returns {Promise<Array<number[]|null>>}
 */
export async function generateBatchEmbeddings(textArray) {
  if (!isSemanticEnabled() || !Array.isArray(textArray) || textArray.length === 0) {
    return textArray.map(() => null);
  }

  const results = [];
  const BATCH_SIZE = 4; // Concurrency limit

  for (let i = 0; i < textArray.length; i += BATCH_SIZE) {
    const batch = textArray.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(text => generateEmbedding(text));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    // Slight pause between batches to prevent rate limit spikes
    if (i + BATCH_SIZE < textArray.length) {
      await new Promise(r => setTimeout(r, 150));
    }
  }

  return results;
}

export { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL_NAME };
