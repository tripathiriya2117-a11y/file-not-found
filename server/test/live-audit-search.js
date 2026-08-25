import { searchDocuments } from '../src/services/searchService.js';
import { supabaseAdmin } from '../src/config/supabase.js';

async function runLiveAudit() {
  const { data: docs } = await supabaseAdmin.from('documents').select('user_id').limit(1);
  if (!docs || !docs.length) {
    console.log('No user found in documents');
    return;
  }
  const userId = docs[0].user_id;

  const queries = [
    'with',
    'Java servlet lifecycle',
    'Java Chapter 1 notes',
    'internship eligibility',
    'Tower of Hanoi',
    'Cyber Safety Helpdesk',
    'Forward Learning Workbook'
  ];

  for (const q of queries) {
    console.log('================================================================');
    console.log(`🔍 QUERY: "${q}"`);
    console.log('================================================================');
    const res = await searchDocuments(userId, q);
    console.log('Parsed Terms:', JSON.stringify(res.parsedTerms));
    console.log('Total Matches:', res.total);
    if (res.results.length === 0) {
      console.log('  -> 0 matches returned (Weak/noise results rejected cleanly).');
    } else {
      res.results.slice(0, 3).forEach((r, idx) => {
        console.log(`  [${idx + 1}] "${r.original_name}"`);
        console.log(`      Relevance: ${r.relevance}`);
        console.log(`      Page: ${r.pageNumber}`);
        console.log(`      Why Matched: ${r.whyMatched}`);
        console.log(`      Snippet: ${r.snippet.replace(/[\n\r]+/g, ' ').substring(0, 90)}...`);
      });
    }
    console.log('');
  }
}

runLiveAudit().catch(console.error);
