module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {
    const { system, messages } = req.body;
    const userMessage = messages?.[0]?.content || '';

    // ── Step 1: Small search-only request for a real article ──
    const searchRes = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Sanat, teknoloji veya felsefe üzerine güncel ve ilgi çekici bir makale bul. SADECE şu JSON formatında yanıt ver, başka hiçbir şey yazma: {"baslik":"makale başlığı","gercek_url":"tam URL"}' }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
      }),
    });

    const searchData = await searchRes.json();
    const searchText = searchData.candidates?.[0]?.content?.parts
      ?.filter(p => p.text)?.map(p => p.text)?.join('') || '';

    let articleInfo = { baslik: '', gercek_url: '' };
    try {
      const match = searchText.match(/\{[\s\S]*?\}/);
      if (match) articleInfo = JSON.parse(match[0]);
    } catch(e) {}

    console.log('article found:', articleInfo.baslik, articleInfo.gercek_url);

    // ── Step 2: Main content request — no web search ──
    const mainRes = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system || '' }] },
        contents: [{ role: 'user', parts: [{ text:
          `${userMessage}\n\nMakale için şunu kullan: başlık="${articleInfo.baslik}", url="${articleInfo.gercek_url}"`
        }] }],
        generationConfig: { temperature: 1, maxOutputTokens: 3000, responseMimeType: 'application/json' },
      }),
    });

    const mainData = await mainRes.json();
    console.log('main status:', mainRes.status);
    console.log('main finishReason:', mainData.candidates?.[0]?.finishReason);
    console.log('main error:', mainData.error?.message);

    const text = mainData.candidates?.[0]?.content?.parts
      ?.filter(p => p.text)?.map(p => p.text)?.join('') || '';

    return res.status(200).json({ content: [{ type: 'text', text }] });
  } catch (err) {
    console.log('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
