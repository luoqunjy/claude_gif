// GPT-Image-1 (ChatGPT 内置)专属模板:自然语言段落,强调文字准确和整体氛围

const zh = (v) => v?.zh || v || '';

export function renderGptImage(dimensions, { extras = {} } = {}) {
  const { identity = {}, style = {}, proportion = {}, face_drawing = {}, line_and_color = {}, negatives = {} } = dimensions;

  const accList = (identity.accessories || []).map(zh).filter(Boolean).join('、');

  return `帮我画一张 Q版 角色插画。

整体是${zh(style.family)},${zh(style.descriptor)}。采用 ${proportion.head_body_ratio || '2.5'} 头身比例,头部占整张图高度约 ${proportion.head_ratio_of_total_percent || 45}%,${zh(proportion.body_notes)}。

角色设定:${zh(identity.hair)},穿着${zh(identity.outfit)}${accList ? `,身上有${accList}` : ''}。姿势是${zh(identity.pose)}。${zh(identity.facial_distinct)}

脸部画法要注意:${zh(face_drawing.face_shape)}脸型,${zh(face_drawing.eye_style)},${zh(face_drawing.blush)},${zh(face_drawing.nose_mouth)}。

线条使用${zh(line_and_color.line)},上色采用${zh(line_and_color.coloring)},${zh(line_and_color.shadow)},整体色调是${zh(line_and_color.palette_mood)}。

关键:请严格避免${(negatives.zh || []).join('、')}。

画面白色背景,单人居中构图,全身完整可见。`;
}
