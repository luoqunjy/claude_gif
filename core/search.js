/**
 * 图片搜索客户端(目前支持 Serper,未来可扩展 Brave/Bing)
 * 凭据由请求体携带,不依赖服务端存储
 */

const PROVIDERS = {
  serper: {
    name: 'Serper (Google Images)',
    baseUrl: 'https://google.serper.dev/images',
    signupUrl: 'https://serper.dev',
    freeTier: '2500 次终身免费'
  }
};

export function supportedSearchProviders() {
  return Object.entries(PROVIDERS).map(([id, def]) => ({ id, ...def }));
}

export async function searchImages({ query, credentials, num = 12, gl = 'cn', hl = 'zh-cn' }) {
  if (!query?.trim()) throw new Error('搜索关键词不能为空');
  const providerId = credentials?.provider || 'serper';
  const def = PROVIDERS[providerId];
  if (!def) throw new Error(`不支持的搜索服务: ${providerId}`);
  if (!credentials?.apiKey?.trim()) {
    throw new Error(`请先在「🔑 API 设置 → 🌐 搜索服务」里填入 ${def.name} 的 API Key`);
  }

  if (providerId === 'serper') {
    return await searchSerper(query.trim(), credentials.apiKey.trim(), num, gl, hl);
  }
  throw new Error(`暂未实现: ${providerId}`);
}

async function searchSerper(query, apiKey, num, gl, hl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch('https://google.serper.dev/images', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: query, num, gl, hl }),
      signal: controller.signal
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`[Serper] ${res.status}: ${text.slice(0, 300)}`);
    const data = JSON.parse(text);
    const results = (data.images || []).slice(0, num).map(it => ({
      title: it.title || '',
      imageUrl: it.imageUrl || it.imageSrc,
      thumbnail: it.thumbnailUrl || it.imageUrl,
      sourceUrl: it.link || it.domain,
      source: it.source || it.domain || ''
    })).filter(r => r.imageUrl);
    return { provider: 'serper', query, results };
  } finally {
    clearTimeout(timeout);
  }
}
