// 即梦 AI(豆包 Seedream)专属模板:中文自然语言为主,结构化分段,强调画面要素

const zh = (v) => v?.zh || v || '';

export function renderJimeng(dimensions, { extras = {} } = {}) {
  const { identity = {}, style = {}, proportion = {}, face_drawing = {}, line_and_color = {}, negatives = {} } = dimensions;

  const accList = (identity.accessories || []).map(a => zh(a)).filter(Boolean).join('、');
  const negList = (negatives.zh || []).join('、');

  return `一张 ${zh(style.family)} 的 Q版 角色全身立绘,${proportion.head_body_ratio || '2.5'} 头身(大头小身,头占全身 ${proportion.head_ratio_of_total_percent || 45}%),${zh(proportion.body_notes)}。

【发型】${zh(identity.hair)}
【服装】${zh(identity.outfit)}
${accList ? `【配饰】${accList}` : ''}
【姿势动作】${zh(identity.pose)}
${zh(identity.facial_distinct) ? `【面部识别】${zh(identity.facial_distinct)}` : ''}

【脸部画法】${zh(face_drawing.face_shape)}脸型,${zh(face_drawing.eye_style)},${zh(face_drawing.blush)},${zh(face_drawing.nose_mouth)}
【线条与色彩】${zh(line_and_color.line)},${zh(line_and_color.coloring)},${zh(line_and_color.shadow)},${zh(line_and_color.palette_mood)}

【风格总纲】${zh(style.descriptor)}

严格禁止:${negList || '成人身材比例、写实阴影、复杂纹理、多重星星高光、厚涂渐变'}

白色背景,单人居中构图,完整全身可见。`.replace(/\n{3,}/g, '\n\n').trim();
}
