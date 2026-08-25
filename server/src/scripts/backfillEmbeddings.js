import { supabaseAdmin } from '../config/supabase.js';
import { generateBatchEmbeddings, isSemanticEnabled, EMBEDDING_MODEL_NAME } from '../services/embeddingService.js';

async function backfill() {
  console.log('================================================================');
  console.log('🚀 FILE NOT FOUND: Embedding Backfill Utility');
  console.log('================================================================');

  if (!isSemanticEnabled()) {
    console.error('❌ Error: GEMINI_API_KEY is not configured in server/.env.');
    console.error('   Please add GEMINI_API_KEY=your_key to server/.env and re-run.');
    process.exit(1);
  }

  console.log(`Using model: ${EMBEDDING_MODEL_NAME} (768 dimensions)`);
  console.log('Checking for un-embedded document chunks in Supabase...');

  // 1. Fetch chunks where embedding is NULL
  const { data: chunks, error } = await supabaseAdmin
    .from('document_chunks')
    .select('id, content, page_number, chunk_index, document_id')
    .is('embedding', null);

  if (error) {
    console.error('❌ Failed to fetch chunks:', error.message);
    if (error.message.includes('embedding')) {
      console.error('   Hint: Run the migration SQL in supabase/migrations/20260821_add_pgvector_and_hybrid_search.sql first.');
    }
    process.exit(1);
  }

  if (!chunks || chunks.length === 0) {
    console.log('✅ All document chunks already have vector embeddings! Nothing to backfill.');
    process.exit(0);
  }

  console.log(`Found ${chunks.length} chunks needing vector embeddings.`);
  console.log('Generating Gemini embeddings and updating database...');

  const BATCH_SIZE = 10;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const textList = batch.map(c => c.content);

    try {
      const embeddings = await generateBatchEmbeddings(textList);

      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const emb = embeddings[j];

        if (emb && Array.isArray(emb)) {
          const { error: updateError } = await supabaseAdmin
            .from('document_chunks')
            .update({ embedding: emb })
            .eq('id', chunk.id);

          if (!updateError) {
            successCount++;
          } else {
            console.warn(`Warning: Failed to update chunk ${chunk.id}:`, updateError.message);
            failCount++;
          }
        } else {
          failCount++;
        }
      }

      console.log(`Progress: ${Math.min(chunks.length, i + BATCH_SIZE)} / ${chunks.length} chunks processed (${successCount} successful)...`);
    } catch (batchErr) {
      console.error(`Batch error at index ${i}:`, batchErr.message);
    }
  }

  console.log('================================================================');
  console.log(`🎉 Backfill Complete!`);
  console.log(`   Successfully embedded: ${successCount} chunks`);
  if (failCount > 0) {
    console.log(`   Failed: ${failCount} chunks`);
  }
  console.log('================================================================');
}

backfill().catch(console.error);
