/**
 * 封面图设计助手 — 3 个 tab:找灵感 / 主题生封面 / 参考图仿制
 *
 * 模型策略:
 * - llm 用于扩写提示词+分析参考图
 * - imageGen 用于实际生图(Google Imagen / 即梦)
 * - 两者独立选择,通过 window.App 的 per-module 偏好保存
 */

const FEATURE_ID = 'cover-designer';

// 平台预设 → 比例 + 默认尺寸提示
const PLATFORM_PRESETS = [
  { id: '小红书-3:4', label: '小红书', platform: '小红书', ratio: '3:4', tag: '3:4' },
  { id: '小红书-1:1', label: '小红书方图', platform: '小红书', ratio: '1:1', tag: '1:1' },
  { id: '抖音-9:16', label: '抖音竖版', platform: '抖音', ratio: '9:16', tag: '9:16' },
  { id: '抖音-1:1', label: '抖音方图', platform: '抖音', ratio: '1:1', tag: '1:1' },
  { id: '公众号-16:9', label: '公众号头图', platform: '公众号', ratio: '16:9', tag: '16:9' },
  { id: '公众号-1:1', label: '公众号次图', platform: '公众号', ratio: '1:1', tag: '1:1' },
  { id: 'B站-16:9', label: 'B 站横版', platform: 'B站', ratio: '16:9', tag: '16:9' },
  { id: 'YouTube-16:9', label: 'YouTube', platform: 'YouTube', ratio: '16:9', tag: '16:9' }
];

const STYLE_PRESETS = [
  '极简', '可爱卡通', '文艺复古', '清新自然', '酷炫科技', '专业商务',
  '手绘插画', '赛博朋克', '国潮', '少女粉', '高级灰', '孟菲斯'
];

export function mount(root) {
  const state = {
    activeTab: 'search',
    searchPlatform: '小红书',
    // text2img state
    t2iPlatform: PLATFORM_PRESETS[0],
    t2iStyle: STYLE_PRESETS[0],
    t2iExpanded: null,
    // ref2img state
    refImage: null,
    refPlatform: PLATFORM_PRESETS[0],
    refStyle: STYLE_PRESETS[0],
    refAnalysis: null
  };

  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];

  // ============ 模型选择芯片 ============
  const llmChip = window.App.createModelChip({
    featureId: FEATURE_ID,
    type: 'llm',
    onChange: () => {}
  });
  const imgChip = window.App.createModelChip({
    featureId: FEATURE_ID,
    type: 'imageGen',
    onChange: () => {}
  });
  $('#cd-llm-chip').appendChild(llmChip);
  $('#cd-image-chip').appendChild(imgChip);

  // ============ Tab 切换 ============
  $$('.cd-tab').forEach(tab => {
    tab.onclick = () => {
      state.activeTab = tab.dataset.tab;
      $$('.cd-tab').forEach(t => t.classList.toggle('active', t === tab));
      $$('.cd-tab-pane').forEach(p => p.hidden = p.dataset.pane !== state.activeTab);
    };
  });

  // ============ 平台预设渲染 ============
  function renderPlatformPresets(containerSel, state, stateKey) {
    const cont = $(containerSel);
    cont.innerHTML = '';
    PLATFORM_PRESETS.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'platform-preset' + (state[stateKey]?.id === p.id ? ' active' : '');
      btn.dataset.id = p.id;
      btn.innerHTML = `${escapeHtml(p.label)}<span class="ratio-tag">${p.tag}</span>`;
      btn.onclick = () => {
        state[stateKey] = p;
        renderPlatformPresets(containerSel, state, stateKey);
      };
      cont.appendChild(btn);
    });
  }
  renderPlatformPresets('#cd-t2i-platform', state, 't2iPlatform');
  renderPlatformPresets('#cd-ref-platform', state, 'refPlatform');

  // 风格 chips
  function renderStyleChips(containerSel, state, stateKey) {
    const cont = $(containerSel);
    cont.innerHTML = '';
    STYLE_PRESETS.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'style-chip' + (state[stateKey] === s ? ' active' : '');
      btn.textContent = s;
      btn.onclick = () => {
        state[stateKey] = s;
        renderStyleChips(containerSel, state, stateKey);
      };
      cont.appendChild(btn);
    });
  }
  renderStyleChips('#cd-t2i-style', state, 't2iStyle');
  renderStyleChips('#cd-ref-style', state, 'refStyle');

  // ============ Tab 1: 搜索 ============
  $$('#cd-search-platform .platform-preset').forEach(btn => {
    btn.onclick = () => {
      $$('#cd-search-platform .platform-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.searchPlatform = btn.dataset.platform;
    };
  });

  $('#cd-btn-search').onclick = async () => {
    const keyword = $('#cd-search-keyword').value.trim();
    if (!keyword) { toast('请输入关键词', 'error'); return; }
    const sc = window.App.getSearchCredentials();
    if (!sc) {
      toast('请先在「🔑 API 设置 → 🌐 搜索服务」配置 Serper Key', 'error');
      window.App.openSettings('serper', 'search');
      return;
    }

    const out = $('#cd-search-output');
    out.innerHTML = loadingBlock('正在搜索爆款封面...');
    const btn = $('#cd-btn-search'); btn.disabled = true;

    try {
      const res = await fetch('/api/cover-designer/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword,
          platform: state.searchPlatform,
          searchCredentials: sc
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      renderSearchResults(out, data.results || []);
    } catch (e) {
      out.innerHTML = errorBlock(e.message);
    } finally { btn.disabled = false; }
  };

  $('#cd-search-keyword').onkeydown = (e) => {
    if (e.key === 'Enter') $('#cd-btn-search').click();
  };

  function renderSearchResults(root, results) {
    if (!results.length) { root.innerHTML = `<div class="empty small">没搜到,换个关键词试试</div>`; return; }
    root.innerHTML = `
      <div class="cd-grid-covers">
        ${results.map((r, i) => `
          <div class="cd-cover-card" data-i="${i}">
            <img src="${escapeHtml(r.thumbnail || r.imageUrl)}" alt="${escapeHtml(r.title || '')}" loading="lazy" referrerpolicy="no-referrer">
            <div class="cover-title">${escapeHtml((r.title || '').slice(0, 40))}</div>
            <button class="cover-use-btn" data-use-i="${i}">用作参考</button>
          </div>
        `).join('')}
      </div>
    `;
    // 点卡片 → 打开原图
    root.querySelectorAll('.cd-cover-card').forEach(c => {
      c.onclick = (e) => {
        if (e.target.classList.contains('cover-use-btn')) return;
        const i = +c.dataset.i;
        const r = results[i];
        window.open(r.sourceUrl || r.imageUrl, '_blank');
      };
    });
    // 点"用作参考" → 把图拉下来,放到参考图仿制 tab
    root.querySelectorAll('.cover-use-btn').forEach(b => {
      b.onclick = async (e) => {
        e.stopPropagation();
        const i = +b.dataset.useI;
        const r = results[i];
        b.textContent = '下载中...';
        try {
          const dataUrl = await urlToDataUrl(r.imageUrl);
          state.refImage = dataUrl;
          renderRefPreview();
          // 切到参考图仿制 tab
          $$('.cd-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'ref2img'));
          $$('.cd-tab-pane').forEach(p => p.hidden = p.dataset.pane !== 'ref2img');
          state.activeTab = 'ref2img';
          toast('✓ 已用作参考图,去"参考图仿制"继续');
        } catch (err) {
          toast('下载图片失败,请右键保存后手动上传', 'error');
        }
      };
    });
  }

  // ============ Tab 2: 主题生封面 ============
  $('#cd-btn-expand').onclick = async () => {
    const idea = $('#cd-t2i-idea').value.trim();
    if (!idea) { toast('请输入想法', 'error'); return; }
    const creds = window.App.getCredentialsFor(FEATURE_ID);
    if (!creds) {
      toast('请先配置 LLM API Key', 'error');
      window.App.openSettings();
      return;
    }

    const out = $('#cd-t2i-output');
    out.innerHTML = loadingBlock('LLM 正在扩写提示词...');
    const btn = $('#cd-btn-expand'); btn.disabled = true;

    try {
      const res = await fetch('/api/cover-designer/expand-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea,
          platform: state.t2iPlatform.platform,
          style: state.t2iStyle,
          ratio: state.t2iPlatform.ratio,
          ...creds
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      state.t2iExpanded = data;
      renderExpandedPrompt(out, data, 't2i');
      $('#cd-btn-generate').disabled = false;
    } catch (e) {
      out.innerHTML = errorBlock(e.message);
    } finally { btn.disabled = false; }
  };

  $('#cd-btn-generate').onclick = async () => {
    if (!state.t2iExpanded) { toast('先点第 ① 步扩写提示词', 'error'); return; }
    await doGenerate({
      prompt: getEditedPrompt('t2i') || state.t2iExpanded.enPrompt || state.t2iExpanded.zhPrompt,
      ratio: state.t2iPlatform.ratio,
      outputSelector: '#cd-t2i-output',
      btnSelector: '#cd-btn-generate',
      context: state.t2iExpanded
    });
  };

  // ============ Tab 3: 参考图仿制 ============
  const refFileInput = $('#cd-ref-file');
  refFileInput.onchange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    state.refImage = await fileToDataUrl(f);
    renderRefPreview();
  };

  // 粘贴支持
  document.addEventListener('paste', async (e) => {
    if (state.activeTab !== 'ref2img') return;
    const items = e.clipboardData?.items || [];
    for (const it of items) {
      if (it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) {
          e.preventDefault();
          state.refImage = await fileToDataUrl(f);
          renderRefPreview();
          return;
        }
      }
    }
  });

  function renderRefPreview() {
    const wrap = $('#cd-ref-preview-wrap');
    if (!state.refImage) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = `
      <div style="display:flex;gap:10px;align-items:flex-start;padding:8px;background:var(--pink-50);border-radius:10px;">
        <img src="${state.refImage}" style="max-height:120px;border-radius:8px;object-fit:contain">
        <button class="btn btn-ghost btn-sm" id="cd-ref-clear">× 清除</button>
      </div>
    `;
    $('#cd-ref-clear').onclick = () => {
      state.refImage = null;
      state.refAnalysis = null;
      renderRefPreview();
      $('#cd-btn-generate-ref').disabled = true;
    };
  }

  $('#cd-btn-analyze-ref').onclick = async () => {
    if (!state.refImage) { toast('请先上传参考图', 'error'); return; }
    // 强制用视觉 LLM
    const creds = window.App.getCredentialsFor(FEATURE_ID, { requireVision: true });
    if (!creds) {
      toast('当前没有已配置的视觉模型。请配置 OpenAI 或通义千问', 'error');
      window.App.openSettings('openai');
      return;
    }
    // 检查 creds 对应的 provider 是否真的支持 vision
    const provDef = window.App.listVisionProviders().find(p => p.id === creds.provider);
    if (!provDef) {
      toast(`${creds.provider} 不支持识图,请切换模型或配置 OpenAI/通义千问`, 'error');
      return;
    }

    const out = $('#cd-ref-output');
    out.innerHTML = loadingBlock('视觉模型正在分析参考图...');
    const btn = $('#cd-btn-analyze-ref'); btn.disabled = true;

    try {
      const res = await fetch('/api/cover-designer/analyze-ref', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: state.refImage,
          userHint: $('#cd-ref-hint').value.trim(),
          platform: state.refPlatform.platform,
          style: state.refStyle,
          ratio: state.refPlatform.ratio,
          ...creds
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      state.refAnalysis = data;
      renderExpandedPrompt(out, data, 'ref');
      $('#cd-btn-generate-ref').disabled = false;
    } catch (e) {
      out.innerHTML = errorBlock(e.message);
    } finally { btn.disabled = false; }
  };

  $('#cd-btn-generate-ref').onclick = async () => {
    if (!state.refAnalysis) { toast('先点第 ① 步分析参考图', 'error'); return; }
    await doGenerate({
      prompt: getEditedPrompt('ref') || state.refAnalysis.enPrompt || state.refAnalysis.zhPrompt,
      ratio: state.refPlatform.ratio,
      outputSelector: '#cd-ref-output',
      btnSelector: '#cd-btn-generate-ref',
      context: state.refAnalysis
    });
  };

  // ============ 通用生图 ============
  async function doGenerate({ prompt, ratio, outputSelector, btnSelector, context }) {
    const imgCreds = window.App.getImageCredentialsFor(FEATURE_ID);
    if (!imgCreds) {
      toast('请先在「🔑 API 设置 → 🎨 图像生成」配置 Google Imagen 或即梦', 'error');
      window.App.openSettings(null, 'imageGen');
      return;
    }

    const out = $(outputSelector);
    const btn = $(btnSelector);
    const resultBox = out.querySelector('.cd-generated-result') || (() => {
      const el = document.createElement('div');
      el.className = 'cd-generated-result';
      out.appendChild(el);
      return el;
    })();
    resultBox.innerHTML = loadingBlock(`正在用 ${imgCreds.provider} 生成图像(约 5-30 秒)...`);
    btn.disabled = true;

    try {
      const res = await fetch('/api/cover-designer/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          ratio,
          imageProvider: imgCreds.provider,
          imageCredentials: imgCreds.credentials
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      renderGeneratedImage(resultBox, data, context, prompt, ratio);
    } catch (e) {
      resultBox.innerHTML = errorBlock(e.message);
    } finally { btn.disabled = false; }
  }

  function renderExpandedPrompt(container, d, kind) {
    const titleTip = d.titleOnCover ? `
      <div class="field" style="margin-bottom:10px">
        <div class="field-label">封面主标题</div>
        <div class="field-value" style="font-size:15px;font-weight:700;color:var(--pink-500)">${escapeHtml(d.titleOnCover)}</div>
        ${d.subtitle ? `<div class="field-value" style="font-size:12px;color:var(--ink-500);margin-top:2px">副标题:${escapeHtml(d.subtitle)}</div>` : ''}
      </div>` : '';

    const analysis = d.analysis ? `
      <div class="ref-analysis-box">
        <div class="ref-label">🔍 参考图分析</div>
        ${escapeHtml(d.analysis)}
      </div>
      ${d.keepFromRef?.length ? `<div class="field" style="margin-bottom:8px"><div class="field-label">保留元素</div><ul class="step-list">${d.keepFromRef.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>` : ''}
      ${d.changeFromRef?.length ? `<div class="field" style="margin-bottom:8px"><div class="field-label">调整点</div><ul class="step-list">${d.changeFromRef.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>` : ''}
    ` : '';

    container.innerHTML = `
      ${analysis}
      ${titleTip}
      <div class="prompt-copy-row">
        <span class="prompt-label">🇨🇳 中文</span>
        <textarea class="prompt-text" data-role="zh-prompt" style="border:none;background:transparent;resize:vertical;min-height:60px;font-family:inherit;padding:0;">${escapeHtml(d.zhPrompt || '')}</textarea>
        <button class="copy-tiny" data-copy="${escapeHtml(d.zhPrompt || '')}">📋</button>
      </div>
      <div class="prompt-copy-row">
        <span class="prompt-label">🇬🇧 EN</span>
        <textarea class="prompt-text" data-role="en-prompt" style="border:none;background:transparent;resize:vertical;min-height:60px;font-family:'SF Mono',Menlo,monospace;font-size:11px;padding:0;">${escapeHtml(d.enPrompt || '')}</textarea>
        <button class="copy-tiny" data-copy="${escapeHtml(d.enPrompt || '')}">📋</button>
      </div>
      <div class="hint" style="margin:8px 0;">💡 两段提示词都可编辑。生图时默认用 EN 提示词(图像模型多数对英文更敏感),如要强制用中文,清空 EN 再生成。</div>
      <div class="cd-generated-result"></div>
    `;

    // 复制按钮
    container.querySelectorAll('[data-copy]').forEach(b => {
      b.onclick = async () => {
        const text = b.dataset.copy;
        const parent = b.closest('.prompt-copy-row');
        const ta = parent?.querySelector('textarea');
        const actual = ta ? ta.value : text;
        try {
          await navigator.clipboard.writeText(actual);
          const old = b.textContent; b.textContent = '✓'; setTimeout(() => b.textContent = old, 1200);
        } catch { toast('复制失败'); }
      };
    });
  }

  function renderGeneratedImage(container, result, context, usedPrompt, ratio) {
    const src = result.imageBase64 || result.imageUrl;
    container.innerHTML = `
      <div class="cd-output-image-wrap">
        <img src="${escapeHtml(src)}" alt="生成的封面">
      </div>
      <div class="cd-result-actions">
        <a class="btn btn-primary btn-sm" href="${escapeHtml(src)}" download="cover-${ratio.replace(':', 'x')}-${Date.now()}.png">⬇ 下载</a>
        <button class="btn btn-secondary btn-sm" data-regen>🔄 换一张</button>
        <span class="hint" style="align-self:center;margin-left:4px">模型:${escapeHtml(result.provider || '')} · ${escapeHtml(result.model || '')}</span>
      </div>
      <div class="hint" style="margin-top:8px">生成用的提示词 (${context?.titleOnCover ? `标题:${escapeHtml(context.titleOnCover)}` : ''}):</div>
      <pre style="background:#f8f9fb;padding:8px 10px;border-radius:6px;font-size:11px;max-height:80px;overflow:auto;white-space:pre-wrap;word-break:break-all;">${escapeHtml(usedPrompt)}</pre>
    `;

    container.querySelector('[data-regen]').onclick = async () => {
      // 同样提示词再生一次
      const imgCreds = window.App.getImageCredentialsFor(FEATURE_ID);
      if (!imgCreds) return;
      const regenBtn = container.querySelector('[data-regen]');
      regenBtn.textContent = '生成中...';
      regenBtn.disabled = true;
      try {
        const res = await fetch('/api/cover-designer/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: usedPrompt, ratio, imageProvider: imgCreds.provider, imageCredentials: imgCreds.credentials })
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
        renderGeneratedImage(container, data, context, usedPrompt, ratio);
      } catch (e) {
        regenBtn.textContent = '🔄 换一张';
        regenBtn.disabled = false;
        toast('重试失败: ' + e.message, 'error');
      }
    };
  }

  function getEditedPrompt(kind) {
    const container = kind === 't2i' ? $('#cd-t2i-output') : $('#cd-ref-output');
    const en = container.querySelector('[data-role="en-prompt"]')?.value.trim();
    const zh = container.querySelector('[data-role="zh-prompt"]')?.value.trim();
    return en || zh || null;
  }
}

// ============ Utilities ============

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function urlToDataUrl(url) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function loadingBlock(text) {
  return `<div class="loading-inline"><span class="spinner"></span>${escapeHtml(text)}</div>`;
}
function errorBlock(msg) {
  return `<div class="error-inline">❌ ${escapeHtml(msg)}</div>`;
}
function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type} show`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2400);
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
