/**
 * 图像生成客户端:支持 Google Imagen / 火山方舟(即梦 Seedream)
 * 凭据由前端携带,服务端用完即弃
 *
 * 返回统一格式: { imageBase64: 'data:image/png;base64,...' } 或 { imageUrl }
 */

const DEFAULTS = {
  'jimeng': {
    name: '即梦 Seedream',
    icon: '🍜',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-seedream-3-0-t2i-250415',
    supportedRatios: ['1:1', '9:16', '16:9', '3:4', '4:3', '2:3', '3:2'],
    impl: 'volcengine',
    capabilities: ['t2i'],
    recommended: true,
    tagline: '国内首推 · 中文语义强 · Q版表情最佳',
    pricing: { tier: 'paid', label: '按张计费 · 约 ¥0.1-0.3/张', detail: '国内推理速度快,3 秒/张' },
    signupUrl: 'https://console.volcengine.com/ark',
    signupSteps: [
      '打开 console.volcengine.com/ark',
      '「模型广场」找到 doubao-seedream 系列 → 开通',
      '「API Key 管理」创建 Key,粘贴到下方'
    ],
    hint: '火山方舟 Ark 控制台申请 Key,需先开通 Seedream 文生图模型'
  },
  'google-imagen': {
    name: 'Google Imagen',
    icon: '🅶',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'imagen-3.0-generate-001',
    supportedRatios: ['1:1', '9:16', '16:9', '3:4', '4:3'],
    impl: 'google',
    capabilities: ['t2i'],
    tagline: '写实风强 · 国内需代理',
    pricing: { tier: 'paid', label: 'Imagen 付费 / Gemini 2.0 Flash 有免费层', detail: 'gemini-2.0-flash-preview-image-generation 可免费用' },
    signupUrl: 'https://aistudio.google.com/apikey',
    signupSteps: [
      'aistudio.google.com/apikey 登录 Google 账号',
      '「Create API Key」',
      '国内访问可能需要代理'
    ],
    hint: 'Google AI Studio 申请。Imagen 需付费层,可改用免费的 gemini-2.0-flash-preview-image-generation'
  }
};

export function supportedImageProviders() {
  return Object.entries(DEFAULTS).map(([id, def]) => ({ id, ...def }));
}

export function imageGenInfo() {
  return { supported: supportedImageProviders() };
}

/**
 * 统一图像生成入口
 * @param {{prompt, ratio, provider, credentials, refImage?}} opts
 * refImage: dataURL 或 https URL; 存在时走 i2i (图生图)
 */
export async function generateImage({ prompt, ratio = '1:1', provider, credentials, refImage = null }) {
  if (!prompt?.trim()) throw new Error('prompt 不能为空');
  const def = DEFAULTS[provider];
  if (!def) throw new Error(`未知图像生成模型: ${provider}`);
  if (!credentials?.apiKey?.trim()) {
    throw new Error(`请在「🔑 API 设置 → 🎨 图像生成」里填入 ${def.name} 的 API Key`);
  }

  const apiKey = credentials.apiKey.trim();
  let model = credentials.model?.trim() || def.model;

  // 如果是 i2i 且用户用的是 Seedream 的默认 t2i 模型,自动切到 SeedEdit i2i 模型
  if (refImage && def.impl === 'volcengine' && /seedream-3-0-t2i/.test(model)) {
    model = 'doubao-seededit-3-0-i2i-250628';
  }

  if (def.impl === 'google') {
    if (refImage) throw new Error('Google Imagen 暂不支持图生图,请用即梦 Seedream');
    return callGoogle(prompt, ratio, apiKey, model);
  }
  if (def.impl === 'volcengine') return callVolcengine(prompt, ratio, apiKey, model, credentials.baseUrl, refImage);
  throw new Error(`未实现的图像生成模型: ${provider}`);
}

/**
 * Google — Imagen(predict) 或 Gemini Image(generateContent)
 * 根据 model 名自动选择端点
 */
async function callGoogle(prompt, ratio, apiKey, model) {
  const isImagen = model.toLowerCase().includes('imagen');
  const url = isImagen
    ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`
    : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = isImagen
    ? {
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: ratio }
      }
    : {
        contents: [{ parts: [{ text: `Generate an image: ${prompt}\n\n(aspect ratio: ${ratio})` }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
      };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`[Google] ${res.status}: ${text.slice(0, 400)}`);
    const data = JSON.parse(text);

    if (isImagen) {
      const pred = data?.predictions?.[0];
      const b64 = pred?.bytesBase64Encoded;
      if (!b64) throw new Error('Google Imagen 返回无图像数据');
      return { imageBase64: `data:image/png;base64,${b64}`, model, provider: 'google-imagen' };
    }

    // Gemini image response
    const parts = data?.candidates?.[0]?.content?.parts || [];
    for (const p of parts) {
      const inline = p.inlineData || p.inline_data;
      if (inline?.data) {
        const mime = inline.mimeType || inline.mime_type || 'image/png';
        return { imageBase64: `data:${mime};base64,${inline.data}`, model, provider: 'google-imagen' };
      }
    }
    throw new Error('Gemini 返回无图像数据(可能当前模型不支持 IMAGE 输出)');
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 火山方舟(即梦/Seedream) — OpenAI 兼容 images/generations
 */
async function callVolcengine(prompt, ratio, apiKey, model, customBaseUrl, refImage = null) {
  const ratioToSize = {
    '1:1': '1024x1024',
    '9:16': '720x1280',
    '16:9': '1280x720',
    '3:4': '864x1152',
    '4:3': '1152x864',
    '2:3': '832x1248',
    '3:2': '1248x832',
    '21:9': '1512x648'
  };
  const size = ratioToSize[ratio] || '1024x1024';
  const baseUrl = (customBaseUrl || DEFAULTS['jimeng'].baseUrl).replace(/\/$/, '');
  const url = `${baseUrl}/images/generations`;

  const body = {
    model,
    prompt,
    size,
    response_format: 'b64_json',
    n: 1
  };
  // 图生图: 传参考图 (SeedEdit/Seedream i2i 支持)
  if (refImage) {
    body.image = refImage;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`[即梦] ${res.status}: ${text.slice(0, 400)}`);
    const data = JSON.parse(text);
    const item = data?.data?.[0];
    if (item?.b64_json) {
      return { imageBase64: `data:image/png;base64,${item.b64_json}`, model, provider: 'jimeng' };
    }
    if (item?.url) return { imageUrl: item.url, model, provider: 'jimeng' };
    throw new Error('即梦返回无图像数据');
  } finally {
    clearTimeout(timeout);
  }
}
