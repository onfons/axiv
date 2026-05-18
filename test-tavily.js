const TAVILY_API_KEY = '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';
async function tavilySearch(query) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: 'advanced',
      max_results: 8,
      include_raw_content: true,
    }),
  });
  if (!res.ok) throw new Error(`Tavily API error: ${res.status}`);
  const data = await res.json();
  const results = data.results || [];
  return results.map((r) => `[${r.title}]\n${r.content}`).join('\n\n');
}

tavilySearch('강남역 맛집').then(res => console.log('Tavily Success:', res.slice(0, 100))).catch(console.error);
