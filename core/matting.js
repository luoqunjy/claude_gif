/**
 * 抠图(去背景)多供应商路由
 *
 * 3 家:
 *   - replicate   · 851-labs/background-remover 或 bria-ai/rmbg-1.4(REST,推荐)
 *   - koukoutu    · 抠抠图官方 API(通用 POST,需用户贴 endpoint+key)
 *   - volcengine  · 火山视觉智能(SegmentImage) · 需 HMAC 签名,暂占位
 *
 * BYO-key · 服务端不持有
 */

const DEFAULTS = {
  replicate: {
    name: 'Replicate · Background Remover',
    icon: '🔁',
    baseUrl: 'https://api.replicate.com/v1',
    model: '851-labs/background-remover',
    impl: 'replicate',
    capabilities: ['remove-bg'],
    recommended: true,
    tagline: '发丝级 · 通用稳定 · 海外服务',
    pricing: { tier: 'paid-cheap', label: '约 $0.002/张', detail: '851-labs/background-remover · 每张 2 美分 · 注册送 $0.10' },
    signupUrl: 'https://replicate.com/account/api-tokens',
    signupSteps: [
      '打开 replicate.com 注册(GitHub 登录即可)',
      'Account → API Tokens → New token',
      '复制 r8_... 开头的 token 粘贴到下方'
    ]
  },
  koukoutu: {
    name: '抠抠图官方 API',
    icon: '📐',
    baseUrl: 'https://api.koukoutu.com',
    model: 'removebg-v3.8',
    impl: 'koukoutu',
    capabilities: ['remove-bg'],
    tagline: '自研 v3.8 plus · 复杂背景/镂空/透明物',
    pricing: { tier: 'paid', label: '按积分计费', detail: '网页端免费带水印下载;API 需购买积分包' },
    signupUrl: 'https://www.koukoutu.com/dev',
    signupSteps: [
      '打开 koukoutu.com 注册',
      '开发者中心 → 申请 API 密钥',
      '复制 Key 粘贴到下方(baseUrl 高级里可自定义)'
    ],
    warning: '抠抠图 API 接口格式可能更新,如调用失败请在高级里自定义 baseUrl'
  },
  volcengine: {
    name: '火山视觉 · 通用抠图',
    icon: '🌋',
    baseUrl: 'https://visual.volcengineapi.com',
    model: 'CVGetForeground',
    impl: 'volcengine',
    capabilities: ['remove-bg'],
    tagline: '国内低延迟(需 HMAC 签名)',
    pricing: { tier: 'paid-cheap', label: '国内推理低价', detail: '按调用计费;需额外 AK/SK' },
    signupUrl: 'https://console.volcengine.com/vision',
    signupSteps: [
      '打开 console.volcengine.com/vision 开通「通用抠图」',
      '右上角「API 访问密钥」获取 AccessKey + SecretKey',
      'AK 填 apiKey,SK 填 高级→Model(作为 secret)'
    ],
    warning: '⚠ 暂为占位接入 · 火山视觉需 HMAC-SHA256 签名,完整实现排 P2'
  }
};

export function supportedMattingProviders() {
  return Object.entries(DEFAULTS).map(([id, def]) => ({ id, ...def }));
}

export function mattingInfo() {
  return { supported: supportedMattingProviders() };
}

/**
 * 统一抠图入口
 * @param {{image, provider, credentials}} opts
 * image: dataURL 或 https URL
 * returns: { imageBase64 或 imageUrl, model, provider }
 */
export async function removeBackground({ image, provider, credentials }) {
  if (!image) throw new Error('image 不能为空');
  const def = DEFAULTS[provider];
  if (!def) throw new Error(`未知抠图服务: ${provider}`);
  if (!credentials?.apiKey?.trim()) {
    throw new Error(`请在「🔑 模型库 → ✂ 抠图」里填入 ${def.name} 的 API Key`);
  }

  if (def.impl === 'replicate') return callReplicate(image, credentials);
  if (def.impl === 'koukoutu') return callKoukoutu(image, credentials);
  if (def.impl === 'volcengine') throw new Error('火山视觉抠图实装中(P2),暂请用 Replicate');
  throw new Error(`未实现: ${provider}`);
}

// ============ Replicate (851-labs/background-remover) ============

async function callReplicate(image, credentials) {
  const apiKey = credentials.apiKey.trim();
  const modelSlug = (credentials.model || DEFAULTS.replicate.model).trim();

  // 1) Trigger with Prefer: wait (sync up to 60s)
  const url = `https://api.replicate.com/v1/models/${modelSlug}/predictions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait=60'
    },
    body: JSON.stringify({ input: { image } })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`[Replicate] ${res.status}: ${text.slice(0, 400)}`);
  let data; try { data = JSON.parse(text); } catch { throw new Error('Replicate 返回非 JSON'); }

  if (data.status === 'succeeded') {
    const out = Array.isArray(data.output) ? data.output[0] : data.output;
    if (typeof out === 'string') return { imageUrl: out, model: modelSlug, provider: 'replicate' };
    if (out?.image) return { imageUrl: out.image, model: modelSlug, provider: 'replicate' };
    throw new Error('Replicate 输出格式未识别: ' + JSON.stringify(out).slice(0, 200));
  }

  // Fall back to polling if wait didn't resolve
  if (data.id) {
    const polled = await pollReplicate(data.id, apiKey);
    return polled ? { imageUrl: polled, model: modelSlug, provider: 'replicate' } : (() => { throw new Error('Replicate 任务超时'); })();
  }
  throw new Error('Replicate 异常: ' + JSON.stringify(data).slice(0, 300));
}

async function pollReplicate(predictionId, apiKey) {
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const r = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { 'Authorization': `Token ${apiKey}` }
    });
    const d = await r.json();
    if (d.status === 'succeeded') {
      const out = Array.isArray(d.output) ? d.output[0] : d.output;
      return typeof out === 'string' ? out : out?.image;
    }
    if (d.status === 'failed' || d.status === 'canceled') {
      throw new Error(`Replicate ${d.status}: ${d.error || ''}`);
    }
  }
  return null;
}

// ============ 抠抠图(通用 POST,容错设计) ============

async function callKoukoutu(image, credentials) {
  const apiKey = credentials.apiKey.trim();
  const baseUrl = (credentials.baseUrl || 'https://api.koukoutu.com').replace(/\/$/, '');
  // 尝试 3 种常见端点形状,按首个成功返回
  const candidates = [
    { url: `${baseUrl}/v1/removebg`, body: { image } },
    { url: `${baseUrl}/removebg`, body: { image } },
    { url: `${baseUrl}/api/removebg`, body: { image_url: image } }
  ];
  let lastErr;
  for (const c of candidates) {
    try {
      const res = await fetch(c.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(c.body)
      });
      if (!res.ok) {
        lastErr = `${res.status} @ ${c.url}`;
        continue;
      }
      const data = await res.json();
      const out = data.image || data.result_image || data.output || data.data?.image_url;
      if (out) return { imageUrl: typeof out === 'string' && out.startsWith('http') ? out : undefined, imageBase64: typeof out === 'string' && out.startsWith('data:') ? out : undefined, model: 'removebg', provider: 'koukoutu' };
      lastErr = 'response without image field: ' + JSON.stringify(data).slice(0, 200);
    } catch (e) { lastErr = e.message; }
  }
  throw new Error(`[抠抠图] 所有端点尝试失败: ${lastErr} · 请在「高级设置」填入正确的 baseUrl`);
}
