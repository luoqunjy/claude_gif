import { chat, hasUsableCredentials, safeJsonParse } from '../../core/llm.js';

/**
 * AI 动画生成: 从中文描述生成一段 Canvas 动画函数体代码
 * 返回格式尽量精简,方便前端直接 new Function('t', code) 执行
 */
const ANIMATION_SYSTEM = `你是 Canvas 动画函数生成器。根据用户的中文描述,生成一段 JavaScript 函数体代码。

硬性规则:
- 输入参数: t (数值, 0~1, 代表动画进度)
- 必须以 return { ... } 结尾,返回对象可含字段: x(水平位移px) / y(垂直位移px) / scaleX / scaleY / rotation(度数) / alpha(0~1)
- 可用: Math.sin / Math.cos / Math.PI / Math.abs / Math.pow / Math.exp / Math.floor / Math.round
- **只输出函数体代码**,不含函数声明 function,不含 markdown 代码块围栏,不含任何解释

严格输出 JSON (仅此一个字段):
{ "code": "function body here" }

示例 code 值(不是 JSON,只是示范函数体):
const angle = t * Math.PI * 2;
return { y: Math.sin(angle) * 20, rotation: Math.sin(angle) * 10 };`;

export async function generateAnimation({ description, provider, credentials }) {
  if (!description?.trim()) throw new Error('请输入动画描述');
  if (!hasUsableCredentials(provider, credentials)) {
    throw new Error('请先配置 LLM API Key');
  }

  const raw = await chat({
    system: ANIMATION_SYSTEM,
    user: description.trim(),
    json: true,
    temperature: 0.4,
    provider,
    credentials
  });
  const parsed = safeJsonParse(raw);
  if (!parsed?.code) {
    // 某些模型可能不听 JSON 指令,直接返回代码
    return { code: (raw || '').trim() };
  }
  return { code: parsed.code.trim() };
}
