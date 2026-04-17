/**
 * 表情包设计助手前端
 * 5 个 tab + 提示词结构编辑器
 */

const STRUCT_STORAGE_KEY = 'opsAssistant.memeDesigner.v1';

// 3 套预设结构
const DEFAULT_STRUCTURES = [
  {
    id: 'preset-basic',
    name: '基础 (6 字段)',
    isPreset: true,
    fields: [
      { key: 'style', desc: '画面风格 (如:扁平插画 / 像素风 / 贴纸风 / 赛璐璐)' },
      { key: 'subject', desc: '主体 (人/动物/物品 及其特征)' },
      { key: 'expression', desc: '表情 / 动作' },
      { key: 'composition', desc: '构图 / 视角' },
      { key: 'color', desc: '色调 / 配色' },
      { key: 'text', desc: '画面中的文字 (如果有)' }
    ]
  },
  {
    id: 'preset-detailed',
    name: '详细 (10 字段)',
    isPreset: true,
    fields: [
      { key: 'style', desc: '画面风格' },
      { key: 'subject', desc: '主体对象' },
      { key: 'age_gender', desc: '年龄 / 性别 / 身份' },
      { key: 'expression', desc: '表情 / 情绪' },
      { key: 'action', desc: '动作 / 姿势' },
      { key: 'outfit', desc: '服装 / 装扮' },
      { key: 'composition', desc: '构图 / 景别' },
      { key: 'lighting', desc: '光影效果' },
      { key: 'color', desc: '主色调' },
      { key: 'text', desc: '文字 (如果有)' }
    ]
  },
  {
    id: 'preset-aiart',
    name: 'AI 绘图专用',
    isPreset: true,
    fields: [
      { key: 'medium', desc: '媒介 (illustration / 3d render / photograph 等)' },
      { key: 'subject', desc: '主体描述' },
      { key: 'style_ref', desc: '风格参考 (Pixar / 新海诚 / flat design 等)' },
      { key: 'mood', desc: '情绪氛围 (wholesome / dramatic / melancholic)' },
      { key: 'composition', desc: '构图 (close-up / wide / centered)' },
      { key: 'lighting', desc: '光照 (soft / neon / golden hour)' },
      { key: 'palette', desc: '调色板 (pastel / vibrant / monochrome)' },
      { key: 'details', desc: '细节 & 关键元素' }
    ]
  }
];

function loadStructs() {
  try {
    const data = JSON.parse(localStorage.getItem(STRUCT_STORAGE_KEY));
    if (data?.promptStructures?.length) return data;
  } catch {}
  return { promptStructures: DEFAULT_STRUCTURES.map(s => JSON.parse(JSON.stringify(s))) };
}
function saveStructs(data) {
  localStorage.setItem(STRUCT_STORAGE_KEY, JSON.stringify(data));
}

// =========================== MOUNT ===========================

export function mount(root) {
  const state = {
    image: null,
    activeTab: 'reverse'
  };

  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => [...root.querySelectorAll(sel)];

  // ---------- Model status bar ----------
  function refreshModelBar() {
    const dot = $('#md-model-dot');
    const name = $('#md-model-name');
    const visionBadge = $('#md-model-vision');
    const warn = $('#md-vision-warn');

    const def = window.App?.getActiveProviderDef?.();
    const cred = window.App?.getCredentials?.();
    if (cred && def) {
      dot.className = 'model-dot ok';
      name.textContent = `当前模型: ${def.name}`;
      visionBadge.hidden = !def.vision;
    } else {
      dot.className = 'model-dot warn';
      name.textContent = '未配置 LLM API Key';
      visionBadge.hidden = true;
    }

    // 反推 tab 的 Vision 警告
    const hasVision = window.App?.hasVisionModel?.();
    if (warn) warn.hidden = Boolean(hasVision);
  }
  refreshModelBar();
  window.addEventListener('storage', refreshModelBar);

  $('#md-btn-settings').onclick = () => window.App?.openSettings?.();
  $('#md-btn-switch-vision').onclick = () => {
    const visionProviders = window.App?.listVisionProviders?.() || [];
    const firstConfigured = visionProviders.find(p => {
      const cfg = JSON.parse(localStorage.getItem('opsAssistant.llm.v2') || '{}');
      return cfg.providers?.[p.id]?.apiKey;
    });
    if (firstConfigured) {
      window.App.switchProvider(firstConfigured.id);
      refreshModelBar();
      toast(`✓ 已切换到 ${firstConfigured.name}`);
    } else {
      window.App?.openSettings?.(visionProviders[0]?.id);
    }
  };

  // ---------- Tabs ----------
  $$('.md-tab').forEach(tab => {
    tab.onclick = () => {
      state.activeTab = tab.dataset.tab;
      $$('.md-tab').forEach(t => t.classList.toggle('active', t === tab));
      $$('.md-tab-pane').forEach(p => p.hidden = p.dataset.pane !== state.activeTab);
      // 进入搜索 tab 检查 Serper 配置
      if (state.activeTab === 'search') refreshSearchWarn();
    };
  });

  // ---------- Structure dropdowns ----------
  function refreshStructureDropdowns() {
    const data = loadStructs();
    const sels = [$('#md-rev-structure'), $('#md-gen-structure')];
    sels.forEach(sel => {
      if (!sel) return;
      const cur = sel.value;
      sel.innerHTML = '';
      data.promptStructures.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name + (s.isPreset ? '' : ' ✏️');
        sel.appendChild(opt);
      });
      if (cur && data.promptStructures.find(s => s.id === cur)) sel.value = cur;
    });
  }
  refreshStructureDropdowns();

  function currentStructure(selector) {
    const id = $(selector).value;
    const data = loadStructs();
    return data.promptStructures.find(s => s.id === id) || data.promptStructures[0];
  }

  // ---------- Image upload ----------
  const fileInput = $('#md-file');
  const dropzone = $('#md-dropzone');
  const preview = $('#md-preview');
  const previewImg = $('#md-preview-img');

  function setImage(dataUrl) {
    state.image = dataUrl;
    previewImg.src = dataUrl;
    preview.hidden = false;
    dropzone.hidden = true;
  }
  function clearImage() {
    state.image = null;
    previewImg.src = '';
    preview.hidden = true;
    dropzone.hidden = false;
  }

  dropzone.onclick = () => fileInput.click();
  fileInput.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (file) setImage(await fileToDataUrl(file));
  };
  dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('dragover'); };
  dropzone.ondragleave = () => dropzone.classList.remove('dragover');
  dropzone.ondrop = async (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) setImage(await fileToDataUrl(file));
  };
  $('#md-clear-img').onclick = clearImage;

  // 粘贴支持
  const pasteHandler = async (e) => {
    if (state.activeTab !== 'reverse') return;
    const items = e.clipboardData?.items || [];
    for (const it of items) {
      if (it.type.startsWith('image/')) {
        const file = it.getAsFile();
        if (file) {
          e.preventDefault();
          setImage(await fileToDataUrl(file));
          return;
        }
      }
    }
  };
  document.addEventListener('paste', pasteHandler);

  // ---------- Reverse ----------
  $('#md-btn-reverse').onclick = async () => {
    if (!state.image) { toast('请先上传一张图片', 'error'); return; }
    if (!window.App?.hasVisionModel?.()) {
      toast('当前模型不支持识图,请切换到 OpenAI / 通义千问', 'error');
      return;
    }
    const creds = window.App?.getCredentials?.();
    if (!creds) { toast('请先配置 LLM API Key', 'error'); window.App?.openSettings?.(); return; }

    const out = $('#md-rev-output');
    out.innerHTML = loadingBlock('正在反推…');
    const btn = $('#md-btn-reverse');
    btn.disabled = true;

    try {
      const res = await fetch('/api/meme-designer/reverse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: state.image,
          structure: currentStructure('#md-rev-structure'),
          artStyle: $('#md-rev-style').value,
          ...creds
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      renderPromptBlock(out, data);
    } catch (e) {
      out.innerHTML = errorBlock(e.message);
    } finally { btn.disabled = false; }
  };

  // ---------- Generate ----------
  $('#md-btn-generate').onclick = async () => {
    const desc = $('#md-gen-desc').value.trim();
    if (!desc) { toast('请输入描述', 'error'); return; }
    const creds = window.App?.getCredentials?.();
    if (!creds) { toast('请先配置 LLM API Key', 'error'); window.App?.openSettings?.(); return; }

    const out = $('#md-gen-output');
    out.innerHTML = loadingBlock('正在生成 3 个方案…');
    const btn = $('#md-btn-generate');
    btn.disabled = true;

    try {
      const res = await fetch('/api/meme-designer/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: desc,
          structure: currentStructure('#md-gen-structure'),
          artStyle: $('#md-gen-style').value,
          ...creds
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      renderVariants(out, data.variants || []);
    } catch (e) {
      out.innerHTML = errorBlock(e.message);
    } finally { btn.disabled = false; }
  };

  // ---------- Captions ----------
  $('#md-btn-captions').onclick = async () => {
    const scene = $('#md-cap-scene').value.trim();
    if (!scene) { toast('请描述场景或情绪', 'error'); return; }
    const creds = window.App?.getCredentials?.();
    if (!creds) { toast('请先配置 LLM API Key', 'error'); window.App?.openSettings?.(); return; }

    const out = $('#md-cap-output');
    out.innerHTML = loadingBlock('正在生成候选文案…');
    const btn = $('#md-btn-captions');
    btn.disabled = true;

    try {
      const res = await fetch('/api/meme-designer/captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scene, ...creds })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      renderCaptions(out, data.captions || []);
    } catch (e) {
      out.innerHTML = errorBlock(e.message);
    } finally { btn.disabled = false; }
  };

  // ---------- Gallery ----------
  $('#md-btn-gallery').onclick = async () => {
    const theme = $('#md-gal-theme').value.trim();
    if (!theme) { toast('请输入主题', 'error'); return; }
    const creds = window.App?.getCredentials?.();
    if (!creds) { toast('请先配置 LLM API Key', 'error'); window.App?.openSettings?.(); return; }

    const out = $('#md-gal-output');
    out.innerHTML = loadingBlock('正在推荐模板…');
    const btn = $('#md-btn-gallery');
    btn.disabled = true;

    try {
      const res = await fetch('/api/meme-designer/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, ...creds })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      renderGallery(out, data.templates || [], $('#md-search-q'));
    } catch (e) {
      out.innerHTML = errorBlock(e.message);
    } finally { btn.disabled = false; }
  };

  // ---------- Search ----------
  function refreshSearchWarn() {
    const warn = $('#md-search-warn');
    const cred = window.App?.getSearchCredentials?.();
    if (warn) warn.hidden = Boolean(cred);
  }
  $('#md-btn-config-search').onclick = () => window.App?.openSettings?.('serper', 'search');

  $('#md-btn-search').onclick = async () => {
    const q = $('#md-search-q').value.trim();
    if (!q) { toast('请输入关键词', 'error'); return; }
    const searchCred = window.App?.getSearchCredentials?.();
    if (!searchCred) {
      toast('请先配置 Serper API Key', 'error');
      window.App?.openSettings?.('serper', 'search');
      return;
    }

    const out = $('#md-search-output');
    out.innerHTML = loadingBlock('正在搜索…');
    const btn = $('#md-btn-search');
    btn.disabled = true;

    try {
      const res = await fetch('/api/meme-designer/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, searchCredentials: searchCred })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      renderSearchResults(out, data.results || []);
    } catch (e) {
      out.innerHTML = errorBlock(e.message);
    } finally { btn.disabled = false; }
  };

  // 回车触发搜索
  $('#md-search-q').onkeydown = (e) => {
    if (e.key === 'Enter') $('#md-btn-search').click();
  };

  // ---------- Structure editor ----------
  $('#md-btn-edit-structures').onclick = openStructureEditor;

  function openStructureEditor() {
    const modal = $('#md-structures-modal');
    modal.hidden = false;
    renderStructList();
  }
  function closeStructureEditor() {
    $('#md-structures-modal').hidden = true;
    refreshStructureDropdowns();
  }
  $$('[data-close-structures]').forEach(el => el.onclick = closeStructureEditor);

  function renderStructList() {
    const list = $('#md-struct-list');
    const editor = $('#md-struct-editor');
    const data = loadStructs();
    list.innerHTML = '';
    data.promptStructures.forEach(s => {
      const row = document.createElement('div');
      row.className = 'struct-row';
      row.innerHTML = `
        <div class="struct-row-name">${escapeHtml(s.name)} ${s.isPreset ? '<span class="struct-badge">预设</span>' : '<span class="struct-badge custom">自定义</span>'}</div>
        <div class="struct-row-meta">${s.fields.length} 个字段</div>
        <button class="btn btn-ghost btn-sm struct-btn-edit" data-id="${s.id}">编辑</button>
        ${s.isPreset ? '' : `<button class="btn btn-ghost btn-sm struct-btn-del" data-id="${s.id}">删除</button>`}
      `;
      list.appendChild(row);
    });
    list.querySelectorAll('.struct-btn-edit').forEach(b => b.onclick = () => editStructure(b.dataset.id));
    list.querySelectorAll('.struct-btn-del').forEach(b => b.onclick = () => deleteStructure(b.dataset.id));
    editor.innerHTML = '';
  }

  function editStructure(id) {
    const data = loadStructs();
    const s = data.promptStructures.find(x => x.id === id);
    if (!s) return;
    const editor = $('#md-struct-editor');
    editor.innerHTML = `
      <div class="struct-editor">
        <div class="form-row">
          <label class="form-label">结构名称</label>
          <input type="text" id="se-name" value="${escapeHtml(s.name)}">
        </div>
        <div class="form-label" style="margin-top:10px">字段列表</div>
        <div class="field-list" id="se-fields">
          ${s.fields.map((f, i) => fieldRow(f, i)).join('')}
        </div>
        <button class="btn btn-ghost btn-sm" id="se-add-field" style="margin-top:8px">➕ 添加字段</button>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn btn-secondary btn-sm" id="se-cancel">取消</button>
          <button class="btn btn-primary btn-sm" id="se-save">保存</button>
        </div>
      </div>
    `;
    bindFieldRowEvents(editor);
    $('#se-add-field').onclick = () => {
      const list = $('#se-fields');
      const idx = list.children.length;
      list.insertAdjacentHTML('beforeend', fieldRow({ key: '', desc: '' }, idx));
      bindFieldRowEvents(editor);
    };
    $('#se-cancel').onclick = () => { editor.innerHTML = ''; };
    $('#se-save').onclick = () => {
      const name = $('#se-name').value.trim() || '未命名结构';
      const rows = [...$('#se-fields').querySelectorAll('.field-row')];
      const fields = rows.map(r => ({
        key: r.querySelector('.f-key').value.trim(),
        desc: r.querySelector('.f-desc').value.trim()
      })).filter(f => f.key);
      if (!fields.length) { toast('至少保留一个字段', 'error'); return; }
      const data = loadStructs();
      const target = data.promptStructures.find(x => x.id === id);
      target.name = name;
      target.fields = fields;
      saveStructs(data);
      toast('✓ 已保存');
      renderStructList();
    };
  }

  function fieldRow(f, i) {
    return `
      <div class="field-row">
        <input type="text" class="f-key" placeholder="字段 key (如 style)" value="${escapeHtml(f.key || '')}">
        <input type="text" class="f-desc" placeholder="描述 (LLM 会据此填内容)" value="${escapeHtml(f.desc || '')}">
        <button type="button" class="btn btn-ghost btn-sm f-del">×</button>
      </div>
    `;
  }
  function bindFieldRowEvents(scope) {
    scope.querySelectorAll('.f-del').forEach(b => {
      b.onclick = () => b.closest('.field-row').remove();
    });
  }

  function deleteStructure(id) {
    if (!confirm('确定删除这个自定义结构?')) return;
    const data = loadStructs();
    data.promptStructures = data.promptStructures.filter(x => x.id !== id);
    saveStructs(data);
    renderStructList();
    refreshStructureDropdowns();
    toast('已删除');
  }

  $('#md-btn-add-struct').onclick = () => {
    const data = loadStructs();
    const newStruct = {
      id: 'cust-' + Date.now(),
      name: '新结构',
      isPreset: false,
      fields: [{ key: 'style', desc: '画面风格' }]
    };
    data.promptStructures.push(newStruct);
    saveStructs(data);
    renderStructList();
    editStructure(newStruct.id);
  };

  $('#md-struct-reset').onclick = () => {
    if (!confirm('确定把 3 套预设恢复成默认?(自定义结构不受影响)')) return;
    const data = loadStructs();
    const customs = data.promptStructures.filter(s => !s.isPreset);
    data.promptStructures = [...DEFAULT_STRUCTURES.map(s => JSON.parse(JSON.stringify(s))), ...customs];
    saveStructs(data);
    renderStructList();
    toast('✓ 预设已重置');
  };
}

// =========================== RENDERERS ===========================

function renderPromptBlock(root, d) {
  const fieldRows = d.fields ? Object.entries(d.fields).map(([k, v]) => `
    <div class="kv-row"><span class="kv-k">${escapeHtml(k)}</span><span class="kv-v">${escapeHtml(v)}</span></div>
  `).join('') : '';
  const captions = (d.captionSuggestions || []).map(c => `<div class="caption-chip">${escapeHtml(c)} <button class="copy-tiny" data-copy="${escapeHtml(c)}">📋</button></div>`).join('');

  root.innerHTML = `
    <div class="result-section">
      <div class="section-title">📋 结构字段</div>
      ${fieldRows || '<div class="empty small">无数据</div>'}
    </div>
    <div class="result-section">
      <div class="section-title">🇨🇳 中文提示词 <button class="copy-btn" data-copy="${escapeHtml(d.zhPrompt || '')}">复制</button></div>
      <div class="prompt-box">${escapeHtml(d.zhPrompt || '')}</div>
    </div>
    <div class="result-section">
      <div class="section-title">🇬🇧 英文提示词 <button class="copy-btn" data-copy="${escapeHtml(d.enPrompt || '')}">复制</button></div>
      <div class="prompt-box en">${escapeHtml(d.enPrompt || '')}</div>
    </div>
    ${captions ? `<div class="result-section"><div class="section-title">💬 配文候选</div><div class="caption-grid">${captions}</div></div>` : ''}
  `;
  bindCopy(root);
}

function renderVariants(root, variants) {
  if (!variants.length) { root.innerHTML = `<div class="empty small">LLM 返回为空</div>`; return; }
  root.innerHTML = variants.map((v, i) => `
    <div class="variant-card">
      <div class="variant-header">
        <strong>${escapeHtml(v.label || `方案 ${i + 1}`)}</strong>
      </div>
      <div class="variant-row">
        <span class="kv-k">🇨🇳</span>
        <span class="prompt-inline">${escapeHtml(v.zhPrompt || '')}</span>
        <button class="copy-tiny" data-copy="${escapeHtml(v.zhPrompt || '')}">📋</button>
      </div>
      <div class="variant-row">
        <span class="kv-k">🇬🇧</span>
        <span class="prompt-inline">${escapeHtml(v.enPrompt || '')}</span>
        <button class="copy-tiny" data-copy="${escapeHtml(v.enPrompt || '')}">📋</button>
      </div>
      ${v.captionSuggestions?.length ? `
        <div class="variant-captions">
          ${v.captionSuggestions.map(c => `<span class="caption-chip">${escapeHtml(c)} <button class="copy-tiny" data-copy="${escapeHtml(c)}">📋</button></span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');
  bindCopy(root);
}

function renderCaptions(root, captions) {
  if (!captions.length) { root.innerHTML = `<div class="empty small">LLM 返回为空</div>`; return; }
  root.innerHTML = captions.map(c => `
    <div class="caption-card">
      <div class="caption-tone">${escapeHtml(c.tone || '')}</div>
      <div class="caption-text">${escapeHtml(c.text || '')}</div>
      ${c.why ? `<div class="caption-why">${escapeHtml(c.why)}</div>` : ''}
      <button class="copy-tiny" data-copy="${escapeHtml(c.text || '')}">📋 复制</button>
    </div>
  `).join('');
  bindCopy(root);
}

function renderGallery(root, templates, searchInput) {
  if (!templates.length) { root.innerHTML = `<div class="empty small">LLM 返回为空</div>`; return; }
  root.innerHTML = templates.map(t => `
    <div class="template-item">
      <div class="template-name">${escapeHtml(t.name || '')}</div>
      <div class="template-visual">${escapeHtml(t.visual || '')}</div>
      <div class="template-when"><strong>适合:</strong> ${escapeHtml(t.when || '')}</div>
      ${t.exampleCaption ? `<div class="template-caption">💬 ${escapeHtml(t.exampleCaption)}</div>` : ''}
      ${t.searchKeyword ? `<button class="btn btn-secondary btn-sm template-search" data-kw="${escapeHtml(t.searchKeyword)}">🔍 搜图 "${escapeHtml(t.searchKeyword)}"</button>` : ''}
    </div>
  `).join('');
  root.querySelectorAll('.template-search').forEach(b => {
    b.onclick = () => {
      const kw = b.dataset.kw;
      const qInput = document.querySelector('#md-search-q');
      qInput.value = kw;
      document.querySelector('[data-tab="search"]').click();
      document.querySelector('#md-btn-search').click();
    };
  });
}

function renderSearchResults(root, results) {
  if (!results.length) { root.innerHTML = `<div class="empty small">没搜到,换个关键词试试</div>`; return; }
  root.innerHTML = `
    <div class="search-grid">
      ${results.map(r => `
        <a class="search-card" href="${escapeHtml(r.sourceUrl || r.imageUrl)}" target="_blank" rel="noopener">
          <img src="${escapeHtml(r.thumbnail || r.imageUrl)}" alt="${escapeHtml(r.title || '')}" loading="lazy" referrerpolicy="no-referrer">
          <div class="search-title">${escapeHtml((r.title || '').slice(0, 60))}</div>
          <div class="search-source">${escapeHtml(r.source || '')}</div>
        </a>
      `).join('')}
    </div>
  `;
}

function bindCopy(root) {
  root.querySelectorAll('[data-copy]').forEach(btn => {
    btn.onclick = async (e) => {
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        const old = btn.textContent;
        btn.textContent = '✓';
        setTimeout(() => btn.textContent = old, 1200);
      } catch { toast('复制失败'); }
    };
  });
}

// =========================== UTILITIES ===========================

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
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
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
