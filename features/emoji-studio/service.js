import { chat, hasUsableCredentials, safeJsonParse } from '../../core/llm.js';
import { generateImage } from '../../core/image-gen.js';
import { removeBackground } from '../../core/matting.js';

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

export async function generateBatch({ prompts, ratio = '1:1', imageProvider = 'jimeng', imageCredentials, refImage = null }) {
  if (!Array.isArray(prompts) || !prompts.length) throw new Error('缺少提示词');
  if (prompts.length > 10) throw new Error('单次最多 10 张');
  if (!imageCredentials?.apiKey) {
    throw new Error(`请先在「🔑 模型库 → 🎨 图像生成」配置 ${imageProvider === 'jimeng' ? '即梦 Seedream' : 'Google Imagen'} 的 API Key`);
  }
  if (refImage && imageProvider !== 'jimeng') {
    throw new Error('图生图(角色参考)仅支持即梦 Seedream,请切换图像模型');
  }

  const tasks = prompts.map((p, idx) =>
    generateImage({
      prompt: typeof p === 'string' ? p : (p.enPrompt || p.zhPrompt || ''),
      ratio,
      provider: imageProvider,
      credentials: imageCredentials,
      refImage
    }).then(r => ({ idx, ok: true, ...r })).catch(e => ({ idx, ok: false, error: e.message }))
  );

  const results = await Promise.all(tasks);
  return {
    provider: imageProvider,
    ratio,
    mode: refImage ? 'i2i' : 't2i',
    images: results.map((r) => ({
      ok: r.ok,
      imageBase64: r.imageBase64 || null,
      imageUrl: r.imageUrl || null,
      error: r.error || null,
      prompt: typeof prompts[r.idx] === 'string' ? prompts[r.idx] : prompts[r.idx]
    }))
  };
}

// ============ 批量抠图 ============

export async function mattingBatch({ images, provider = 'replicate', credentials }) {
  if (!Array.isArray(images) || !images.length) throw new Error('缺少待抠图的图片');
  if (images.length > 10) throw new Error('单次最多 10 张');
  if (!credentials?.apiKey) {
    throw new Error(`请先在「🔑 模型库 → ✂ 抠图」配置 ${provider} 的 API Key`);
  }

  const tasks = images.map((img, idx) =>
    removeBackground({ image: img, provider, credentials })
      .then(r => ({ idx, ok: true, ...r }))
      .catch(e => ({ idx, ok: false, error: e.message }))
  );
  const results = await Promise.all(tasks);
  return {
    provider,
    images: results.map(r => ({
      ok: r.ok,
      imageBase64: r.imageBase64 || null,
      imageUrl: r.imageUrl || null,
      error: r.error || null
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

// ============ 动画化 GIF · P2 ============
//
// 预设动画库: 每条是 Canvas transform 函数体代码(t=0~1 进度, return {x,y,scaleX,scaleY,rotation,alpha})
// 带 emotionTags 方便 LLM 推荐

const ANIM_PRESETS = [
  { id: 'bounce-y',   name: '上下弹跳',  emoji: '🦘', tags: ['excited','happy','playful','big-laugh'],
    code: 'const s=Math.sin(t*Math.PI*2); return {y: s*15};' },
  { id: 'shake',      name: '疯狂抖动',  emoji: '😵', tags: ['shocked','cold','panic','angry'],
    code: 'return {x: Math.sin(t*Math.PI*20)*6, y: Math.cos(t*Math.PI*18)*4};' },
  { id: 'pop',        name: '爆炸弹出',  emoji: '💥', tags: ['surprise','reveal','excited','impact'],
    code: 'const s = t<0.3 ? 0.3+t/0.3*0.85 : 1-(t-0.3)/0.7*0.15; return {scaleX:s*1.15,scaleY:s*1.15};' },
  { id: 'swing',      name: '左右摇摆',  emoji: '🎪', tags: ['playful','relaxed','happy'],
    code: 'return {rotation: Math.sin(t*Math.PI*2)*10};' },
  { id: 'pulse',      name: '心跳脉动',  emoji: '❤️', tags: ['love','caring','emphasis','warm'],
    code: 'const s=1+Math.sin(t*Math.PI*4)*0.1; return {scaleX:s,scaleY:s};' },
  { id: 'spin',       name: '旋转',      emoji: '🌀', tags: ['dizzy','confused','playful'],
    code: 'return {rotation: t*360};' },
  { id: 'flash',      name: '闪烁',      emoji: '✨', tags: ['alert','magic','ghost','blink'],
    code: 'return {alpha: 0.3+Math.abs(Math.sin(t*Math.PI*6))*0.7};' },
  { id: 'zoom',       name: '放大呼吸',  emoji: '🔍', tags: ['dramatic','breathe','focus','emphasis'],
    code: 'const s=1+Math.sin(t*Math.PI*2)*0.08; return {scaleX:s,scaleY:s};' },
  { id: 'jitter',     name: '紧张颤抖',  emoji: '😰', tags: ['nervous','scared','worried','awkward'],
    code: 'return {x:(Math.random()-0.5)*4, y:(Math.random()-0.5)*4};' },
  { id: 'float',      name: '飘浮',      emoji: '💨', tags: ['calm','dreamy','peaceful','floating'],
    code: 'return {y: Math.sin(t*Math.PI*2)*8, rotation: Math.sin(t*Math.PI*2)*3};' },
  { id: 'drop',       name: '下坠反弹',  emoji: '⬇️', tags: ['fall','drop','arrive','crash'],
    code: 'const b=Math.abs(Math.sin(t*Math.PI*2)); return {y:(1-b)*-20};' },
  { id: 'wiggle',     name: '扭动',      emoji: '🐛', tags: ['playful','silly','wiggle','cute'],
    code: 'return {rotation: Math.sin(t*Math.PI*6)*8, x: Math.sin(t*Math.PI*4)*3};' },
  { id: 'headnod',    name: '点头同意',  emoji: '🙆', tags: ['yes','agree','nod','approve'],
    code: 'return {y: Math.abs(Math.sin(t*Math.PI*2))*6, scaleY: 1+Math.sin(t*Math.PI*2)*0.03};' },
  { id: 'shakehead',  name: '摇头否定',  emoji: '🙅', tags: ['no','reject','disagree','deny'],
    code: 'return {rotation: Math.sin(t*Math.PI*4)*6};' },
  { id: 'rainbow',    name: '彩虹变色',  emoji: '🌈', tags: ['happy','joy','colorful','magic'],
    code: 'return {scaleX:1+Math.sin(t*Math.PI*2)*0.05, scaleY:1+Math.cos(t*Math.PI*2)*0.05, rotation:Math.sin(t*Math.PI*2)*3};' }
];

// 合并 15 个新式 ANIM_PRESETS + 158 个旧 gif-maker BUILTIN_EFFECTS(通过 fnToCode 转码)
import { BUILTIN_EFFECTS, fnToCode, CATEGORIES as EFFECT_CATEGORIES } from './effects-library.js';

function builtinToPreset(bi) {
  return {
    id: bi.id,
    name: bi.name,
    emoji: bi.emoji,
    cat: bi.cat,
    tags: (bi.keys || '').split(/\s+/).filter(Boolean),
    code: fnToCode(bi.fn)
  };
}

export function animationPresets() {
  const merged = [...ANIM_PRESETS, ...BUILTIN_EFFECTS.map(builtinToPreset)];
  return { presets: merged, categories: EFFECT_CATEGORIES };
}

// --- Brief: 给张图 + prompt,LLM 挑 3 个适配动效 + 给 3 条 AI 自定义建议 ---

const BRIEF_SYSTEM = `你是表情包动画导演。用户给你一个表情图片(或生成时的 prompt 描述),你要:
1. 识别主要情绪/动作(如 大笑/摆烂/抖动/惊讶/害羞...)
2. 从 15 个动效预设里推荐 3 个最适配的(按适配度从高到低,给出 preset_id 和推荐理由一句话)
3. 额外给 3 条"AI 自定义动效 prompt"作为补充建议(描述你觉得更出彩/有巧思的动效,用户可以一键填入自定义框,每条 ≤ 25 字)

15 个预设及 emotion tags:
{{PRESETS}}

严格输出 JSON,无 markdown:
{
  "detectedEmotion": "识别到的情绪/动作(一个短语)",
  "recommendations": [
    {"preset_id":"id","reason":"为什么适合"},
    {"preset_id":"id","reason":"..."},
    {"preset_id":"id","reason":"..."}
  ],
  "customSuggestions": ["自定义建议 1","自定义建议 2","自定义建议 3"]
}`;

export async function animateBrief({ sourcePrompt, image, provider, credentials }) {
  if (!sourcePrompt && !image) throw new Error('需要源 prompt 或图片');
  if (!hasUsableCredentials(provider, credentials)) {
    throw new Error('请先配置 LLM API Key');
  }

  const presetsDesc = ANIM_PRESETS.map(p => `- ${p.id}: ${p.name} (${p.emoji}) · 情绪: [${p.tags.join(',')}]`).join('\n');
  const systemFilled = BRIEF_SYSTEM.replace('{{PRESETS}}', presetsDesc);

  const userMsg = sourcePrompt
    ? `源 prompt: ${sourcePrompt}\n\n请推荐 3 个动效 + 3 条自定义建议。`
    : '请分析这张图并推荐 3 个动效 + 3 条自定义建议。';

  const raw = await chat({
    system: systemFilled,
    user: userMsg,
    images: image ? [image] : [],
    json: true,
    temperature: 0.7,
    provider,
    credentials
  });
  const parsed = safeJsonParse(raw);
  if (!parsed) return { error: 'llm_parse_failed', raw };
  return parsed;
}

// --- Custom: 用户输入描述 → LLM 出 Canvas 函数体代码 ---

const CUSTOM_ANIM_SYSTEM = `你是 Canvas 动画函数生成器。根据用户中文描述输出一段 JS 函数体代码。

硬性规则:
- 输入参数: t (数值, 0~1, 代表动画进度)
- 可选返回对象字段: x(水平位移px, 建议 ±30), y(垂直位移, ±30), scaleX / scaleY (0.7~1.4), rotation (度数, ±30), alpha (0~1)
- 可用: Math.sin/cos/PI/abs/pow/exp/floor/round/random
- 只输出函数体代码,不含 function 声明,不含 markdown,不含 return 之外的任何解释
- 字符串里可以出现 // 注释
- 禁用: document/window/fetch/eval/Function/import/require

严格输出 JSON:
{ "code": "纯 JS 函数体字符串" }`;

export async function animateCustom({ description, provider, credentials }) {
  if (!description?.trim()) throw new Error('请输入动画描述');
  if (!hasUsableCredentials(provider, credentials)) throw new Error('请先配置 LLM API Key');

  const raw = await chat({
    system: CUSTOM_ANIM_SYSTEM,
    user: description.trim(),
    json: true,
    temperature: 0.5,
    provider,
    credentials
  });
  const parsed = safeJsonParse(raw);
  if (!parsed?.code) return { code: (raw || '').trim() };
  return parsed;
}
