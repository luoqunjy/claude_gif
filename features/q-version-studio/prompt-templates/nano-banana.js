// Nano Banana (Gemini 2.5 Flash Image) 专属模板:自然语言长 prompt,支持细节叙事

const zh = (v) => v?.zh || v || '';
const en = (v) => v?.en || '';

export function renderNanoBanana(dimensions, { extras = {} } = {}) {
  const { identity = {}, style = {}, proportion = {}, face_drawing = {}, line_and_color = {}, negatives = {} } = dimensions;
  const lang = extras.lang || 'zh';

  if (lang === 'en') {
    const accList = (identity.accessories || []).map(en).filter(Boolean).join(', ');
    return `Create a Q-style (chibi) character illustration. Style: ${en(style.family)}. ${en(style.descriptor)}

Proportions: ${proportion.head_body_ratio || '2.5'} head-body ratio, head occupies ~${proportion.head_ratio_of_total_percent || 45}% of total height, ${en(proportion.body_notes)}.

Character identity: ${en(identity.hair)}, wearing ${en(identity.outfit)}${accList ? `, with ${accList}` : ''}. ${en(identity.pose)}. ${en(identity.facial_distinct)}

Face rendering: ${en(face_drawing.face_shape)} face shape, ${en(face_drawing.eye_style)}, ${en(face_drawing.blush)}, ${en(face_drawing.nose_mouth)}.

Line and color: ${en(line_and_color.line)}, ${en(line_and_color.coloring)}, ${en(line_and_color.shadow)}, ${en(line_and_color.palette_mood)}.

Must AVOID: ${(negatives.en || []).join(', ')}.

White background. Full-body portrait, centered composition.`;
  }

  const accList = (identity.accessories || []).map(zh).filter(Boolean).join('、');
  return `请生成一张 Q版 角色插画。

【整体风格】${zh(style.family)} —— ${zh(style.descriptor)}

【身体比例】${proportion.head_body_ratio || '2.5'} 头身,头部占整张图高度约 ${proportion.head_ratio_of_total_percent || 45}%,${zh(proportion.body_notes)}

【角色身份】
- 发型:${zh(identity.hair)}
- 服装:${zh(identity.outfit)}
${accList ? `- 配饰:${accList}` : ''}
- 动作:${zh(identity.pose)}
${zh(identity.facial_distinct) ? `- 识别特征:${zh(identity.facial_distinct)}` : ''}

【脸部画法】${zh(face_drawing.face_shape)}脸型;眼睛:${zh(face_drawing.eye_style)};腮红:${zh(face_drawing.blush)};五官:${zh(face_drawing.nose_mouth)}

【线条和上色】线条:${zh(line_and_color.line)};上色:${zh(line_and_color.coloring)};光影:${zh(line_and_color.shadow)};色调:${zh(line_and_color.palette_mood)}

【必须避免】${(negatives.zh || []).join('、')}

白色背景,单人居中构图,全身可见。`;
}
