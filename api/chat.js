module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { system, messages } = req.body;
    const userMessage = messages?.[0]?.content || '';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system || '' }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 1, maxOutputTokens: 4000 },
        }),
      }
    );

    const data = await response.json();
    console.log('status:', response.status);
    console.log('finishReason:', data.candidates?.[0]?.finishReason);

    // Web search tool causes multi-turn: collect all candidate contents
    const allParts = [];
    for (const candidate of (data.candidates || [])) {
      for (const part of (candidate.content?.parts || [])) {
        if (part.text) allParts.push(part.text);
      }
    }

    // Also check if there's a second turn (search results + final answer)
    const text = allParts.join('');
    console.log('text length:', text.length);
    console.log('text preview:', text.slice(0, 200));

    return res.status(200).json({ content: [{ type: 'text', text }] });
  } catch (err) {
    console.log('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
