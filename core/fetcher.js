const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1';

export async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      },
      redirect: 'follow',
      signal: controller.signal
    });
    const html = await res.text();
    return { finalUrl: res.url, html, status: res.status };
  } finally {
    clearTimeout(timeout);
  }
}

export function parseMeta(html) {
  if (!html) return {};
  const pick = (re) => {
    const m = html.match(re);
    return m ? decodeEntities(m[1].trim()) : null;
  };
  const metaAll = (re) => {
    const out = [];
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = g.exec(html)) !== null) out.push(decodeEntities(m[1].trim()));
    return out;
  };

  return {
    title: pick(/<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']+)["']/i)
        || pick(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:title["']/i)
        || pick(/<title[^>]*>([^<]+)<\/title>/i),
    description: pick(/<meta[^>]+(?:property|name)=["']og:description["'][^>]+content=["']([^"']+)["']/i)
              || pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i),
    cover: pick(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i),
    author: pick(/<meta[^>]+(?:property|name)=["']og:(?:author|site_name)["'][^>]+content=["']([^"']+)["']/i)
         || pick(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i),
    keywords: pick(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i),
    tags: metaAll(/<meta[^>]+property=["']article:tag["'][^>]+content=["']([^"']+)["']/i)
  };
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}
