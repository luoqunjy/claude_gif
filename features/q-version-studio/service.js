import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chat, hasUsableCredentials, safeJsonParse } from '../../core/llm.js';
import { renderMidjourney } from './prompt-templates/midjourney.js';
import { renderJimeng } from './prompt-templates/jimeng.js';
import { renderNanoBanana } from './prompt-templates/nano-banana.js';
import { renderGptImage } from './prompt-templates/gpt-image.js';
import { renderSdFlux } from './prompt-templates/sd-flux.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const META_PROMPT = fs.readFileSync(path.join(__dirname, 'prompts', 'meta-prompt.txt'), 'utf-8');

export const SUPPORTED_MODELS = [
  { id: 'jimeng',       name: '即梦',         lang: 'zh', jumpTier: 'C', jumpUrl: 'https://jimeng.jianying.com/ai-tool/home/' },
  { id: 'nano-banana',  name: 'Nano Banana', lang: 'zh', jumpTier: 'B', jumpUrl: 'https://gemini.google.com/app' },
  { id: 'gpt-image',    name: 'GPT-Image',   lang: 'zh', jumpTier: 'A', jumpUrl: 'https://chatgpt.com/' },
  { id: 'midjourney',   name: 'Midjourney',  lang: 'en', jumpTier: 'C', jumpUrl: 'https://www.midjourney.com/imagine' },
  { id: 'sd-flux',      name: 'SD / Flux',   lang: 'en', jumpTier: 'C', jumpUrl: 'https://tensor.art/' }
];

const RENDERERS = {
  'jimeng':      renderJimeng,
  'nano-banana': renderNanoBanana,
  'gpt-image':   renderGptImage,
  'midjourney':  renderMidjourney,
  'sd-flux':     renderSdFlux
};

// ============ 读图拆解:两张图 → 6 维度 JSON ============

export async function extractDimensions({
  characterImage,
  characterText,
  styleImage,
  stylePresetText,
  provider,
  credentials
}) {
  if (!characterImage && !characterText?.trim()) {
    throw new Error('请上传角色立绘,或输入文字描述');
  }
  if (!styleImage && !stylePresetText?.trim()) {
    throw new Error('请上传 Q版 风格参考图,或选择一个预设风格');
  }
  if (!hasUsableCredentials(provider, credentials)) {
    throw new Error('请先在「API 设置」里配置一个支持 vision 的 LLM(通义千问 / OpenAI)');
  }

  // 构造用户消息:说清两张图/文字的角色定位
  const parts = [];
  const images = [];

  if (characterImage) {
    parts.push('图 1(角色图):此图仅用于提取【身份层】—— 发型、服装、配饰、姿势、手持道具。绝对不要参考它的比例/画风/色彩。');
    images.push(characterImage);
  }
  if (characterText?.trim()) {
    parts.push(`角色补充文字:${characterText.trim()}`);
  }

  if (styleImage) {
    parts.push(`图 ${images.length + 1}(风格图):此图仅用于提取【风格层】—— 头身比、脸型、眼睛、线条、色块、派系。绝对不要参考它的身份/服装/配饰。`);
    images.push(styleImage);
  } else if (stylePresetText?.trim()) {
    parts.push(`风格描述(用此确定风格层):${stylePresetText.trim()}`);
  }

  parts.push('\n请按 meta-prompt 格式严格输出 JSON。');

  const raw = await chat({
    system: META_PROMPT,
    user: parts.join('\n\n'),
    images,
    json: true,
    temperature: 0.4,
    provider,
    credentials
  });
  const parsed = safeJsonParse(raw);
  if (!parsed) return { error: 'llm_parse_failed', raw };
  return parsed;
}

// ============ 渲染模板:6 维度 + 目标模型 → prompt ============

export async function renderPrompt({ dimensions, targetModel, extras = {} }) {
  if (!dimensions) throw new Error('缺少 dimensions 数据');
  if (!targetModel || !RENDERERS[targetModel]) {
    throw new Error(`不支持的目标模型:${targetModel}`);
  }
  const prompt = RENDERERS[targetModel](dimensions, extras);
  const meta = SUPPORTED_MODELS.find(m => m.id === targetModel);
  return { prompt, model: meta };
}

// ============ 一键模式:一次调用返回全部 ============

export async function oneShot(body) {
  const dimensions = await extractDimensions(body);
  if (dimensions.error) return dimensions;

  const targets = body.targetModels?.length
    ? body.targetModels
    : SUPPORTED_MODELS.map(m => m.id);

  const prompts = {};
  for (const modelId of targets) {
    if (!RENDERERS[modelId]) continue;
    const meta = SUPPORTED_MODELS.find(m => m.id === modelId);
    prompts[modelId] = {
      model: meta,
      prompt: RENDERERS[modelId](dimensions, body.extras || {})
    };
  }

  return { dimensions, prompts };
}

// ============ 风格库反向提取(M3.5)============
// 输入一张 Q版 图,输出可存储为私有预设的 qStylePack

const STYLE_EXTRACT_SYSTEM = `你是 Q版 风格分析师。用户会上传一张 Q版 参考图,请你【只提取风格,不提取身份】,输出可复用的风格包 JSON。

严格输出:
{
  "name": "建议的预设名,20字内,用户可改",
  "silhouette_type": "human | anthropomorphic | mascot | object",
  "style": {
    "family": { "zh": "..." , "en": "..." },
    "descriptor": { "zh": "一句话视觉魂", "en": "..." }
  },
  "proportion": {
    "head_body_ratio": "2 | 2.5 | 3",
    "head_ratio_of_total_percent": 45,
    "body_notes": { "zh": "...", "en": "..." }
  },
  "face_drawing": {
    "face_shape": { "zh": "...", "en": "..." },
    "eye_style": { "zh": "...", "en": "..." },
    "blush": { "zh": "...", "en": "..." },
    "nose_mouth": { "zh": "...", "en": "..." }
  },
  "line_and_color": {
    "line": { "zh": "...", "en": "..." },
    "coloring": { "zh": "...", "en": "..." },
    "shadow": { "zh": "...", "en": "..." },
    "palette_mood": { "zh": "...", "en": "..." }
  }
}

绝对不要输出 identity、outfit、accessories、pose 相关字段 —— 只看风格,不看角色。
只输出 JSON,无任何前后文字。`;

export async function extractStyle({ image, provider, credentials }) {
  if (!image) throw new Error('请上传 Q版 参考图');
  if (!hasUsableCredentials(provider, credentials)) {
    throw new Error('请先配置支持 vision 的 LLM API Key');
  }

  const raw = await chat({
    system: STYLE_EXTRACT_SYSTEM,
    user: '请分析这张 Q版 图,只提取可复用的风格要素,输出 qStylePack JSON。',
    images: [image],
    json: true,
    temperature: 0.4,
    provider,
    credentials
  });
  const parsed = safeJsonParse(raw);
  if (!parsed) return { error: 'llm_parse_failed', raw };
  return parsed;
}
