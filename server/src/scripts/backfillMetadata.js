import { supabaseAdmin } from '../config/supabase.js';
import { generateSmartMetadata } from '../services/metadataService.js';

async function backfillMetadata() {
  console.log('================================================================');
  console.log('✨ FILE NOT FOUND: AI Smart Metadata Backfill');
  console.log('================================================================');

  // Fetch documents missing smart_title
  const { data: docs, error } = await supabaseAdmin
    .from('documents')
    .select('id, original_name, extracted_text, summary, smart_title, tags')
    .or('smart_title.is.null,smart_title.eq.""');

  if (error) {
    console.error('❌ Failed to fetch documents:', error.message);
    if (error.message.includes('smart_title')) {
      console.error('   Hint: Run the migration SQL in supabase/migrations/20260821_add_smart_metadata.sql in Supabase first.');
    }
    process.exit(1);
  }

  if (!docs || docs.length === 0) {
    console.log('✅ All documents already have AI Smart Metadata! Nothing to backfill.');
    process.exit(0);
  }

  console.log(`Found ${docs.length} documents needing AI Smart Metadata...`);

  let updatedCount = 0;
  for (const doc of docs) {
    console.log(`Processing: "${doc.original_name}"...`);
    try {
      const smartMeta = await generateSmartMetadata(doc.extracted_text, doc.original_name, doc.summary);
      console.log(`  -> Smart Title: "${smartMeta.smart_title}"`);
      console.log(`  -> Summary: "${smartMeta.summary}"`);
      console.log(`  -> Tags: [${smartMeta.tags.join(', ')}]`);

      const { error: updateError } = await supabaseAdmin
        .from('documents')
        .update({
          smart_title: smartMeta.smart_title,
          summary: smartMeta.summary,
          tags: smartMeta.tags,
        })
        .eq('id', doc.id);

      if (updateError) {
        console.warn(`  ⚠️ Failed to update doc ${doc.id}:`, updateError.message);
      } else {
        updatedCount++;
      }

      // Small pause to be gentle on rate limits
      await new Promise(r => setTimeout(r, 250));
    } catch (err) {
      console.error(`  ❌ Error processing "${doc.original_name}":`, err.message);
    }
  }

  console.log('================================================================');
  console.log(`🎉 Backfill Complete! Updated ${updatedCount} of ${docs.length} documents.`);
  console.log('================================================================');
}

backfillMetadata().catch(console.error);
