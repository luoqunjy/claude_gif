import { chat, hasUsableCredentials, safeJsonParse } from '../../core/llm.js';
import { searchImages } from '../../core/search.js';
import { generateImage } from '../../core/image-gen.js';

// ============ 主题→封面提示词扩展 ============
const PROMPT_SYSTEM = (platform, style, ratio) => `你是资深小红书/抖音/公众号封面设计师。任务:把用户一句话想法扩写为可直接喂给 AI 绘图模型(如 Imagen/Seedream)的高质量提示词。

场景约束:
- 目标平台: ${platform}
- 画面比例: ${ratio}
- 视觉风格: ${style}

严格输出 JSON:
{
  "titleOnCover": "建议放在封面上的主标题文字(5-12字,朗朗上口,有钩子感)",
  "subtitle": "可选副标题/下划线/徽章文字(短句,可留空)",
  "zhPrompt": "中文提示词,详细描述画面:主体/构图/光线/配色/氛围/风格/文字位置,一段通顺连贯的话,不含 JSON 结构",
  "enPrompt": "对应英文 AI 绘图提示词,Midjourney/Imagen/Seedream 都能用,逗号分隔关键 tokens,包含 style/subject/composition/lighting/color/mood/typography 维度",
  "reasoning": "为什么这样设计(一句话,例如:'平台用户偏爱xxx',或'该主题配色避免xxx')"
}

要求:
- 中文字符不要直接出现在 enPrompt 里
- zhPrompt 尽量完整(80-200字)
- 提示词中明确要求画面里包含 titleOnCover 的文字(中文字体清晰、字号占封面主视觉)
- 如果是小红书封面,加强"大字报/图文并茂/视觉抓眼"的特质
- 不要写"尺寸 1080x1350"这种,尺寸由 API 的 aspectRatio 参数控制`;

export async function expandPrompt({ idea, platform = '小红书', style = '简约清新', ratio = '3:4', provider, credentials }) {
  if (!idea?.trim()) throw new Error('请输入你的想法或主题');
  if (!hasUsableCredentials(provider, credentials)) throw new Error('请先配置 LLM API Key');

  const raw = await chat({
    system: PROMPT_SYSTEM(platform, style, ratio),
    user: `用户一句话想法:\n${idea.trim()}`,
    json: true,
    temperature: 0.75,
    provider,
    credentials
  });
  const parsed = safeJsonParse(raw);
  if (!parsed) return { error: 'llm_parse_failed', raw };
  return parsed;
}

// ============ 参考图分析→扩写提示词 ============
const REFERENCE_SYSTEM = (userHint, platform, style, ratio) => `你是封面视觉分析师。用户上传了一张参考封面,请从画面中提取可复刻的视觉要素,但**不要抄袭文字内容**,只保留结构、配色、风格。

用户的需求:
- 目标平台: ${platform}
- 画面比例: ${ratio}
- 风格调整: ${style}
${userHint ? `- 额外要求: ${userHint}` : ''}

严格输出 JSON:
{
  "analysis": "参考图的视觉特征分析(5-8句话,覆盖: 风格/配色/构图/文字位置/氛围/目标人群)",
  "titleOnCover": "建议新封面的主标题文字(根据用户需求改造,不要抄参考图文字)",
  "subtitle": "可选副标题",
  "zhPrompt": "融合参考图风格+用户新主题的完整中文提示词",
  "enPrompt": "对应英文 AI 绘图提示词",
  "keepFromRef": ["从参考图保留的 3 条核心视觉元素"],
  "changeFromRef": ["相对参考图做出的 2-3 处调整"]
}

要求:
- 分析要具体,不要"色彩明亮""构图平衡"这种空话
- 中文字符不要直接出现在 enPrompt 里
- 必须融合用户的新主题/新方向,不是单纯照抄`;

export async function analyzeReference({ image, userHint, platform = '小红书', style = '简约清新', ratio = '3:4', provider, credentials }) {
  if (!image) throw new Error('请上传参考图');
  if (!hasUsableCredentials(provider, credentials)) throw new Error('请先配置 LLM API Key');

  const raw = await chat({
    system: REFERENCE_SYSTEM(userHint, platform, style, ratio),
    user: '请分析这张参考封面,并按格式输出 JSON。',
    images: [image],
    json: true,
    temperature: 0.5,
    provider,
    credentials
  });
  const parsed = safeJsonParse(raw);
  if (!parsed) return { error: 'llm_parse_failed', raw };
  return parsed;
}

// ============ 图像生成 ============
export async function generate({ prompt, ratio = '3:4', imageProvider, imageCredentials }) {
  if (!prompt?.trim()) throw new Error('请提供提示词');
  if (!imageProvider) throw new Error('请选择图像生成模型');
  const result = await generateImage({
    prompt: prompt.trim(),
    ratio,
    provider: imageProvider,
    credentials: imageCredentials
  });
  return result;
}

// ============ 热门封面搜索 ============
export async function searchCovers({ keyword, platform = '小红书', searchCredentials }) {
  if (!keyword?.trim()) throw new Error('请输入关键词');

  const platformKeywords = {
    '小红书': ['小红书封面', '小红书 封面'],
    '抖音': ['抖音封面', '抖音 cover'],
    '公众号': ['公众号封面', '公众号头图'],
    'B站': ['B站封面', 'bilibili 封面'],
    '视频号': ['视频号封面'],
    '通用': ['封面 海报']
  };
  const suffix = platformKeywords[platform]?.[0] || '封面';
  const query = `${keyword.trim()} ${suffix}`;
  return await searchImages({ query, credentials: searchCredentials, num: 20 });
}
