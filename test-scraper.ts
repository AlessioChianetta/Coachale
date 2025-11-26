import { scrapeGoogleDoc, scrapeMultipleUrls, isGoogleDocsUrl } from './server/web-scraper.js';

async function testScraper() {
  console.log('🧪 Testing Google Docs scraper...\n');
  
  // Test 1: Valid Google Docs URL (public example document)
  const testDocUrl = 'https://docs.google.com/document/d/1FjTxmJKKk16LoGT2k9zELLkpKgX7YqT4Y9FQy7CjFQc/edit';
  console.log('Test 1: Valid Google Docs URL');
  console.log('URL:', testDocUrl);
  console.log('Is Google Docs URL:', isGoogleDocsUrl(testDocUrl));
  
  try {
    const result = await scrapeGoogleDoc(testDocUrl);
    console.log('\nResult:', {
      success: result.success,
      url: result.url,
      contentLength: result.content?.length || 0,
      error: result.error || 'none'
    });
    if (result.content) {
      console.log('First 200 chars:', result.content.substring(0, 200));
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
  
  // Test 2: Invalid URL (not Google Docs)
  console.log('\n\n---\nTest 2: Invalid URL (not Google Docs)');
  const invalidUrl = 'https://example.com/document';
  console.log('URL:', invalidUrl);
  console.log('Is Google Docs URL:', isGoogleDocsUrl(invalidUrl));
  
  const result2 = await scrapeGoogleDoc(invalidUrl);
  console.log('\nResult:', {
    success: result2.success,
    error: result2.error
  });
  
  // Test 3: Multiple URLs (mixed) - Testing positional alignment
  console.log('\n\n---\nTest 3: Multiple URLs (mixed Google Docs and non-Docs)');
  const mixedUrls = [
    'https://docs.google.com/document/d/1FjTxmJKKk16LoGT2k9zELLkpKgX7YqT4Y9FQy7CjFQc/edit',
    'https://example.com/test',
    'https://docs.google.com/document/d/invalid-id/edit'
  ];
  
  console.log('URLs:', mixedUrls);
  const results = await scrapeMultipleUrls(mixedUrls);
  console.log('\nResults count:', results.length, '(should match input count:', mixedUrls.length + ')');
  console.log('Positional alignment test:', results.length === mixedUrls.length ? '✅ PASS' : '❌ FAIL');
  
  results.forEach((result, idx) => {
    console.log(`\nResult ${idx + 1}:`, {
      success: result.success,
      url: result.url,
      contentLength: result.content?.length || 0,
      error: result.error || 'none'
    });
  });
  
  console.log('\n\n✅ Tests completed');
}

testScraper().catch(console.error);
