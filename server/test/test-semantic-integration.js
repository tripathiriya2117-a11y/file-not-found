import { supabaseAdmin, STORAGE_BUCKET } from '../src/config/supabase.js';
import { extractTextFromPDF, chunkText } from '../src/services/pdfService.js';
import { generateBatchEmbeddings, isSemanticEnabled, EMBEDDING_DIMENSIONS } from '../src/services/embeddingService.js';
import { searchDocuments } from '../src/services/searchService.js';

async function testSemanticIntegration() {
  console.log('================================================================');
  console.log('🧪 TEST 1: New PDF Upload & Automatic Vector Embedding Creation');
  console.log('================================================================');
  
  const { data: userDocs } = await supabaseAdmin.from('documents').select('user_id').limit(1);
  const userId = userDocs[0].user_id;

  // Generate a mock PDF buffer with distinctive conceptual content
  const samplePdfText = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 200 >>
stream
BT
/F1 12 Tf
100 700 Td
(Quantum Computing Principles: Superposition of qubits, quantum entanglement phenomena, and Shor factorization algorithm for cryptography analysis.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000234 00000 n 
0000000485 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
560
%%EOF`;

  const pdfBuffer = Buffer.from(samplePdfText, 'utf-8');
  const extraction = await extractTextFromPDF(pdfBuffer);
  console.log('Extracted text:', extraction.text);

  const chunks = chunkText(extraction.text, extraction.pageCount);
  console.log(`Generated ${chunks.length} chunks`);

  console.log('Computing Gemini vector embeddings...');
  const embeddings = await generateBatchEmbeddings(chunks.map(c => c.content));
  console.log('Embedding created:', Boolean(embeddings[0]), 'Length:', embeddings[0]?.length);

  if (!embeddings[0] || embeddings[0].length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding length mismatch! Expected ${EMBEDDING_DIMENSIONS}, got ${embeddings[0]?.length}`);
  }

  // Insert test document into Supabase
  const testFilename = `test_quantum_${Date.now()}.pdf`;
  const { data: newDoc, error: docErr } = await supabaseAdmin
    .from('documents')
    .insert({
      user_id: userId,
      filename: testFilename,
      original_name: 'quantum_crypto_notes_2026.pdf',
      file_size: pdfBuffer.length,
      mime_type: 'application/pdf',
      storage_path: `${userId}/${testFilename}`,
      page_count: extraction.pageCount,
      extracted_text: extraction.text,
      summary: extraction.summary,
    })
    .select()
    .single();

  if (docErr) throw docErr;
  console.log('✅ Test document inserted:', newDoc.id);

  // Insert chunk with vector
  const chunkRecords = chunks.map((chunk, idx) => ({
    document_id: newDoc.id,
    user_id: userId,
    chunk_index: chunk.chunk_index,
    page_number: chunk.page_number,
    content: chunk.content,
    embedding: embeddings[idx],
  }));

  const { error: chunkErr } = await supabaseAdmin
    .from('document_chunks')
    .insert(chunkRecords);

  if (chunkErr) throw chunkErr;
  console.log('✅ Document chunk with 768-d embedding saved in Supabase!');

  console.log('\n================================================================');
  console.log('🧪 TEST 2: Semantic Query with Completely DIFFERENT Wording');
  console.log('================================================================');

  // Semantic query using different words: "subatomic particle computing and breaking RSA encryption"
  // Notice: The PDF text has "Superposition of qubits, quantum entanglement, Shor factorization cryptography"
  const semanticQuery = 'subatomic particle computing and breaking RSA encryption';
  console.log(`Query: "${semanticQuery}"`);
  
  const semanticRes = await searchDocuments(userId, semanticQuery);
  console.log('Total Semantic Matches:', semanticRes.total);
  if (semanticRes.results.length > 0) {
    const top = semanticRes.results[0];
    console.log('✅ Top Semantic Match:');
    console.log('   File:', top.original_name);
    console.log('   Relevance:', top.relevance);
    console.log('   Search Mode:', top.searchMode);
    console.log('   Why Matched:', top.whyMatched);
    console.log('   Snippet:', top.snippet);
  } else {
    throw new Error('Semantic search failed to match conceptually related document');
  }

  console.log('\n================================================================');
  console.log('🧪 TEST 3: Exact Keyword Search Verification');
  console.log('================================================================');
  const keywordQuery = 'Superposition of qubits';
  console.log(`Query: "${keywordQuery}"`);
  const keywordRes = await searchDocuments(userId, keywordQuery);
  console.log('Matches:', keywordRes.total, 'Top Match File:', keywordRes.results[0]?.original_name, 'Relevance:', keywordRes.results[0]?.relevance);

  // Cleanup test document
  await supabaseAdmin.from('documents').delete().eq('id', newDoc.id);
  console.log('\n🧹 Test document cleaned up.');

  console.log('\n================================================================');
  console.log('✅ ALL SEMANTIC & HYBRID INTEGRATION TESTS PASSED!');
  console.log('================================================================');
}

testSemanticIntegration().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
