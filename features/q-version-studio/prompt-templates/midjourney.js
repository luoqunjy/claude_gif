// Midjourney V7 / Niji 6 专属模板:英文 tokens + 后缀参数,偏关键词组合

const en = (v) => v?.en || '';

export function renderMidjourney(dimensions, { extras = {} } = {}) {
  const { identity = {}, style = {}, proportion = {}, face_drawing = {}, line_and_color = {}, negatives = {} } = dimensions;
  const aspectRatio = extras.aspectRatio || '2:3';
  const useNiji = extras.useNiji !== false;

  const subject = style.silhouette_type === 'mascot'
    ? 'chibi mascot character'
    : style.silhouette_type === 'anthropomorphic'
      ? 'chibi anthropomorphic character'
      : 'chibi character';

  const accList = (identity.accessories || []).map(en).filter(Boolean).join(', ');
  const negList = (negatives.en || []).join(', ');

  const tokens = [
    subject,
    `${proportion.head_body_ratio || '2.5'} head-body ratio`,
    'oversized head',
    'tiny body',
    en(style.family),
    en(identity.hair),
    `wearing ${en(identity.outfit)}`,
    accList,
    en(identity.pose),
    `${en(face_drawing.face_shape)} face`,
    en(face_drawing.eye_style),
    en(face_drawing.blush),
    en(face_drawing.nose_mouth),
    en(line_and_color.line),
    en(line_and_color.coloring),
    en(line_and_color.palette_mood),
    en(style.descriptor),
    'white background',
    'full body portrait',
    'centered composition'
  ].filter(Boolean).join(', ');

  const params = [
    `--ar ${aspectRatio}`,
    '--s 250',
    useNiji ? '--niji 6' : '--style raw'
  ];
  if (negList) params.push(`--no ${negList}`);

  return `${tokens} ${params.join(' ')}`;
}
