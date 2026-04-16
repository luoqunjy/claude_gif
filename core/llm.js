import 'dotenv/config';

/**
 * 多供应商 LLM 客户端(OpenAI 兼容协议)
 * .env 中同时配置多个供应商的 API Key,已配置的自动注册为可用
 * 前端每次请求可指定 provider 字段;未指定则用 LLM_ACTIVE 默认
 */

const DEFAULTS = {
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    vision: false
  },
  kimi: {
    name: 'Kimi (月之暗面)',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    vision: false
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    vision: true
  },
  qwen: {
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-vl-plus',
    vision: true
  }
};

const providers = {};

for (const [id, def] of Object.entries(DEFAULTS)) {
  const upper = id.toUpperCase();
  const apiKey = process.env[`LLM_${upper}_API_KEY`];
  if (apiKey && apiKey.trim()) {
    providers[id] = {
      id,
      name: def.name,
      apiKey: apiKey.trim(),
      baseUrl: (process.env[`LLM_${upper}_BASE_URL`] || def.baseUrl).replace(/\/$/, ''),
      model: process.env[`LLM_${upper}_MODEL`] || def.model,
      vision: def.vision
    };
  }
}

// 向后兼容:旧的 LLM_API_KEY 风格
if (process.env.LLM_API_KEY?.trim() && !Object.keys(providers).length) {
  providers.custom = {
    id: 'custom',
    name: 'Custom',
    apiKey: process.env.LLM_API_KEY.trim(),
    baseUrl: (process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/$/, ''),
    model: process.env.LLM_MODEL || 'deepseek-chat',
    vision: false
  };
}

const envActive = process.env.LLM_ACTIVE;
const defaultActive = (envActive && providers[envActive]) ? envActive : (Object.keys(providers)[0] || null);

export function listProviders() {
  return Object.values(providers).map(({ apiKey, ...rest }) => rest);
}

export function llmAvailable(providerId) {
  const id = providerId || defaultActive;
  return Boolean(id && providers[id]);
}

export function llmInfo() {
  return {
    active: defaultActive,
    available: llmAvailable(),
    providers: listProviders()
  };
}

function resolveProvider(providerId) {
  const id = providerId || defaultActive;
  if (!id || !providers[id]) {
    throw new Error(`LLM 供应商 "${id || '(未指定)'}" 不可用,请检查 .env 配置`);
  }
  return providers[id];
}

export async function chat({ system, user, images = [], json = true, temperature = 0.7, provider }) {
  const p = resolveProvider(provider);

  const validImages = (images || []).filter(Boolean);
  let userContent;
  if (validImages.length > 0) {
    if (!p.vision) {
      userContent = `${user}\n\n[注:当前模型 ${p.model} 不支持识图,图片已忽略。如需图像分析请切换到支持 Vision 的模型,例如 OpenAI / 通义千问]`;
    } else {
      userContent = [
        { type: 'text', text: user },
        ...validImages.map(img => ({ type: 'image_url', image_url: { url: img } }))
      ];
    }
  } else {
    userContent = user;
  }

  const body = {
    model: p.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent }
    ],
    temperature
  };
  if (json) body.response_format = { type: 'json_object' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${p.apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`[${p.name}] ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = JSON.parse(text);
    return data?.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}

export function safeJsonParse(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch {}
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}
