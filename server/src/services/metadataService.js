import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const METADATA_MODEL_NAME = 'gemini-2.5-flash';

let genAI = null;
let metadataModel = null;

if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your-gemini-api-key') {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    metadataModel = genAI.getGenerativeModel({
      model: METADATA_MODEL_NAME,
      generationConfig: { responseMimeType: 'application/json' },
    });
    console.log(`✨ Gemini Smart Metadata Generator initialized with model: ${METADATA_MODEL_NAME}`);
  } catch (err) {
    console.warn('⚠️ Failed to initialize Gemini metadata client:', err.message);
  }
}

/**
 * Sanitizes a filename to ensure it is completely safe for filesystems and UI display.
 */
export function sanitizeSmartFilename(rawTitle, fallbackOriginalName = 'document.pdf') {
  if (!rawTitle || typeof rawTitle !== 'string') {
    return fallbackOriginalName;
  }

  let clean = rawTitle
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // remove illegal filesystem chars
    .replace(/\s+/g, ' ')
    .trim();

  // Strip existing .pdf if repeated
  clean = clean.replace(/\.pdf$/i, '').trim();

  // Enforce reasonable length
  if (clean.length > 75) {
    clean = clean.substring(0, 75).trim();
  }

  if (!clean) {
    clean = fallbackOriginalName.replace(/\.pdf$/i, '').trim() || 'Document';
  }

  return `${clean}.pdf`;
}

/**
 * Generates AI Smart Metadata (clean filename, 1-sentence summary, 3-5 tags) from extracted PDF text.
 *
 * @param {string} extractedText - Clean text extracted from the PDF.
 * @param {string} originalFilename - Original filename uploaded by the user.
 * @param {string} fallbackSummary - Baseline summary from text extraction.
 * @returns {Promise<{smart_title: string, summary: string, tags: string[]}>}
 */
export async function generateSmartMetadata(extractedText, originalFilename, fallbackSummary = '') {
  // Baseline fallback object
  const fallbackResult = {
    smart_title: sanitizeSmartFilename(originalFilename, originalFilename),
    summary: fallbackSummary ? fallbackSummary.substring(0, 200) : 'PDF Document content.',
    tags: [],
  };

  if (!metadataModel || !extractedText || extractedText.trim().length < 15) {
    return fallbackResult;
  }

  try {
    // Send first 4,000 characters of extracted text (efficient and covers titles/abstracts/intros)
    const contextSnippet = extractedText.substring(0, 4000).replace(/[\n\r]+/g, ' ').trim();

    const prompt = `You are an expert digital archivist. Analyze the extracted text of this PDF document and its original filename.
Generate:
1. "smart_title": A clean, descriptive, human-readable filename ending in .pdf (e.g. "Java JVM Memory Management.pdf" or "Cyber Safety Helpdesk Project Brief.pdf"). Do NOT include filesystem path separators (/ or \\), colons, asterisks, question marks, quotes, or illegal characters.
2. "summary": Exactly ONE concise sentence (max 25 words) explaining what this document is about.
3. "tags": An array of 3 to 5 concise, relevant topic tags (e.g. ["Java", "JVM", "Memory", "Garbage Collection"]).

Original Filename: "${originalFilename}"
Extracted Content:
${contextSnippet}

Respond ONLY with a valid JSON object matching this schema:
{
  "smart_title": string,
  "summary": string,
  "tags": string[]
}`;

    const result = await metadataModel.generateContent(prompt);
    const responseText = result.response.text();

    if (!responseText) {
      return fallbackResult;
    }

    const parsed = JSON.parse(responseText);

    const smartTitle = sanitizeSmartFilename(parsed.smart_title, originalFilename);
    const summary = typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
      ? parsed.summary.trim().substring(0, 250)
      : fallbackResult.summary;

    const tags = Array.isArray(parsed.tags)
      ? [...new Set(parsed.tags.map(t => String(t).trim()).filter(t => t.length > 0 && t.length < 35))].slice(0, 5)
      : [];

    return {
      smart_title: smartTitle,
      summary: summary,
      tags: tags,
    };
  } catch (error) {
    console.warn(`⚠️ Smart metadata generation failed for "${originalFilename}": ${error.message}. Using safe fallback.`);
    return fallbackResult;
  }
}
