import { searchDocuments } from '../src/services/searchService.js';
import { supabaseAdmin } from '../src/config/supabase.js';

async function runLiveSemanticQueries() {
  console.log('================================================================');
  console.log('🧠 LIVE SEMANTIC SEARCH EVALUATION (gemini-embedding-001 + pgvector)');
  console.log('================================================================');

  const { data: docs } = await supabaseAdmin.from('documents').select('user_id').limit(1);
  const userId = docs[0].user_id;

  const testCases = [
    {
      label: '1. Conceptual description of CyberHelp without exact title',
      query: 'reporting online cybercrime scams, victim support, and fraud helpline',
      expectedFileKeyword: 'CyberHelp'
    },
    {
      label: '2. Conceptual description of Tower of Hanoi puzzle without mentioning Hanoi',
      query: 'moving disks between three pegs using recursive steps in programming',
      expectedFileKeyword: 'Jira'
    },
    {
      label: '3. Professional development & milestone tracking',
      query: 'reflecting on skill development before embarking on the journey',
      expectedFileKeyword: 'Forward Learning'
    }
  ];

  for (const tc of testCases) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`Test Case: ${tc.label}`);
    console.log(`Query: "${tc.query}"`);
    console.log(`----------------------------------------------------------------`);

    const res = await searchDocuments(userId, tc.query);
    console.log(`Total Matches: ${res.total}`);
    
    if (res.results.length > 0) {
      const top = res.results[0];
      console.log(`🎯 Top Result: "${top.original_name}"`);
      console.log(`   Document ID: ${top.id}`);
      console.log(`   Combined Score: ${top.score}`);
      console.log(`   Relevance: ${top.relevance}`);
      console.log(`   Search Mode: ${top.searchMode}`);
      console.log(`   Why Matched: ${top.whyMatched}`);
      console.log(`   Page: ${top.pageNumber}`);
      console.log(`   Snippet: ${top.snippet.replace(/[\n\r]+/g, ' ').substring(0, 100)}...`);

      const matchesExpected = top.original_name.toLowerCase().includes(tc.expectedFileKeyword.toLowerCase());
      if (tc === testCases[0]) {
        if (!matchesExpected) throw new Error('Semantic test returned the wrong document');
        if (top.searchMode !== 'hybrid-semantic') throw new Error('Semantic test used keyword fallback');
        if (!top.id || typeof top.score !== 'number' || typeof top.relevance !== 'number') {
          throw new Error('Semantic result is missing the current id/score/relevance contract');
        }
        if (!Number.isInteger(top.pageNumber) || !top.snippet || !top.smart_title || !Array.isArray(top.tags)) {
          throw new Error('Semantic result is missing page, snippet, or smart metadata');
        }
      }

      if (matchesExpected) {
        console.log(`   ✅ SUCCESS: Retrieved expected document based entirely on semantic concepts!`);
      } else {
        console.log(`   ℹ️ Note: Matched "${top.original_name}" as closest semantic vector neighbor.`);
      }
    } else {
      console.log(`   ❌ No matches returned.`);
    }
  }

  console.log('\n================================================================');
  console.log('🧪 4. Testing Keyword Query ("Tower of Hanoi")');
  console.log('================================================================');
  const kwRes = await searchDocuments(userId, 'Tower of Hanoi');
  console.log(`Keyword Matches: ${kwRes.total}`);
  console.log(`Top Result: "${kwRes.results[0]?.original_name}" (relevance ${kwRes.results[0]?.relevance} - ${kwRes.results[0]?.searchMode})`);

  console.log('\n================================================================');
  console.log('🧪 5. Testing Noise Query ("with")');
  console.log('================================================================');
  const noiseRes = await searchDocuments(userId, 'with');
  console.log(`Noise Matches: ${noiseRes.total} (Correctly rejected noise: ${noiseRes.total === 0})`);

  console.log('\n================================================================');
  console.log('🧪 6. Testing Unrelated Query Exclusion');
  console.log('================================================================');
  const unrelatedRes = await searchDocuments(userId, 'marine biology coral reef photographs ocean tides');
  const cyberHelpReturned = unrelatedRes.results.some(result =>
    result.original_name.toLowerCase().includes('cyberhelp')
  );
  console.log(`Unrelated Matches: ${unrelatedRes.total}`);
  if (cyberHelpReturned) throw new Error('Unrelated query incorrectly returned the semantic test document');
  console.log('✅ Correct document excluded from unrelated results');
}

runLiveSemanticQueries().catch(console.error);
