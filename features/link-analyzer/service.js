import { fetchPage, parseMeta } from '../../core/fetcher.js';
import { detectPlatform, extractUrl } from '../../core/platform.js';
import { chat, hasUsableCredentials, safeJsonParse } from '../../core/llm.js';

export async function parseUrl(rawInput) {
  const url = extractUrl(rawInput) || rawInput;
  if (!url) throw new Error('url required');
  const platform = detectPlatform(url);
  let metadata = {};
  let finalUrl = url;
  let fetchError = null;
  try {
    const r = await fetchPage(url);
    finalUrl = r.finalUrl || url;
    metadata = parseMeta(r.html);
  } catch (e) {
    fetchError = e.message;
  }
  return { platform, normalizedUrl: finalUrl, metadata, fetchError };
}

const ANALYZE_SYSTEM = `你是资深短视频/图文内容运营策略师,精通抖音和小红书爆款方法论。
任务:基于用户提供的内容(可能是链接元数据、文本、图片或转写文本),站在创作者视角拆解内容,输出可复用的创作框架。

严格输出 JSON 对象,字段如下:
{
  "theme": "用一句话精准概括核心主题(20字内)",
  "audience": "目标受众画像:年龄段/身份标签/使用场景/核心痛点",
  "hook": "开场钩子原文(或归纳)+ 为何抓人的简短分析",
  "structure": ["分步骤列出内容叙事结构,每步一句话,3-6步"],
  "tone": "语气风格关键词,如:真诚分享 / 犀利锐评 / 治愈陪伴 / 干货测评",
  "cta": "行动召唤:引导用户点赞/关注/评论/收藏的具体话术或意图",
  "template": {
    "title": "可复用标题模板,用[变量名]占位,如 '[身份]必看:[主题]的[数字]个技巧'",
    "outline": ["模板段落骨架,3-6条"],
    "exampleHook": "钩子句式示例",
    "exampleCta": "CTA 句式示例"
  }
}

要求:
- 字段必须完整,不要遗漏
- 用中文输出
- 若信息不足,基于常识合理推断,不要留空字符串`;

export async function analyze(input, options = {}) {
  if (!input || !input.kind) throw new Error('input with kind required');

  const { context, images, note } = await buildContext(input);

  if (!hasUsableCredentials(options.provider, options.credentials)) {
    return ruleFallback(context, note);
  }

  const raw = await chat({
    system: ANALYZE_SYSTEM,
    user: `请分析以下内容,输出 JSON:\n\n${context}${note ? `\n\n[备注] ${note}` : ''}`,
    images,
    json: true,
    temperature: 0.5,
    provider: options.provider,
    credentials: options.credentials
  });
  const parsed = safeJsonParse(raw);
  if (!parsed) return { error: 'llm_parse_failed', raw };
  return parsed;
}

const TEMPLATE_SYSTEM = `你是内容创作助手。基于给定的分析模板和一个新主题,写一条可以直接发布的短内容。
保留原模板的结构、叙事节奏、语气和钩子风格,只把主题相关的部分替换为新主题。

严格输出 JSON:
{
  "title": "成品标题",
  "hook": "开场钩子原句",
  "body": "正文内容(可以多段,用\\n\\n分段)",
  "cta": "结尾 CTA"
}`;

export async function generateTemplate(analysis, topic, options = {}) {
  if (!analysis) throw new Error('analysis required');
  if (!topic) throw new Error('topic required');

  if (!hasUsableCredentials(options.provider, options.credentials)) {
    const tpl = analysis.template || {};
    return {
      title: (tpl.title || '[主题]的[N]个技巧').replaceAll('[主题]', topic),
      hook: tpl.exampleHook || `关于${topic},你可能还不知道...`,
      body: (tpl.outline || []).join('\n\n'),
      cta: tpl.exampleCta || '觉得有用点个赞,收藏备用~'
    };
  }

  const raw = await chat({
    system: TEMPLATE_SYSTEM,
    user: `原内容分析:\n${JSON.stringify(analysis, null, 2)}\n\n新主题: ${topic}\n\n请输出 JSON 格式的成品。`,
    json: true,
    temperature: 0.8,
    provider: options.provider,
    credentials: options.credentials
  });
  const parsed = safeJsonParse(raw);
  if (!parsed) return { error: 'llm_parse_failed', raw };
  return parsed;
}

async function buildContext(input) {
  const images = [];
  let context = '';
  let note = null;

  switch (input.kind) {
    case 'url': {
      const { platform, metadata, fetchError } = await parseUrl(input.url);
      context = [
        `输入类型: 链接`,
        `平台: ${platform}`,
        `链接: ${input.url}`,
        metadata.title ? `标题: ${metadata.title}` : '',
        metadata.description ? `描述: ${metadata.description}` : '',
        metadata.author ? `作者: ${metadata.author}` : '',
        metadata.keywords ? `关键词: ${metadata.keywords}` : '',
        metadata.tags?.length ? `标签: ${metadata.tags.join(', ')}` : ''
      ].filter(Boolean).join('\n');
      if (metadata.cover) images.push(metadata.cover);
      if (fetchError) note = `抓取失败(${fetchError}),请结合链接本身推断或让用户补充文本`;
      break;
    }
    case 'text': {
      if (!input.text?.trim()) throw new Error('text is empty');
      context = `输入类型: 文本\n内容:\n${input.text.trim()}`;
      break;
    }
    case 'image': {
      if (!input.image) throw new Error('image is empty');
      images.push(input.image);
      context = `输入类型: 图片${input.caption ? `\n用户备注: ${input.caption}` : ''}`;
      break;
    }
    case 'video': {
      if (!input.transcript?.trim()) throw new Error('video transcript is empty');
      context = `输入类型: 视频\n文案/字幕转写:\n${input.transcript.trim()}`;
      if (input.cover) images.push(input.cover);
      break;
    }
    case 'audio': {
      if (!input.transcript?.trim()) throw new Error('audio transcript is empty');
      context = `输入类型: 音频\n转写文本:\n${input.transcript.trim()}`;
      break;
    }
    default:
      throw new Error(`unsupported input kind: ${input.kind}`);
  }
  return { context, images, note };
}

function ruleFallback(context, note) {
  const snippet = String(context).slice(0, 60).replace(/\s+/g, ' ');
  return {
    theme: '(未配置 LLM,返回占位字段)',
    audience: '待配置 LLM 后自动推断',
    hook: snippet || '(无内容)',
    structure: ['引入话题', '展开核心内容', '给出结论', '引导互动'],
    tone: '中性',
    cta: '点赞 / 关注 / 收藏',
    template: {
      title: '[主题]的[N]个实用技巧',
      outline: ['抛出痛点钩子', '给出方法 1', '给出方法 2', '总结 + 引导互动'],
      exampleHook: '你有没有遇到过...',
      exampleCta: '有用的话点赞收藏,评论区聊聊你的看法~'
    },
    _note: note || '当前未配置 API Key,展示的是规则占位字段。请点击左下角「🔑 API 设置」填入 Kimi/DeepSeek/OpenAI 任一 Key。'
  };
}
