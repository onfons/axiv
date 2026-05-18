const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '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';
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = 'google/gemma-4-31b-it'; // wait, maybe this model is not valid?

async function callAI(prompt) {
  const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 100,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI API error: ${res.status} ${txt}`);
  }
  const data = await res.json();
  console.log(data.choices?.[0]?.message?.content);
}

callAI('hello').catch(console.error);
