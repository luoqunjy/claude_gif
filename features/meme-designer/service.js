import { chat, hasUsableCredentials, safeJsonParse } from '../../core/llm.js';
import { searchImages } from '../../core/search.js';

// ============ 反推:图→结构化提示词 ============

const REVERSE_SYSTEM = (structure, artStyle) => `你是表情包/梗图视觉分析师。用户上传了一张表情包图片,请基于画面内容严格按用户自定义的字段结构填写描述,并给出可直接用于 AI 绘图(${artStyle})的中英文提示词。

用户的提示词结构字段:
${structure.fields.map((f, i) => `${i + 1}. ${f.key}: ${f.desc}`).join('\n')}

严格输出 JSON:
{
  "fields": { ${structure.fields.map(f => `"${f.key}": "用中文精准填写"`).join(', ')} },
  "zhPrompt": "把以上字段按逗号/换行拼成一段通顺的中文提示词",
  "enPrompt": "专业的英文 AI 绘图提示词,${artStyle === 'midjourney' ? '后面加合适的 Midjourney 参数 --ar 1:1 --niji 6 等' : artStyle === 'sd' ? '使用逗号分隔带权重的 SD 风格' : '自然语言描述'}",
  "captionSuggestions": ["这张图可以配的 3-5 条文案候选"]
}

要求:
- 如果画面里有文字,单独标在 text 字段
- 风格词精准(扁平插画/像素风/赛璐璐/写实/3D/贴纸风 等)
- 英文提示词包含关键 tokens(style/subject/expression/composition/color/mood)`;

export async function reverse({ image, structure, artStyle = 'midjourney', credentials, provider }) {
  if (!image) throw new Error('请上传图片');
  if (!structure?.fields?.length) throw new Error('提示词结构缺失');
  if (!hasUsableCredentials(provider, credentials)) {
    throw new Error('请先配置 LLM API Key');
  }

  const raw = await chat({
    system: REVERSE_SYSTEM(structure, artStyle),
    user: '请分析这张表情包并按结构输出 JSON。',
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

// ============ 正向:文→结构化提示词 ============

const GENERATE_SYSTEM = (structure, artStyle) => `你是表情包设计师。用户用一句话描述想要什么表情包,请按自定义字段结构展开为可用的 AI 绘图提示词(中英双语)。

用户的提示词结构字段:
${structure.fields.map((f, i) => `${i + 1}. ${f.key}: ${f.desc}`).join('\n')}

严格输出 JSON(3 个候选方案):
{
  "variants": [
    {
      "label": "方案A - 描述该方案的风格定位(如:贴纸/扁平/3D)",
      "fields": { ${structure.fields.map(f => `"${f.key}": "..."`).join(', ')} },
      "zhPrompt": "中文提示词整段",
      "enPrompt": "${artStyle} 风格的英文提示词",
      "captionSuggestions": ["配文候选 1", "配文候选 2"]
    },
    { "label": "方案B - 另一种风格", ... },
    { "label": "方案C - 再一种", ... }
  ]
}

要求:
- 3 个方案要有明显差异(不同风格/构图/配色)
- 中英提示词完整可用`;

export async function generate({ description, structure, artStyle = 'midjourney', credentials, provider }) {
  if (!description?.trim()) throw new Error('请输入描述');
  if (!structure?.fields?.length) throw new Error('提示词结构缺失');
  if (!hasUsableCredentials(provider, credentials)) {
    throw new Error('请先配置 LLM API Key');
  }

  const raw = await chat({
    system: GENERATE_SYSTEM(structure, artStyle),
    user: `用户描述:\n${description.trim()}`,
    json: true,
    temperature: 0.8,
    provider,
    credentials
  });
  const parsed = safeJsonParse(raw);
  if (!parsed) return { error: 'llm_parse_failed', raw };
  return parsed;
}

// ============ 文案生成:情绪/场景→多候选短句 ============

const CAPTION_SYSTEM = `你是中文网络语言专家,擅长写戳心又好笑的表情包文案。

任务:给定一个场景/情绪,生成 6-8 条表情包配文候选,每条不超过 20 字,要有不同的情绪维度(愤怒/无语/自嘲/幽默/摆烂/破防/反讽/温情)。

严格输出 JSON:
{
  "captions": [
    { "tone": "愤怒", "text": "具体文案", "why": "为何戳人(一句话)" },
    { "tone": "无语", "text": "...", "why": "..." },
    ...
  ]
}

要求:
- 文案必须是中文,口语化,接地气
- 避免老梗(yyds/绝绝子/芜湖 这类已过气词)
- 每个维度只出一条,总数 6-8 条`;

export async function captions({ scenario, credentials, provider }) {
  if (!scenario?.trim()) throw new Error('请描述情绪或场景');
  if (!hasUsableCredentials(provider, credentials)) {
    throw new Error('请先配置 LLM API Key');
  }

  const raw = await chat({
    system: CAPTION_SYSTEM,
    user: `场景:${scenario.trim()}`,
    json: true,
    temperature: 0.95,
    provider,
    credentials
  });
  const parsed = safeJsonParse(raw);
  if (!parsed) return { error: 'llm_parse_failed', raw };
  return parsed;
}

// ============ 模板库策展:LLM 推荐经典梗图模板 ============

const GALLERY_SYSTEM = `你是中文表情包文化研究员。给用户一个情绪/主题,你要推荐 5-8 个"至今还在用的经典梗图模板",每个说明形象特征、典型配文、使用场景。

严格输出 JSON:
{
  "templates": [
    {
      "name": "模板名称(如:熊猫头/doge/哭包动作小/阿尼亚哇酷)",
      "visual": "描述画面特征,让用户能搜到这个模板",
      "when": "适合的使用场景/情绪",
      "exampleCaption": "典型配文示例(可以用 [x] 标占位)",
      "searchKeyword": "用户去搜图的关键词(3-5 字)"
    }
  ]
}

要求:
- 只推当前仍有生命力的(不要推已经过气 5 年+ 的)
- 模板要跟主题情绪真的匹配
- searchKeyword 用于后续一键跳转图片搜索`;

export async function gallery({ theme, credentials, provider }) {
  if (!theme?.trim()) throw new Error('请输入主题/情绪');
  if (!hasUsableCredentials(provider, credentials)) {
    throw new Error('请先配置 LLM API Key');
  }

  const raw = await chat({
    system: GALLERY_SYSTEM,
    user: `主题:${theme.trim()}`,
    json: true,
    temperature: 0.7,
    provider,
    credentials
  });
  const parsed = safeJsonParse(raw);
  if (!parsed) return { error: 'llm_parse_failed', raw };
  return parsed;
}

// ============ 热梗搜索:真实图片搜索 ============

export async function search({ query, searchCredentials }) {
  return await searchImages({
    query,
    credentials: searchCredentials,
    num: 12
  });
}
