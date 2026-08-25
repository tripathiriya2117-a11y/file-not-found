import { extractTextFromPDF, chunkText } from '../src/services/pdfService.js';
import { parseNaturalQuery } from '../src/services/searchService.js';
import { isSemanticEnabled, EMBEDDING_DIMENSIONS, EMBEDDING_MODEL_NAME } from '../src/services/embeddingService.js';

async function runTests() {
  console.log('--- 1. Testing Natural Language Query Parser ---');
  const q1 = parseNaturalQuery('Find my Java Chapter 1 PDF');
  console.log('Query 1 terms:', q1.terms);
  if (!q1.terms.includes('java') || !q1.terms.includes('chapter') || !q1.terms.includes('1')) {
    throw new Error('Query 1 parsing failed');
  }

  const q2 = parseNaturalQuery('Which PDF contains servlet notes?');
  console.log('Query 2 terms:', q2.terms);
  if (!q2.terms.includes('servlet')) {
    throw new Error('Query 2 parsing failed');
  }

  const q3 = parseNaturalQuery('Find the internship eligibility document');
  console.log('Query 3 terms:', q3.terms);
  if (!q3.terms.includes('internship') || !q3.terms.includes('eligibility')) {
    throw new Error('Query 3 parsing failed');
  }

  console.log('--- 2. Testing Text Chunking ---');
  const sampleText = `Java Chapter 1: Introduction to Variables, Data Types, and JVM Architecture.
Java is a class-based, object-oriented programming language designed for minimal implementation dependencies.

Data Types in Java include Primitive (byte, short, int, long, float, double, boolean, char) and Non-Primitive (String, Arrays, Classes).

Servlets are Java programs that run on a Web server and act as a middle layer between a request coming from a Web browser and databases.`;

  const chunks = chunkText(sampleText, 2, { chunkSize: 150, overlap: 30 });
  console.log(`Generated ${chunks.length} chunks from sample document:`);
  chunks.forEach((c) => {
    console.log(`  [Chunk ${c.chunk_index} (Page ${c.page_number})]: ${c.content.substring(0, 50)}...`);
  });

  if (chunks.length === 0 || !chunks[0].content) {
    throw new Error('Chunking failed to produce content');
  }

  const pageAwareChunks = chunkText('Page one content.\n\nPage two content.', 2, {
    chunkSize: 100,
    pages: [
      { page_number: 1, text: 'Page one content.' },
      { page_number: 2, text: 'Page two content.' },
    ],
  });
  if (pageAwareChunks.map(chunk => chunk.page_number).join(',') !== '1,2') {
    throw new Error('Page-aware chunking failed to preserve source page numbers');
  }

  console.log('--- 3. Testing Gemini Embedding Service Specs & Fallback ---');
  console.log(`Embedding Model: ${EMBEDDING_MODEL_NAME}`);
  console.log(`Embedding Dimensions: ${EMBEDDING_DIMENSIONS}`);
  console.log(`Semantic Enabled (has valid key): ${isSemanticEnabled()}`);

  if (EMBEDDING_DIMENSIONS !== 768) {
    throw new Error(`Expected EMBEDDING_DIMENSIONS to be 768, got ${EMBEDDING_DIMENSIONS}`);
  }
  if (EMBEDDING_MODEL_NAME !== 'gemini-embedding-001') {
    throw new Error(`Expected EMBEDDING_MODEL_NAME to be gemini-embedding-001, got ${EMBEDDING_MODEL_NAME}`);
  }

  console.log('\n✅ ALL BACKEND & HYBRID SEMANTIC UNIT TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
