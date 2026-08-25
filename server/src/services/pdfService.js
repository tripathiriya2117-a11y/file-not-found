import pdfParse from 'pdf-parse';

/**
 * Extracts raw text and metadata from a PDF file buffer.
 * @param {Buffer} dataBuffer - Binary buffer of the PDF file.
 * @returns {Promise<{text: string, pageCount: number, wordCount: number, summary: string, info: object}>}
 */
export async function extractTextFromPDF(dataBuffer) {
  try {
    const pageTexts = [];
    const data = await pdfParse(dataBuffer, {
      max: 0, // parse all pages
      pagerender: async (pageData) => {
        const textContent = await pageData.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        pageTexts[pageData.pageIndex] = pageText;
        return pageText;
      },
    });

    const rawText = data.text || '';
    // Normalize newlines and excess whitespace
    const cleanText = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const words = cleanText ? cleanText.split(/\s+/) : [];
    const wordCount = words.length;

    // Generate a concise preview/summary (first 300 characters without breaking words)
    let summary = '';
    if (cleanText.length > 0) {
      summary = cleanText.substring(0, 300).trim();
      if (cleanText.length > 300) {
        summary += '...';
      }
    } else {
      summary = 'No selectable text found in this PDF (document may be scanned or empty).';
    }

    return {
      text: cleanText,
      pageCount: data.numpages || 1,
      pages: pageTexts.map((text, index) => ({
        page_number: index + 1,
        text: text || '',
      })),
      wordCount,
      summary,
      info: data.info || {},
    };
  } catch (error) {
    console.error('Error parsing PDF buffer:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Chunks extracted text into manageable, searchable segments.
 * Modular design allowing easy integration of future vector embeddings.
 * @param {string} fullText - Cleaned full text of the document.
 * @param {number} totalPages - Total pages in the document.
 * @param {object} options - Chunking options.
 * @returns {Array<{chunk_index: number, page_number: number, content: string}>}
 */
export function chunkText(fullText, totalPages = 1, options = {}) {
  const { chunkSize = 600, overlap = 100 } = options;

  if (!fullText || fullText.trim().length === 0) {
    return [];
  }

  const pages = options.pages || [{ page_number: 1, text: fullText }];
  const chunks = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const paragraphs = page.text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    let currentChunk = '';

    const addChunk = (content) => {
      if (content.trim()) {
        chunks.push({
          chunk_index: chunkIndex++,
          page_number: page.page_number,
          content: content.trim(),
        });
      }
    };

    for (const para of paragraphs) {
      if ((currentChunk + ' ' + para).length > chunkSize && currentChunk.length > 0) {
        addChunk(currentChunk);
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.min(words.length, Math.floor(overlap / 6))).join(' ');
        currentChunk = overlapWords + '\n' + para;
      } else {
        currentChunk = currentChunk ? currentChunk + '\n' + para : para;
      }
    }

    if (currentChunk.length > chunkSize) {
      let start = 0;
      while (start < currentChunk.length) {
        addChunk(currentChunk.substring(start, start + chunkSize));
        start += Math.max(1, chunkSize - overlap);
      }
      currentChunk = '';
    }

    if (currentChunk.trim()) {
      addChunk(currentChunk);
    }
  }

  return chunks;
}
