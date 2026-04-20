import 'dotenv/config';

/**
 * 多供应商 LLM 客户端(OpenAI 兼容协议)
 *
 * 凭据优先级:
 *   1. 请求体中携带的 credentials(用户在页面填写,存在浏览器 localStorage)
 *   2. .env 环境变量(仅本地开发便利,生产部署不再依赖)
 */

const DEFAULTS = {
  kimi: {
    name: 'Kimi (月之暗面)',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    vision: false,
    signupUrl: 'https://platform.moonshot.cn'
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    vision: false,
    signupUrl: 'https://platform.deepseek.com'
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    vision: true,
    signupUrl: 'https://platform.openai.com'
  },
  qwen: {
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-vl-plus',
    vision: true,
    signupUrl: 'https://bailian.console.aliyun.com'
  },
  zhipu: {
    name: '智谱 GLM (Flash 免费)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    vision: false,
    signupUrl: 'https://open.bigmodel.cn'
  },
  doubao: {
    name: '豆包 (字节方舟)',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-1-5-pro-32k-250115',
    vision: false,
    signupUrl: 'https://console.volcengine.com/ark'
  }
};

// .env 兜底凭据(仅本地开发用,生产通常为空)
const envProviders = {};
for (const [id, def] of Object.entries(DEFAULTS)) {
  const upper = id.toUpperCase();
  const apiKey = process.env[`LLM_${upper}_API_KEY`];
  if (apiKey?.trim()) {
    envProviders[id] = {
      id,
      name: def.name,
      apiKey: apiKey.trim(),
      baseUrl: (process.env[`LLM_${upper}_BASE_URL`] || def.baseUrl).replace(/\/$/, ''),
      model: process.env[`LLM_${upper}_MODEL`] || def.model,
      vision: def.vision
    };
  }
}

export function supportedProviders() {
  return Object.entries(DEFAULTS).map(([id, def]) => ({ id, ...def }));
}

export function llmInfo() {
  // 不再暴露任何 apiKey 相关信息,仅告知可选供应商
  return {
    mode: 'byo-key',
    supported: supportedProviders()
  };
}

/**
 * 解析最终用于请求的凭据
 * @param {string} providerId
 * @param {{apiKey?, baseUrl?, model?}} credentials 来自请求体
 */
function resolveProvider(providerId, credentials) {
  const def = DEFAULTS[providerId];
  if (!def && !credentials?.apiKey) {
    throw new Error(`未知供应商 "${providerId}"`);
  }

  // 请求体凭据优先
  if (credentials?.apiKey?.trim()) {
    return {
      id: providerId,
      name: def?.name || providerId,
      apiKey: credentials.apiKey.trim(),
      baseUrl: (credentials.baseUrl?.trim() || def?.baseUrl || '').replace(/\/$/, ''),
      model: credentials.model?.trim() || def?.model,
      vision: def?.vision || false
    };
  }

  // 本地开发: .env 兜底
  if (envProviders[providerId]) return envProviders[providerId];

  throw new Error(`请先在左下角「API 设置」里填入 ${def?.name || providerId} 的 API Key`);
}

export function hasUsableCredentials(providerId, credentials) {
  if (credentials?.apiKey?.trim()) return true;
  return Boolean(envProviders[providerId]);
}

export async function chat({ system, user, images = [], json = true, temperature = 0.7, provider, credentials }) {
  const p = resolveProvider(provider, credentials);

  const validImages = (images || []).filter(Boolean);
  let userContent;
  if (validImages.length > 0) {
    if (!p.vision) {
      userContent = `${user}\n\n[注:当前模型 ${p.model} 不支持识图,图片已忽略。如需图像分析请切换到 OpenAI / 通义千问]`;
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
  const timeout = setTimeout(() => controller.abort(), 55000);
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
