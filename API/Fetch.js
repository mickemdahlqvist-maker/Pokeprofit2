export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const dbaUrl = req.query.url;
  if (!dbaUrl) {
    return res.status(400).json({ error: "Mangler ?url=https://www.dba.dk/123" });
  }

  const match = dbaUrl.match(/(\d{6,})/);
  if (!match) {
    return res.status(400).json({ error: "Kunne ikke finde ID i DBA link" });
  }
  const dbaId = match[1];

  try {
    // Prøv at hente DBA siden direkte - Vercel bliver ikke blokeret som browser gør
    const response = await fetch(`https://www.dba.dk/${dbaId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'da-DK,da;q=0.9'
      }
    });

    const html = await response.text();

    // Find title
    let title = "";
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) title = titleMatch[1].split('|')[0].trim();

    // Find price via JSON-LD
    let price = "";
    let priceRaw = 0;
    const priceMatch = html.match(/"price"\s*:\s*"?(\d+)"?/);
    if (priceMatch) {
      priceRaw = parseInt(priceMatch[1]);
      price = priceRaw + " kr";
    }

    // Find beskrivelse
    let description = "";
    const descMatch = html.match(/<meta name="description" content="([^"]+)"/i);
    if (descMatch) description = descMatch[1].substring(0, 2000);

    // Find alle billeder - DBA cdn
    const images = [];
    const imgRegex = /https:\/\/[^"']+dba[^"']+\.(jpg|jpeg|png|webp)/gi;
    let m;
    while ((m = imgRegex.exec(html)) !== null) {
      if (!images.includes(m[0]) && !m[0].includes('logo') && !m[0].includes('icon')) {
        images.push(m[0]);
      }
      if (images.length >= 12) break;
    }

    // Fallback: find alle img src
    if (images.length === 0) {
      const srcRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
      while ((m = srcRegex.exec(html)) !== null) {
        const src = m[1];
        if (src.startsWith('http') && src.includes('cdn') && !src.includes('logo')) {
          if (!images.includes(src)) images.push(src);
        }
        if (images.length >= 12) break;
      }
    }

    return res.status(200).json({
      success: true,
      title: title || `DBA annonce ${dbaId}`,
      price: price || "Se annonce",
      price_raw: priceRaw,
      description: description,
      images: images,
      url: dbaUrl,
      id: dbaId
    });

  } catch (e) {
    return res.status(500).json({
      success: false,
      error: e.message,
      url: dbaUrl
    });
  }
}
