// Stable Diffusion / Flux 系列专属模板:英文 tag 式,含 positive + negative

const en = (v) => v?.en || '';

export function renderSdFlux(dimensions, { extras = {} } = {}) {
  const { identity = {}, style = {}, proportion = {}, face_drawing = {}, line_and_color = {}, negatives = {} } = dimensions;

  const subject = style.silhouette_type === 'mascot'
    ? 'chibi mascot'
    : style.silhouette_type === 'anthropomorphic'
      ? 'chibi anthropomorphic character'
      : 'chibi character';

  const accList = (identity.accessories || []).map(en).filter(Boolean).join(', ');

  const positiveTags = [
    'masterpiece',
    'best quality',
    'chibi',
    subject,
    `${proportion.head_body_ratio || '2.5'} head body`,
    'oversized head',
    'tiny body',
    en(style.family),
    en(identity.hair),
    en(identity.outfit),
    accList,
    en(identity.pose),
    `${en(face_drawing.face_shape)} face`,
    en(face_drawing.eye_style),
    en(face_drawing.blush),
    en(line_and_color.line),
    en(line_and_color.coloring),
    en(line_and_color.palette_mood),
    'white background',
    'full body',
    'centered'
  ].filter(Boolean).join(', ');

  const negativeTags = [
    ...(negatives.en || []),
    'lowres',
    'bad anatomy',
    'worst quality',
    'realistic',
    'photorealistic',
    'nsfw'
  ].join(', ');

  return `[Positive Prompt]
${positiveTags}

[Negative Prompt]
${negativeTags}`;
}
