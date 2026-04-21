import 'dotenv/config';

/**
 * 多供应商 LLM 客户端(OpenAI 兼容协议)
 *
 * 凭据优先级:
 *   1. 请求体中携带的 credentials(用户在页面填写,存在浏览器 localStorage)
 *   2. .env 环境变量(仅本地开发便利,生产部署不再依赖)
 */

const DEFAULTS = {
  zhipu: {
    name: '智谱 GLM',
    icon: '🌊',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    vision: false,
    capabilities: ['text'],
    recommended: true,
    tagline: '性价比最高的免费中文模型',
    pricing: { tier: 'free-unlimited', label: '永久免费无限', detail: 'glm-4-flash 完全免费 · 注册送 2500 万 token(付费模型)' },
    signupUrl: 'https://open.bigmodel.cn',
    signupSteps: [
      '打开 open.bigmodel.cn 注册账号',
      '右上角头像 →「API Keys」→ 创建新密钥',
      '复制 Key 粘贴到下方'
    ]
  },
  deepseek: {
    name: 'DeepSeek',
    icon: '🐋',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    vision: false,
    capabilities: ['text'],
    tagline: '代码/推理强,价格极低',
    pricing: { tier: 'paid-cheap', label: '¥0.14/M 输入 · ¥1.1/M 输出', detail: '业界最低价,新户送 10 元' },
    signupUrl: 'https://platform.deepseek.com',
    signupSteps: [
      '打开 platform.deepseek.com 注册',
      '左侧「API Keys」→ 创建',
      '复制 Key 粘贴到下方'
    ]
  },
  kimi: {
    name: 'Kimi (月之暗面)',
    icon: '🌙',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    vision: false,
    capabilities: ['text'],
    tagline: '中文长文本强,有免费额度',
    pricing: { tier: 'free-trial', label: '新户免费 15 元额度', detail: '对个人友好' },
    signupUrl: 'https://platform.moonshot.cn',
    signupSteps: [
      '打开 platform.moonshot.cn 注册',
      '「API Key 管理」→ 新建',
      '复制粘贴到下方'
    ]
  },
  qwen: {
    name: '通义千问',
    icon: '☁',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-vl-plus',
    vision: true,
    capabilities: ['text', 'vision'],
    tagline: '阿里云 · 支持识图',
    pricing: { tier: 'free-trial', label: '新户免费 100 万 token', detail: 'qwen-vl-plus 支持识图,适合反推图片' },
    signupUrl: 'https://bailian.console.aliyun.com',
    signupSteps: [
      '打开阿里云百炼 bailian.console.aliyun.com',
      '开通 DashScope → 创建 API Key',
      '复制粘贴到下方'
    ]
  },
  openai: {
    name: 'OpenAI',
    icon: '🅾',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    vision: true,
    capabilities: ['text', 'vision'],
    tagline: '最稳 · 但国内需代理',
    pricing: { tier: 'paid', label: 'gpt-4o-mini ¥0.15/M 输入', detail: '支持识图,英文生成顶级' },
    signupUrl: 'https://platform.openai.com',
    signupSteps: [
      '需要海外手机/信用卡',
      'platform.openai.com 创建 Key',
      '国内访问需在 baseUrl 填写 proxy 地址'
    ]
  },
  doubao: {
    name: '豆包 (字节方舟)',
    icon: '🥣',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-lite-32k',
    vision: false,
    capabilities: ['text'],
    tagline: '需要在方舟控制台单独激活模型 ID',
    warning: '⚠️ 方舟不是拿到 Key 就能用 · 需在 Console「在线推理」开通你要用的具体模型版本,然后把完整模型 ID(如 doubao-1-5-pro-32k-YYYYMMDD)填到下方 Model 字段',
    pricing: { tier: 'paid', label: '按 token 计费', detail: '国内推理快,中文好;但激活流程繁琐,新手不推荐' },
    signupUrl: 'https://console.volcengine.com/ark',
    signupSteps: [
      '打开 console.volcengine.com/ark',
      '「模型广场」找到豆包系列 → 点击「开通」',
      '「API Key 管理」创建 Key;回模型页面复制具体模型 ID(含日期后缀)填到下方'
    ]
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
