export function mount(root) {
  const state = { kind: 'url', analysis: null };

  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => [...root.querySelectorAll(sel)];

  // Tabs
  const tabs = $$('.kind-tab');
  const panes = $$('.kind-pane');
  tabs.forEach(t => {
    t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      state.kind = t.dataset.kind;
      panes.forEach(p => {
        p.hidden = p.dataset.pane !== state.kind;
      });
    });
  });

  // Analyze
  const btnAnalyze = $('#la-btn-analyze');
  const analysisOut = $('#la-analysis-output');
  const btnTemplate = $('#la-btn-template');

  btnAnalyze.addEventListener('click', async () => {
    let input;
    try {
      input = await buildInput(root, state.kind);
    } catch (e) {
      toast(e.message, 'error');
      return;
    }

    setLoading(btnAnalyze, true, '分析中...');
    analysisOut.innerHTML = loadingBlock('正在拆解内容结构...');

    try {
      const res = await fetch('/api/link-analyzer/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, provider: window.App?.getProvider?.() })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      state.analysis = data;
      renderAnalysis(analysisOut, data);
      btnTemplate.disabled = false;
    } catch (e) {
      analysisOut.innerHTML = errorBlock(e.message);
    } finally {
      setLoading(btnAnalyze, false, '开始分析');
    }
  });

  // Template
  const tplOut = $('#la-template-output');
  btnTemplate.addEventListener('click', async () => {
    const topic = $('#la-template-topic').value.trim();
    if (!topic) { toast('请输入新主题', 'error'); return; }

    setLoading(btnTemplate, true, '生成中...');
    tplOut.innerHTML = loadingBlock('正在套用模板...');

    try {
      const res = await fetch('/api/link-analyzer/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis: state.analysis, topic, provider: window.App?.getProvider?.() })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      renderTemplate(tplOut, data);
    } catch (e) {
      tplOut.innerHTML = errorBlock(e.message);
    } finally {
      setLoading(btnTemplate, false, '套用模板生成新内容');
    }
  });
}

async function buildInput(root, kind) {
  const $ = (s) => root.querySelector(s);
  if (kind === 'url') {
    const url = $('#la-input-url').value.trim();
    if (!url) throw new Error('请粘贴链接');
    return { kind, url };
  }
  if (kind === 'text') {
    const text = $('#la-input-text').value.trim();
    if (!text) throw new Error('请输入文本内容');
    return { kind, text };
  }
  if (kind === 'image') {
    const file = $('#la-input-image').files[0];
    if (!file) throw new Error('请选择图片');
    const image = await fileToDataUrl(file);
    const caption = $('#la-input-image-caption').value.trim();
    return { kind, image, caption };
  }
  if (kind === 'video') {
    const transcript = $('#la-input-video-transcript').value.trim();
    if (!transcript) throw new Error('请粘贴视频文案 / 字幕');
    const coverFile = $('#la-input-video-cover').files[0];
    const cover = coverFile ? await fileToDataUrl(coverFile) : null;
    return { kind, transcript, cover };
  }
  if (kind === 'audio') {
    const transcript = $('#la-input-audio-transcript').value.trim();
    if (!transcript) throw new Error('请粘贴音频转写文本');
    return { kind, transcript };
  }
  throw new Error('未知输入类型');
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('读取文件失败'));
    r.readAsDataURL(file);
  });
}

function renderAnalysis(root, d) {
  if (d._note) {
    root.innerHTML = `<div class="note">${esc(d._note)}</div>` + buildAnalysisBody(d);
  } else {
    root.innerHTML = buildAnalysisBody(d);
  }
}

function buildAnalysisBody(d) {
  const field = (label, val) => val ? `
    <div class="field">
      <div class="field-label">${label}</div>
      <div class="field-value">${esc(val)}</div>
    </div>` : '';

  const list = (label, arr) => Array.isArray(arr) && arr.length ? `
    <div class="field">
      <div class="field-label">${label}</div>
      <ol class="step-list">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
    </div>` : '';

  const tpl = d.template || {};
  return `
    ${field('主题', d.theme)}
    ${field('受众', d.audience)}
    ${field('开场钩子', d.hook)}
    ${list('内容结构', d.structure)}
    ${field('语气', d.tone)}
    ${field('CTA', d.cta)}
    <div class="divider"></div>
    <div class="field-label" style="margin-bottom:6px">📋 可复用模板</div>
    <div class="template-card">
      ${tpl.title ? `<div><span class="k">标题模板</span><span class="v">${esc(tpl.title)}</span></div>` : ''}
      ${Array.isArray(tpl.outline) && tpl.outline.length ? `
        <div><span class="k">段落骨架</span></div>
        <ol class="step-list">${tpl.outline.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
      ${tpl.exampleHook ? `<div><span class="k">钩子示例</span><span class="v">${esc(tpl.exampleHook)}</span></div>` : ''}
      ${tpl.exampleCta ? `<div><span class="k">CTA 示例</span><span class="v">${esc(tpl.exampleCta)}</span></div>` : ''}
    </div>
  `;
}

function renderTemplate(root, d) {
  root.innerHTML = `
    <div class="template-output">
      ${d.title ? `<div class="tpl-title">${esc(d.title)}</div>` : ''}
      ${d.hook ? `<div class="tpl-section"><span class="k">钩子</span>${esc(d.hook)}</div>` : ''}
      ${d.body ? `<div class="tpl-body">${esc(d.body).replace(/\n/g, '<br>')}</div>` : ''}
      ${d.cta ? `<div class="tpl-section"><span class="k">CTA</span>${esc(d.cta)}</div>` : ''}
      <button class="btn btn-ghost" id="la-copy-btn" style="margin-top:10px">复制全文</button>
    </div>
  `;
  const copyBtn = root.querySelector('#la-copy-btn');
  copyBtn?.addEventListener('click', () => {
    const text = [d.title, d.hook, d.body, d.cta].filter(Boolean).join('\n\n');
    navigator.clipboard.writeText(text).then(
      () => { copyBtn.textContent = '✓ 已复制'; setTimeout(() => copyBtn.textContent = '复制全文', 1500); },
      () => { copyBtn.textContent = '复制失败'; }
    );
  });
}

function loadingBlock(text) {
  return `<div class="loading-inline"><span class="spinner"></span>${esc(text)}</div>`;
}
function errorBlock(msg) {
  return `<div class="error-inline">❌ ${esc(msg)}</div>`;
}
function setLoading(btn, on, label) {
  btn.disabled = on;
  const span = btn.querySelector('.btn-label');
  if (span) span.textContent = label;
  else btn.textContent = label;
}
function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
