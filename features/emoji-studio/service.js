import { chat, hasUsableCredentials, safeJsonParse } from '../../core/llm.js';
import { generateImage } from '../../core/image-gen.js';

/**
 * 爆款表情工厂 · 后端服务
 *
 * 3 个核心端点:
 *   fillTemplate  — LLM 按用户自定义结构模板填词,产出 N 个差异化变体
 *   generateBatch — 并发调图像模型(默认即梦 Seedream)批量出图
 *   reverse       — 上传图 → 反推结构化字段 + 适合做成模板的候选
 *
 * 附: presetTemplates() 给前端 5 套开箱即用模板(基于用户飞书字段实践)
 */

// ============ 5 套预置结构化模板 ============

const PRESETS = [
  {
    id: 'preset-text-simple',
    name: '🎭 文字表情 · 极简版',
    kind: 'text',
    description: '5 个字段,快速出梗图',
    fields: [
      { key: 'emotion', label: '情绪', desc: '情绪要极致,比如"疯狂大笑"不是"微笑"', candidates: ['疯狂大笑','无语到翻白眼','摆烂瘫倒','委屈到哭','抓狂','悠闲'] },
      { key: 'action', label: '动作', desc: '配合情绪的肢体动作', candidates: ['比耶','捂脸','鼓掌','摆手','躺平','飞扑'] },
      { key: 'element', label: '装饰元素', desc: '旁边的点缀物/气泡/星光', candidates: ['爆炸气泡','闪光','爱心','汗滴','问号堆'] },
      { key: 'textOverlay', label: '文字叠加', desc: '图上的中文文案(4-8 字,爆款感)', candidates: [] },
      { key: 'style', label: '风格', desc: 'Q版贴纸/扁平插画/3D 渲染 等', candidates: ['Q版贴纸','扁平插画','3D皮克斯','像素风','手绘线条'] }
    ]
  },
  {
    id: 'preset-text-viral',
    name: '🎭 文字表情 · 爆款完整版',
    kind: 'text',
    description: '对齐你飞书表情包设计表 9 字段',
    fields: [
      { key: 'medium', label: '媒介', desc: '整体画面载体', candidates: ['lovely illustration','sticker','3D render','digital painting'] },
      { key: 'artStyle', label: '艺术风格', desc: '画面艺术风格锚点', candidates: ['Q版','皮克斯','扁平','赛璐璐','Mary Blair','吉卜力'] },
      { key: 'subject', label: '主体', desc: '主角是什么(人/动物/物品)', candidates: [] },
      { key: 'expression', label: '表情', desc: '表情要夸张', candidates: ['happy laughing','shy','surprised','angry','confused','curious','crying'] },
      { key: 'action', label: '动作', desc: '主体正在做什么' },
      { key: 'element', label: '环境元素', desc: '周围装饰/背景物件', candidates: ['heart symbols','sparkles','speed lines','question marks'] },
      { key: 'textOverlay', label: '文字叠加', desc: '图上中文文案' },
      { key: 'mood', label: '氛围', desc: '整体色调/光线', candidates: ['温暖','冷色','高饱和','柔和'] },
      { key: 'params', label: '参数', desc: 'AI 参数,如 --ar 1:1', candidates: ['--ar 1:1','--niji 6','--s 150','--stylize 750'] }
    ]
  },
  {
    id: 'preset-char-q',
    name: '🎪 Q版角色表情 · 闪耀猫猫式',
    kind: 'character',
    description: '适配你现在的 Q 版角色打法',
    fields: [
      { key: 'character', label: '角色', desc: '参考角色图(由角色库提供)', locked: true },
      { key: 'expression', label: '表情', desc: '表情要极致', candidates: ['大笑','惊讶','翻白眼','流泪','沉思','害羞','无语','生气'] },
      { key: 'action', label: '动作', desc: '角色动作', candidates: ['比耶','趴着','飞扑','捂脸','鼓掌','摆手','跳跃','蹲坐'] },
      { key: 'element', label: '元素', desc: '旁边的点缀', candidates: ['爱心','星星','汗滴','闪光','音符','惊叹号'] },
      { key: 'textOverlay', label: '文字叠加', desc: '中文文案(可留空)' },
      { key: 'params', label: '参数', desc: 'AI 参数', candidates: ['--ar 1:1','--niji 6','--s 150'] }
    ]
  },
  {
    id: 'preset-avatar-ip',
    name: '🎨 头像 / IP · 完整版',
    kind: 'character',
    description: '对齐你飞书头像设计表 8 字段',
    fields: [
      { key: 'medium', label: '媒介', candidates: ['Hyperrealism','anime','flat illustration','ink line painting','2d plane','3d render'] },
      { key: 'artStyle', label: '艺术风格', candidates: ['fantasy realism','Dunhuang style','minimalism','2.5D','children book'] },
      { key: 'subject', label: '主体', desc: '例: beautiful chinese girl' },
      { key: 'emotion', label: '情绪', candidates: ['smiling','calm','surprised','thinking','happy'] },
      { key: 'environment', label: '环境', desc: '背景描述,服饰,道具' },
      { key: 'colorRender', label: '颜色/渲染', candidates: ['soft colorpalette','gold line stroke','black and red','iridescent gradient'] },
      { key: 'light', label: '光线', candidates: ['cinematic','soft light','rim light','golden hour'] },
      { key: 'composition', label: '角度构图', candidates: ['closeup','portrait','profile','half body','full body'] },
      { key: 'params', label: '后缀参数', candidates: ['--ar 1:1 --s 150','8k','high detail'] }
    ]
  },
  {
    id: 'preset-universal',
    name: '🌈 通用生图',
    kind: 'text',
    description: '字段最少的兜底模板',
    fields: [
      { key: 'subject', label: '主体', desc: '画什么' },
      { key: 'style', label: '风格', candidates: ['写实','插画','3D','像素风','油画','水彩'] },
      { key: 'scene', label: '场景', desc: '环境/背景' },
      { key: 'detail', label: '细节', desc: '光线/色调/特别要求' },
      { key: 'params', label: '参数', desc: '可选' }
    ]
  }
];

export function presetTemplates() {
  return PRESETS;
}

// ============ fillTemplate: LLM 结构化填词 + N 个变体 ============

const FILL_SYSTEM = (template, count) => `你是深耕小红书/微信生态的爆款表情包提示词工程师。你要按用户自定义的结构化模板填空,输出 ${count} 个有差异的完整提示词变体,直接可以喂给 AI 绘图模型(即梦 Seedream / Google Imagen)。

用户的结构化模板:
${template.fields.map((f, i) => {
  const candHint = f.candidates?.length ? ` · 可参考 [${f.candidates.slice(0, 6).join(' / ')}]` : '';
  const lockedHint = f.locked ? ' · 🔒 用户锁定,不要改写' : '';
  return `${i + 1}. ${f.key} (${f.label || ''}): ${f.desc || ''}${candHint}${lockedHint}`;
}).join('\n')}

【爆款表情硬性要求】
1. 表情要极致(不是"微笑"而是"疯狂大笑到停不下来眼泪都出来");情绪浓度拉满
2. 构图聚焦: 主体大,正面或 3/4 侧,表情清晰可辨
3. 风格一致性: 整批图用同一种画风(Q版贴纸 / 扁平 / 3D 皮克斯 任选其一,不混搭)
4. 背景尽量简洁或透明/纯色,便于后续抠图
5. 中文文字叠加要短促有力(4-8 字),像"够啦!"、"求求了"、"我裂开"之类
6. ${count} 个变体必须有明显差异: 表情强度 / 动作幅度 / 装饰元素 / 光线色调 四个维度任选两个维度做变化,避免换汤不换药
7. 如果字段标记 locked: true,严格保留用户给的内容不改
8. zhPrompt 是自然中文拼接,enPrompt 是英文 tokens 逗号分隔(模型友好)

严格输出 JSON,无 markdown 无解释:
{
  "variants": [
    {
      "fields": { ${template.fields.map(f => `"${f.key}":"..."`).join(', ')} },
      "zhPrompt": "整段中文提示词,各字段自然拼接",
      "enPrompt": "english tokens, style, composition, emotion, element, params",
      "caption": "这一版的差异卖点一句话"
    }
    // 共 ${count} 个
  ]
}`;

export async function fillTemplate({ description, template, count = 3, lockedFields = {}, provider, credentials }) {
  if (!description?.trim()) throw new Error('请输入描述文案');
  if (!template?.fields?.length) throw new Error('请选择或自定义一个结构模板');
  if (!hasUsableCredentials(provider, credentials)) {
    throw new Error('请先配置 LLM API Key');
  }
  count = Math.max(1, Math.min(10, Number(count) || 1));

  const lockedNote = Object.keys(lockedFields).length
    ? `\n\n【锁定字段 · 严格保留】\n${Object.entries(lockedFields).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
    : '';

  const raw = await chat({
    system: FILL_SYSTEM(template, count),
    user: `用户描述:\n${description.trim()}${lockedNote}\n\n请生成 ${count} 个差异化变体,输出 JSON。`,
    json: true,
    temperature: 0.88,
    provider,
    credentials
  });
  const parsed = safeJsonParse(raw);
  if (!parsed?.variants?.length) return { error: 'llm_parse_failed', raw };
  return { variants: parsed.variants.slice(0, count) };
}

// ============ generateBatch: 并发批量出图 ============

export async function generateBatch({ prompts, ratio = '1:1', imageProvider = 'jimeng', imageCredentials }) {
  if (!Array.isArray(prompts) || !prompts.length) throw new Error('缺少提示词');
  if (prompts.length > 10) throw new Error('单次最多 10 张');
  if (!imageCredentials?.apiKey) {
    throw new Error(`请先在「🔑 API 设置 → 🎨 图像生成」配置 ${imageProvider === 'jimeng' ? '即梦 Seedream' : 'Google Imagen'} 的 API Key`);
  }

  const tasks = prompts.map((p, idx) =>
    generateImage({
      prompt: typeof p === 'string' ? p : (p.enPrompt || p.zhPrompt || ''),
      ratio,
      provider: imageProvider,
      credentials: imageCredentials
    }).then(r => ({ idx, ok: true, ...r })).catch(e => ({ idx, ok: false, error: e.message }))
  );

  const results = await Promise.all(tasks);
  return {
    provider: imageProvider,
    ratio,
    images: results.map((r) => ({
      ok: r.ok,
      imageBase64: r.imageBase64 || null,
      imageUrl: r.imageUrl || null,
      error: r.error || null,
      prompt: typeof prompts[r.idx] === 'string' ? prompts[r.idx] : prompts[r.idx]
    }))
  };
}

// ============ reverse: 反推(优化版) ============
//
// 相比原 meme-designer 的反推,这里做了 3 点优化:
//   1. 给定某个结构模板,填好这个模板的字段(而不是自由描述)
//   2. 同时产出"作为角色库条目"的元数据(角色名候选 / 风格标签)
//   3. 产出"下一步建议": 可以套用这张图做什么(复刻一致性/做成表情包/生成 GIF)

const REVERSE_SYSTEM = (template) => `你是视觉风格分析师。用户上传一张表情包/角色图,你要:
1. 按用户指定的结构化模板填好每个字段(用你从画面观察到的内容)
2. 给出可以直接复用的中/英提示词(用来生成同风格新图)
3. 判断这张图适合做什么:作为角色参考(角色表情)? 做成 GIF 表情? 继续衍生同款?

用户指定的结构模板:
${template.fields.map((f, i) => `${i + 1}. ${f.key} (${f.label || ''}): ${f.desc || ''}`).join('\n')}

严格输出 JSON:
{
  "fields": { ${template.fields.map(f => `"${f.key}":"..."`).join(', ')} },
  "zhPrompt": "复刻这张图的中文提示词",
  "enPrompt": "english prompt to replicate the style",
  "characterCandidate": {
    "name": "给这张图建议的角色名(如:橘猫兄 / 小女孩A)",
    "tags": ["Q版","猫","黄色"],
    "suitableAs": "character | text-emoji | both"
  },
  "nextActions": ["可以做的下一步,如:保存为角色库 / 再生成 6 张不同表情 / 套模板做一整套表情包"]
}`;

export async function reverse({ image, template, provider, credentials }) {
  if (!image) throw new Error('请上传图片');
  if (!template?.fields?.length) throw new Error('请先选择一个结构模板作为反推目标');
  if (!hasUsableCredentials(provider, credentials)) {
    throw new Error('请先配置支持识图的 LLM API Key (OpenAI 或 通义千问)');
  }

  const raw = await chat({
    system: REVERSE_SYSTEM(template),
    user: '请分析这张图并按模板填字段,输出 JSON。',
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
