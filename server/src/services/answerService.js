import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ANSWER_MODEL_NAME = 'gemini-2.5-flash';

let answerModel = null;

if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your-gemini-api-key') {
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    answerModel = genAI.getGenerativeModel({
      model: ANSWER_MODEL_NAME,
      generationConfig: { responseMimeType: 'application/json' },
    });
  } catch (error) {
    console.warn('Failed to initialize Gemini answer client:', error.message);
  }
}

const EMPTY_ANSWER = 'The retrieved documents do not contain enough information to answer this question.';

/**
 * Generates a short answer using only the supplied search-result snippets.
 * Source metadata is constructed server-side from the same retrieved results.
 */
export async function generateGroundedAnswer(query, results = []) {
  const retrievedChunks = results
    .slice(0, 5)
    .filter(result => result && result.snippet && result.id)
    .map((result, index) => ({
      source_index: index,
      document_id: result.id,
      filename: result.smart_title || result.original_name,
      page_number: result.pageNumber || 1,
      content: result.snippet,
    }));

  const sources = retrievedChunks.map(({ source_index, document_id, filename, page_number }) => ({
    source_index,
    document_id,
    filename,
    page_number,
  }));

  if (retrievedChunks.length === 0) {
    return { text: EMPTY_ANSWER, sources: [], generated: false };
  }

  if (!answerModel) {
    return { text: EMPTY_ANSWER, sources: [], generated: false };
  }

  const context = retrievedChunks.map(source => (
    `[Source ${source.source_index}] ${source.filename}, page ${source.page_number}\n${source.content}`
  )).join('\n\n');

  const prompt = `You answer questions about indexed PDF documents.
Answer the user's question directly and concisely, using ONLY the supplied source excerpts.
Do not use outside knowledge or infer facts that are not stated in the excerpts.
If the excerpts do not contain enough information, say exactly that you do not have enough information.
Return only valid JSON with this shape:
{
  "answer": "short answer, or an explicit insufficient-information statement",
  "source_indexes": [0]
}
source_indexes must contain only the source numbers that support the answer.

User question: ${query}

Retrieved source excerpts:
${context}`;

  try {
    const result = await Promise.race([
      answerModel.generateContent(prompt),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Answer generation timed out')), 15000)),
    ]);
    const parsed = JSON.parse(result.response.text());
    const text = typeof parsed.answer === 'string' && parsed.answer.trim()
      ? parsed.answer.trim().substring(0, 600)
      : EMPTY_ANSWER;
    const requestedIndexes = Array.isArray(parsed.source_indexes) ? parsed.source_indexes : [];
    const validIndexes = new Set(retrievedChunks.map(source => source.source_index));
    const selectedSources = sources.filter(source => requestedIndexes.includes(source.source_index) && validIndexes.has(source.source_index));

    const isInsufficient = /not enough information|insufficient information|do not have enough information/i.test(text);
    if (selectedSources.length === 0 || isInsufficient) {
      return { text: EMPTY_ANSWER, sources: [], generated: false };
    }

    return { text, sources: selectedSources, generated: true };
  } catch (error) {
    console.warn('Gemini answer generation failed:', error.message);
    return { text: EMPTY_ANSWER, sources: [], generated: false };
  }
}

export { ANSWER_MODEL_NAME };