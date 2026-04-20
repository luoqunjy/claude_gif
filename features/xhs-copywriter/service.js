import { chat, hasUsableCredentials, safeJsonParse } from '../../core/llm.js';
import { searchWeb } from '../../core/search.js';

/**
 * 小红书爆款文案生成 · RAG 流程
 *
 *   Step 1  benchmark(keyword)     —— 用 Serper 搜 "关键词 小红书" 拉 10+ 条真实对标笔记(title + snippet)
 *   Step 2  analyze(benchmarks)    —— LLM 拆解共性:钩子/情绪锚点/结构骨架/关键词密度/标题公式
 *   Step 3  writeNote(analysis..)  —— LLM 继承套路 + 用户意图写新笔记
 *
 *   fullPipeline(...)              —— 一键串完 3 步,前端默认入口
 */

// ============ Step 1: 搜索对标爆款 ============

export async function benchmark({ keyword, searchCredentials, extraQuery }) {
  if (!keyword?.trim()) throw new Error('请输入关键词');
  if (!searchCredentials?.apiKey) {
    throw new Error('需要 Serper API Key 才能搜真实对标,请在「🔑 API 设置 → 🌐 搜索服务」配置');
  }

  const queries = [
    `${keyword.trim()} 小红书`,
    extraQuery?.trim() ? `${extraQuery.trim()} 小红书` : null,
    `${keyword.trim()} 小红书 爆款`
  ].filter(Boolean);

  const seen = new Set();
  const all = [];
  for (const q of queries.slice(0, 2)) {
    try {
      const r = await searchWeb({
        query: q,
        credentials: searchCredentials,
        num: 10
      });
      for (const hit of r.results) {
        const key = hit.title.slice(0, 30);
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(hit);
      }
    } catch (e) {
      if (all.length === 0) throw e;
    }
  }

  return {
    keyword: keyword.trim(),
    queries,
    benchmarks: all.slice(0, 15)
  };
}

// ============ Step 2: 拆解套路 ============

const ANALYZE_SYSTEM = `你是小红书运营操盘手,负责把一批真实爆款笔记的标题+摘要拆解成可复用的"写作套路"。

你要识别:
1. 标题钩子类型(问句 / 具体数字 / 反常识 / 情绪爆点 / 身份标签 / 悬念)
2. 情绪锚点(踩坑→解脱 / 焦虑→安心 / 普通→逆袭 / 迷茫→清晰)
3. 内容骨架(开篇方式 → 中段逻辑 → 结尾动作)
4. 关键词密度建议(核心关键词在标题前 13 字、正文 2-3 次复现)
5. 高频标签共性
6. 要避开的雷区(AI 味 / 硬广感 / 过度营销)

严格输出 JSON:
{
  "hookTypes": ["问句钩子:直接戳痛点","数字钩子:给具体量化"],
  "emotionAnchors": ["从焦虑到安心","从踩坑到翻身"],
  "structurePattern": "开头 3 行(钩子/身份/时间锚点) → 痛点列举 → 尝试清单 → 对照结果 → 引导评论/收藏",
  "keywordRules": ["核心词进标题前 13 字","正文自然复现 2-3 次,不堆砌"],
  "titleFormulas": ["XX 天从 X 到 X 我只做了 X 件事","别再 XXX 了 真的救我","XX 岁才懂 XXX"],
  "commonTags": ["#常出现的垂类标签"],
  "avoidThese": ["亲们/小伙伴/本文/综上 AI 味词","强烈推荐/品牌方/福利 广告感词","堆砌感叹号和 emoji"],
  "takeaway": "一句话:要写这个主题,最该模仿的 3 条规则是什么"
}`;

export async function analyze({ keyword, benchmarks, provider, credentials }) {
  if (!benchmarks?.length) throw new Error('没有对标数据可拆解');
  if (!hasUsableCredentials(provider, credentials)) {
    throw new Error('请先配置 LLM API Key');
  }

  const sample = benchmarks.slice(0, 12).map((b, i) =>
    `[${i + 1}] 标题: ${b.title}\n    摘要: ${(b.snippet || '').slice(0, 180)}`
  ).join('\n\n');

  const raw = await chat({
    system: ANALYZE_SYSTEM,
    user: `主题关键词: ${keyword}\n\n真实对标笔记 ${benchmarks.length} 条:\n\n${sample}\n\n请拆解共性套路,输出 JSON。`,
    json: true,
    temperature: 0.4,
    provider,
    credentials
  });
  const parsed = safeJsonParse(raw);
  if (!parsed) return { error: 'llm_parse_failed', raw };
  return parsed;
}

// ============ Step 3: 继承套路,写新笔记 ============

const WRITE_SYSTEM = ({ keyword, analysis, intent }) => `你是写过 10 万+ 笔记的小红书操盘手。用户要写一篇关于【${keyword}】的笔记,你已经从真实爆款里学到了这些套路:

【拆解套路 · 必须遵循】
钩子类型: ${(analysis.hookTypes || []).join(' / ')}
情绪锚点: ${(analysis.emotionAnchors || []).join(' / ')}
内容骨架: ${analysis.structurePattern || ''}
关键词规则: ${(analysis.keywordRules || []).join(' / ')}
标题公式参考: ${(analysis.titleFormulas || []).join(' / ')}
避开这些雷区: ${(analysis.avoidThese || []).join(' / ')}
一句话要义: ${analysis.takeaway || ''}

【用户这次的具体诉求】
${intent || '(用户未额外指定,按主题常规角度写)'}

【写作硬性要求 · 违反视为失败】
1. 标题 ≤ 20 字,前 13 字含核心关键词"${keyword}",至少命中拆解里的一种钩子类型
2. 正文 350-550 字,第一人称叙事,短句+空行,每 2-3 句换行
3. 开头 3 行必须带钩子(问句/具体数字/反常识/情绪爆点),不要用"亲们/小伙伴/本文/综上"之类 AI 口头禅
4. 正文要有**真实细节**:价格/时间/地点/品牌/具体数字。如果用户没给具体值,用 <你的价格> / <你的品牌> 这种占位符让用户替换,不要编造
5. emoji 全文不超过 6 个,不连用
6. 核心关键词"${keyword}"在正文自然复现 2-3 次
7. 标签 6-8 个: 2 个热门大词 + 3-4 个长尾精准词 + 1 个人群/场景词。参考拆解里的 commonTags
8. 封面提示词写英文,3:4 竖图,带标题大字叠加,表达情绪
9. 结尾 CTA 引导**评论 or 收藏**(CES 算法里分值最高),不要硬推销
10. 发布时间给出具体"周 X HH:MM-HH:MM + 一句理由"
11. 输出纯 JSON,不要 markdown 代码块,不要解释

输出:
{
  "title": "...",
  "content": "...",
  "tags": ["#...","#...","#...","#...","#...","#..."],
  "cover_prompt": "english prompt, 3:4 aspect, bold chinese title overlay, ...",
  "best_time": "周X HH:MM-HH:MM · 理由一句",
  "cta": "结尾互动一句",
  "_selfCheck": {
    "titleHookUsed": "本次用了哪个拆解里的钩子类型",
    "keywordInFirst13Chars": true,
    "contentLength": 数字,
    "hasConcretePlaceholders": true
  }
}`;

export async function writeNote({ keyword, analysis, intent, provider, credentials }) {
  if (!keyword?.trim()) throw new Error('关键词缺失');
  if (!analysis) throw new Error('请先拆解');
  if (!hasUsableCredentials(provider, credentials)) {
    throw new Error('请先配置 LLM API Key');
  }

  const raw = await chat({
    system: WRITE_SYSTEM({ keyword, analysis, intent: intent?.trim() || '' }),
    user: `请现在写这篇笔记,严格按上述套路和硬性要求,输出 JSON。`,
    json: true,
    temperature: 0.9,
    provider,
    credentials
  });
  const parsed = safeJsonParse(raw);
  if (!parsed) return { error: 'llm_parse_failed', raw };
  if (!parsed.title || !parsed.content) return { error: 'missing_fields', raw };
  return parsed;
}

// ============ 一键全流程 ============

export async function fullPipeline({ keyword, intent, provider, credentials, searchCredentials }) {
  if (!keyword?.trim()) throw new Error('请输入关键词');

  const bm = await benchmark({ keyword, searchCredentials, extraQuery: intent });
  if (!bm.benchmarks.length) {
    throw new Error('没搜到对标,换个关键词试试(可以更具体,或加场景词)');
  }

  const analysis = await analyze({
    keyword: bm.keyword,
    benchmarks: bm.benchmarks,
    provider,
    credentials
  });
  if (analysis.error) {
    return { stage: 'analyze', ...analysis, benchmark: bm };
  }

  const note = await writeNote({
    keyword: bm.keyword,
    analysis,
    intent,
    provider,
    credentials
  });
  if (note.error) {
    return { stage: 'write', ...note, benchmark: bm, analysis };
  }

  return {
    benchmark: bm,
    analysis,
    note
  };
}

// ============ 单独调用入口(用户想手动调每一步) ============

export async function regenerate({ keyword, analysis, intent, provider, credentials }) {
  return await writeNote({ keyword, analysis, intent, provider, credentials });
}
