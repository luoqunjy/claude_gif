/**
 * 爆款表情工厂 · 前端
 *
 * P0 实现: 文字表情 tab 完整流程 + 结构模板管理器 + 反推(优化版)
 * P1 预留: 角色表情 tab (placeholder)
 * P2 预留: 动画化 GIF tab (placeholder)
 */

const LS_TPL = 'emojiStudio.templates.v1';
const LS_CHARS = 'emojiStudio.characters.v1';
const CHARS_MAX = 15;

export async function mount(root) {
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];

  // ---- Model chips ----
  if (window.App?.createModelChip) {
    $('#es-llm-chip').appendChild(window.App.createModelChip({ featureId: 'emoji-studio', type: 'llm' }));
    $('#es-img-chip').appendChild(window.App.createModelChip({ featureId: 'emoji-studio', type: 'imageGen' }));
  }
  $('#es-btn-settings').addEventListener('click', () => window.App?.openSettings?.());

  // ---- Load templates (presets from backend + user localStorage overlay) ----
  let presets = [];
  try {
    presets = await (await fetch('/api/emoji-studio/presets')).json();
  } catch (e) { presets = []; }
  let templates = loadTemplates(presets);
  renderTplSelects();

  // ---- Characters (P1) ----
  let characters = loadCharacters();
  let selectedChar = null;
  renderCharTplSelect();
  renderCharCurrent();

  // ---- Character tab handlers ----
  const charCountEl = $('#es-char-count');
  charCountEl?.addEventListener('input', () => {
    $('#es-char-count-val').textContent = charCountEl.value;
    $('#es-char-count-display').textContent = charCountEl.value;
  });
  const charRatioRow = $('#es-char-ratio');
  charRatioRow?.addEventListener('click', (e) => {
    const chip = e.target.closest('.es-ratio-chip'); if (!chip) return;
    charRatioRow.querySelectorAll('.es-ratio-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });
  $('#es-btn-chars')?.addEventListener('click', openCharModal);
  $('#es-btn-upload-char')?.addEventListener('click', () => pickFile(async (file) => {
    const dataUrl = await readAsDataURL(file);
    const ch = addCharacter({ refImage: dataUrl, name: file.name.replace(/\.[^.]+$/, '').slice(0, 20) || '新角色' });
    selectChar(ch);
  }));
  $('#es-btn-edit-tpl-char')?.addEventListener('click', () => openTplModal($('#es-char-tpl').value));
  $('#es-btn-char-run')?.addEventListener('click', runCharacterPipeline);

  // Paste char image
  window.addEventListener('paste', (e) => {
    if (document.querySelector('.es-tab.active')?.dataset.tab !== 'character') return;
    if (document.querySelector('.es-modal.on')) return;
    const items = e.clipboardData?.items || [];
    for (const it of items) {
      if (it.type.startsWith('image/')) {
        const f = it.getAsFile(); if (!f) continue;
        readAsDataURL(f).then(dataUrl => {
          const ch = addCharacter({ refImage: dataUrl, name: '粘贴角色-' + new Date().toISOString().slice(11, 16) });
          selectChar(ch);
          toast('角色已入库');
        });
        break;
      }
    }
  });

  // ---- Tab switching ----
  $$('.es-tab').forEach(t => {
    t.addEventListener('click', () => {
      $$('.es-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      const tab = t.dataset.tab;
      $$('[data-tab-body]').forEach(b => { b.hidden = b.dataset.tabBody !== tab; });
    });
  });

  // ---- Ratio chips ----
  const ratioRow = $('#es-ratio');
  ratioRow.addEventListener('click', (e) => {
    const chip = e.target.closest('.es-ratio-chip'); if (!chip) return;
    ratioRow.querySelectorAll('.es-ratio-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });

  // ---- Count slider ----
  const countEl = $('#es-count');
  countEl.addEventListener('input', () => {
    $('#es-count-val').textContent = countEl.value;
    $('#es-count-display').textContent = countEl.value;
  });

  // ---- Run: fill + generate ----
  $('#es-btn-run').addEventListener('click', () => runPipeline({ fillOnly: false }));
  $('#es-btn-fillonly').addEventListener('click', () => runPipeline({ fillOnly: true }));

  async function runPipeline({ fillOnly }) {
    const desc = $('#es-desc').value.trim();
    if (!desc) { toast('请填写描述'); return; }
    const tpl = getCurrentTemplate();
    if (!tpl) { toast('请选择一个模板'); return; }
    const count = parseInt(countEl.value, 10);
    const ratio = ratioRow.querySelector('.es-ratio-chip.active')?.dataset.r || '1:1';

    const llmCred = window.App.getCredentialsFor('emoji-studio');
    if (!llmCred) { toast('请先配置文本模型 API Key'); window.App?.openSettings?.(); return; }

    const imgCred = !fillOnly ? window.App.getImageCredentialsFor('emoji-studio') : null;
    if (!fillOnly && !imgCred) { toast('请先配置图像模型 API Key'); window.App?.openSettings?.('jimeng', 'imageGen'); return; }

    const btn = fillOnly ? $('#es-btn-fillonly') : $('#es-btn-run');
    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = '🌀 填词中...';

    const out = $('#es-output');
    out.innerHTML = loadingBlock('AI 正在按模板填词...');

    try {
      // Step 1: fill
      const fillRes = await fetch('/api/emoji-studio/fill', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: desc,
          template: tpl,
          count,
          ...llmCred
        })
      }).then(r => r.json());
      if (fillRes.error) throw new Error(fillRes.error === 'llm_parse_failed' ? '模型输出格式问题,重试一次' : fillRes.error);

      const variants = fillRes.variants || [];
      renderOutput({ variants, images: null, ratio, fillOnly });

      if (fillOnly) {
        setBtn(btn, false, origText); return;
      }

      // Step 2: batch generate
      btn.textContent = `🎨 生图中 0/${variants.length}...`;
      const imgRes = await fetch('/api/emoji-studio/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompts: variants.map(v => v.enPrompt || v.zhPrompt || ''),
          ratio,
          imageProvider: imgCred.provider,
          imageCredentials: imgCred.credentials
        })
      }).then(r => r.json());
      if (imgRes.error) throw new Error(imgRes.error);

      renderOutput({ variants, images: imgRes.images, ratio, fillOnly: false });
    } catch (e) {
      out.innerHTML = `<div class="es-err">❌ ${escapeHtml(e.message)}</div>`;
    } finally {
      setBtn(btn, false, origText);
    }
  }

  function setBtn(b, disabled, text) { b.disabled = disabled; b.textContent = text; }

  function renderOutput({ variants, images, ratio, fillOnly }) {
    const out = $('#es-output');
    const hasImgs = images && images.length;
    // Stash for matting handlers to access
    window.__esLastImages = images || [];

    out.innerHTML = `
      <div class="es-output">
        <div>
          <div class="es-section-title">
            ✍ AI 填好的提示词变体 <span class="count">${variants.length}</span>
            <span class="spacer"></span>
            ${fillOnly ? `<button class="es-btn sm" id="es-gen-from-fill">🎨 用这些提示词生图</button>` : ''}
          </div>
          <div class="es-var-list">
            ${variants.map((v, i) => `
              <div class="es-var">
                <div class="vh">
                  <span class="vn">#${i + 1}</span>
                  ${v.caption ? `<span class="vc">${escapeHtml(v.caption)}</span>` : ''}
                  <span style="flex:1"></span>
                  <button class="es-btn sm" data-copy-p="${i}">📋 复制</button>
                </div>
                <div class="vp">${escapeHtml(v.zhPrompt || v.enPrompt || '')}</div>
              </div>
            `).join('')}
          </div>
        </div>

        ${hasImgs ? `
        <div>
          <div class="es-section-title">
            🖼️ 生成结果 <span class="count">${images.filter(x => x.ok).length}/${images.length}</span>
            <span class="spacer"></span>
            <button class="es-btn sm" id="es-dl-all">⬇ 打包下载全部</button>
          </div>
          <div class="es-batch-bar" id="es-batch-bar">
            <span>批量操作:</span>
            <button class="es-btn sm" id="es-mat-all">✂ 全部抠图</button>
            <span class="provider" id="es-mat-provider">${renderMattingLabel()}</span>
            <span style="flex:1"></span>
            <span style="color:var(--ink-500);font-size:11px" id="es-char-add-last">🎪 P2: 发送到动画化</span>
          </div>
          <div class="es-imgs" id="es-img-grid">
            ${images.map((im, i) => renderImgCell(im, i)).join('')}
          </div>
        </div>` : ''}
      </div>
    `;

    out.querySelectorAll('[data-copy-p]').forEach(b => {
      b.addEventListener('click', () => {
        const i = parseInt(b.dataset.copyP, 10);
        const v = variants[i]; if (!v) return;
        const txt = `【中文】${v.zhPrompt || ''}\n\n【English】${v.enPrompt || ''}`;
        navigator.clipboard?.writeText(txt).then(() => toast('已复制'));
      });
    });

    if (hasImgs) {
      out.querySelectorAll('[data-dl]').forEach(b => {
        b.addEventListener('click', () => {
          const idx = parseInt(b.dataset.dl, 10);
          const im = images[idx]; if (!im?.imageBase64 && !im?.imageUrl) return;
          downloadImage(im.imageBase64 || im.imageUrl, `表情包-${Date.now()}-${idx + 1}.png`);
        });
      });
      out.querySelector('#es-dl-all')?.addEventListener('click', async () => {
        for (let i = 0; i < images.length; i++) {
          const im = images[i]; if (!im?.ok) continue;
          downloadImage(im.imageBase64 || im.imageUrl, `表情包-${Date.now()}-${i + 1}.png`);
          await delay(120);
        }
      });
    }

    out.querySelector('#es-gen-from-fill')?.addEventListener('click', () => {
      // Re-run as full pipeline with existing variants(注:简化,重跑整条)
      runPipeline({ fillOnly: false });
    });

    // Per-cell matting handlers
    out.querySelectorAll('[data-mat]').forEach(b => {
      b.addEventListener('click', () => {
        const i = parseInt(b.dataset.mat, 10);
        matSingle(i);
      });
    });

    // Batch matting handler
    out.querySelector('#es-mat-all')?.addEventListener('click', () => matBatch());
  }

  function renderImgCell(im, idx) {
    if (!im.ok) {
      return `<div class="es-img"><div class="es-img-fail">❌ ${escapeHtml(im.error || '生成失败')}</div></div>`;
    }
    const src = im.matted?.imageBase64 || im.matted?.imageUrl || im.imageBase64 || im.imageUrl;
    const hasAlpha = Boolean(im.matted);
    return `
      <div class="es-img ${hasAlpha ? 'has-alpha' : ''}" data-cell="${idx}">
        <img src="${escapeAttr(src)}" alt="">
        ${hasAlpha ? '<span class="matted-tag">✓ 已抠</span>' : ''}
        <div class="es-img-actions">
          <button class="es-img-btn" data-dl="${idx}" title="下载">⬇</button>
          <button class="es-img-btn" data-mat="${idx}" title="抠图去背景">✂</button>
          <button class="es-img-btn" title="动画化 (P2)" disabled style="opacity:.5">🎬</button>
        </div>
      </div>
    `;
  }

  function renderMattingLabel() {
    const mc = window.App?.getMattingCredentialsFor?.('emoji-studio');
    if (!mc) return '✂ 未配置抠图';
    return `✂ ${mc.provider}`;
  }

  // state for matting: lastImages[idx] keeps original + matted urls
  let mattedImages = []; // parallel array to lastRenderedImages

  async function matSingle(idx) {
    const cell = document.querySelector(`.es-img[data-cell="${idx}"]`);
    if (!cell) return;
    const images = getLastImages();
    const im = images[idx]; if (!im?.ok) return;
    const src = im.imageBase64 || im.imageUrl;
    const cred = window.App.getMattingCredentialsFor('emoji-studio');
    if (!cred) { toast('请先配置抠图服务 (Replicate 推荐)'); window.App?.openSettings?.('replicate', 'matting'); return; }

    cell.classList.add('matting');
    try {
      const res = await fetch('/api/emoji-studio/matting', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: [src], provider: cred.provider, credentials: cred.credentials })
      }).then(r => r.json());
      if (res.error) throw new Error(res.error);
      const out0 = res.images?.[0];
      if (!out0?.ok) throw new Error(out0?.error || '抠图失败');
      im.matted = { imageBase64: out0.imageBase64, imageUrl: out0.imageUrl };
      // Re-render just this cell
      const newHtml = renderImgCell(im, idx);
      const wrap = document.createElement('div');
      wrap.innerHTML = newHtml;
      cell.replaceWith(wrap.firstElementChild);
      // Re-bind cell actions
      document.querySelector(`.es-img[data-cell="${idx}"] [data-dl]`)?.addEventListener('click', () => {
        const im2 = images[idx];
        const src2 = im2.matted?.imageBase64 || im2.matted?.imageUrl || im2.imageBase64 || im2.imageUrl;
        downloadImage(src2, `表情包-抠图-${Date.now()}-${idx + 1}.png`);
      });
      document.querySelector(`.es-img[data-cell="${idx}"] [data-mat]`)?.addEventListener('click', () => matSingle(idx));
      toast('抠图完成');
    } catch (e) {
      cell.classList.remove('matting');
      toast('抠图失败: ' + e.message);
    }
  }

  async function matBatch() {
    const images = getLastImages();
    const pending = images.map((im, i) => ({ im, i })).filter(x => x.im.ok && !x.im.matted);
    if (!pending.length) { toast('没有可抠的图'); return; }
    const cred = window.App.getMattingCredentialsFor('emoji-studio');
    if (!cred) { toast('请先配置抠图服务'); window.App?.openSettings?.('replicate', 'matting'); return; }

    pending.forEach(({ i }) => {
      document.querySelector(`.es-img[data-cell="${i}"]`)?.classList.add('matting');
    });

    try {
      const res = await fetch('/api/emoji-studio/matting', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: pending.map(p => p.im.imageBase64 || p.im.imageUrl),
          provider: cred.provider, credentials: cred.credentials
        })
      }).then(r => r.json());
      if (res.error) throw new Error(res.error);

      pending.forEach(({ im, i }, k) => {
        const out = res.images?.[k];
        if (out?.ok) im.matted = { imageBase64: out.imageBase64, imageUrl: out.imageUrl };
      });
      // Full re-render the grid
      const grid = document.getElementById('es-img-grid');
      if (grid) grid.innerHTML = images.map((im, i) => renderImgCell(im, i)).join('');
      // Re-bind handlers
      grid?.querySelectorAll('[data-dl]').forEach(b => {
        const i = parseInt(b.dataset.dl, 10);
        b.addEventListener('click', () => {
          const im2 = images[i];
          const src2 = im2.matted?.imageBase64 || im2.matted?.imageUrl || im2.imageBase64 || im2.imageUrl;
          downloadImage(src2, `表情包-${Date.now()}-${i + 1}.png`);
        });
      });
      grid?.querySelectorAll('[data-mat]').forEach(b => {
        const i = parseInt(b.dataset.mat, 10);
        b.addEventListener('click', () => matSingle(i));
      });
      toast(`批量抠图完成 · 成功 ${pending.filter(({im}) => im.matted).length}/${pending.length}`);
    } catch (e) {
      pending.forEach(({ i }) => document.querySelector(`.es-img[data-cell="${i}"]`)?.classList.remove('matting'));
      toast('批量抠图失败: ' + e.message);
    }
  }

  function getLastImages() {
    // The renderOutput() call stashes images in closure; read from DOM-accessible way:
    // simpler: stash on window for this panel instance
    return window.__esLastImages || [];
  }

  function downloadImage(src, filename) {
    const a = document.createElement('a');
    a.href = src; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  }

  // =========== Template Manager ===========
  const modalTpl = $('#es-modal-tpl');
  $('#es-btn-templates').addEventListener('click', openTplModal);
  $('#es-btn-edit-tpl').addEventListener('click', () => openTplModal(currentTplId()));
  modalTpl.querySelectorAll('[data-close-tpl]').forEach(el => el.addEventListener('click', () => modalTpl.classList.remove('on')));

  let editingId = null;

  function openTplModal(selectId) {
    modalTpl.classList.add('on');
    editingId = selectId || templates[0]?.id || null;
    renderTplList();
    renderTplEditor();
  }

  function renderTplList() {
    const box = $('#es-tpl-listbox');
    box.innerHTML = templates.map(t => `
      <div class="es-tpl-item ${t.id === editingId ? 'active' : ''}" data-tid="${escapeAttr(t.id)}">
        <div class="tn">${escapeHtml(t.name)}</div>
        <div class="td">${escapeHtml(t.description || '')} · ${t.fields?.length || 0} 字段</div>
      </div>
    `).join('');
    box.querySelectorAll('.es-tpl-item').forEach(it => {
      it.addEventListener('click', () => { editingId = it.dataset.tid; renderTplList(); renderTplEditor(); });
    });
  }

  function renderTplEditor() {
    const box = $('#es-tpl-editbox');
    const t = templates.find(x => x.id === editingId);
    if (!t) { box.innerHTML = `<div style="color:var(--ink-500);text-align:center;padding:40px 20px">从左边选一个模板开始编辑</div>`; return; }

    box.innerHTML = `
      <div class="meta">
        <div class="es-field" style="margin:0">
          <label>模板名</label>
          <input type="text" id="es-tpl-name" value="${escapeAttr(t.name)}">
        </div>
        <div class="es-field" style="margin:0">
          <label>类型</label>
          <select id="es-tpl-kind">
            <option value="text" ${t.kind === 'text' ? 'selected' : ''}>文字表情</option>
            <option value="character" ${t.kind === 'character' ? 'selected' : ''}>角色表情</option>
          </select>
        </div>
      </div>
      <div class="es-field" style="margin:0">
        <label>说明</label>
        <input type="text" id="es-tpl-desc" value="${escapeAttr(t.description || '')}">
      </div>
      <div class="es-section-title" style="margin-top:8px">字段列表 <span class="count">${t.fields.length}</span></div>
      <div class="es-fields-list" id="es-fields-list">
        ${t.fields.map((f, i) => renderFieldRow(f, i)).join('')}
      </div>
      <button class="es-fld-add" id="es-fld-add">➕ 新增字段</button>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="es-btn sm" id="es-tpl-dup">📋 复制此模板</button>
        <button class="es-btn sm" id="es-tpl-del" style="color:#c92a2a;border-color:#ffb3b3">🗑 删除</button>
        <span style="flex:1"></span>
        <button class="es-btn primary sm" id="es-tpl-save">💾 保存</button>
      </div>
    `;

    // Handlers
    box.querySelector('#es-fld-add').addEventListener('click', () => {
      t.fields.push({ key: `field_${t.fields.length + 1}`, label: '', desc: '', candidates: [] });
      renderTplEditor();
    });

    box.querySelectorAll('[data-fld-del]').forEach(b => {
      b.addEventListener('click', () => {
        const i = parseInt(b.dataset.fldDel, 10);
        t.fields.splice(i, 1);
        renderTplEditor();
      });
    });

    box.querySelector('#es-tpl-save').addEventListener('click', () => {
      t.name = box.querySelector('#es-tpl-name').value.trim() || t.name;
      t.kind = box.querySelector('#es-tpl-kind').value;
      t.description = box.querySelector('#es-tpl-desc').value.trim();
      t.fields = t.fields.map((f, i) => ({
        ...f,
        key: box.querySelector(`[data-fld-key="${i}"]`)?.value.trim() || f.key,
        label: box.querySelector(`[data-fld-label="${i}"]`)?.value.trim() || '',
        desc: box.querySelector(`[data-fld-desc="${i}"]`)?.value.trim() || '',
        candidates: (box.querySelector(`[data-fld-cand="${i}"]`)?.value || '').split(/[,，\n\/]/).map(s => s.trim()).filter(Boolean),
        locked: box.querySelector(`[data-fld-locked="${i}"]`)?.checked || false
      }));
      saveTemplates();
      renderTplSelects();
      renderTplList();
      toast('已保存');
    });

    box.querySelector('#es-tpl-dup').addEventListener('click', () => {
      const copy = JSON.parse(JSON.stringify(t));
      copy.id = `custom-${Date.now()}`;
      copy.name = t.name + ' (副本)';
      copy.preset = false;
      templates.push(copy);
      saveTemplates();
      editingId = copy.id;
      renderTplList();
      renderTplEditor();
      renderTplSelects();
      toast('已复制');
    });

    box.querySelector('#es-tpl-del').addEventListener('click', () => {
      if (!confirm(`删除模板「${t.name}」?`)) return;
      templates = templates.filter(x => x.id !== t.id);
      saveTemplates();
      editingId = templates[0]?.id || null;
      renderTplList();
      renderTplEditor();
      renderTplSelects();
      toast('已删除');
    });
  }

  function renderFieldRow(f, i) {
    return `
      <div class="es-fld">
        <div class="fc">
          <input type="text" data-fld-key="${i}" value="${escapeAttr(f.key || '')}" placeholder="key">
          <input type="text" data-fld-label="${i}" value="${escapeAttr(f.label || '')}" placeholder="中文标签">
          <label style="font-size:10.5px;color:var(--ink-500);display:flex;gap:3px;align-items:center">
            <input type="checkbox" data-fld-locked="${i}" ${f.locked ? 'checked' : ''}> 锁定字段(用户填啥就是啥)
          </label>
        </div>
        <div class="fc">
          <textarea data-fld-desc="${i}" placeholder="字段说明(给 LLM 看的)">${escapeHtml(f.desc || '')}</textarea>
          <textarea data-fld-cand="${i}" placeholder="候选词(用 / 或 , 分隔,可选)">${escapeHtml((f.candidates || []).join(' / '))}</textarea>
        </div>
        <button class="es-fld-del" data-fld-del="${i}" title="删除字段">🗑</button>
      </div>
    `;
  }

  // ---- Template CRUD extras ----
  $('#es-tpl-new').addEventListener('click', () => {
    const neu = {
      id: `custom-${Date.now()}`,
      name: '新模板',
      kind: 'text',
      description: '',
      fields: [{ key: 'subject', label: '主体', desc: '', candidates: [] }],
      preset: false
    };
    templates.push(neu);
    saveTemplates();
    editingId = neu.id;
    renderTplList();
    renderTplEditor();
    renderTplSelects();
  });

  $('#es-tpl-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(templates, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `emoji-studio-templates-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('#es-tpl-import').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      try {
        const txt = await file.text();
        const arr = JSON.parse(txt);
        if (!Array.isArray(arr)) throw new Error('JSON 必须是数组');
        const n = arr.filter(t => t.id && t.fields?.length).length;
        // Merge: 按 id 覆盖,新增 push
        for (const t of arr) {
          if (!t.id || !t.fields?.length) continue;
          const idx = templates.findIndex(x => x.id === t.id);
          if (idx >= 0) templates[idx] = t; else templates.push(t);
        }
        saveTemplates();
        renderTplList();
        renderTplEditor();
        renderTplSelects();
        toast(`已导入 ${n} 个模板`);
      } catch (e) { toast('导入失败:' + e.message); }
    };
    input.click();
  });

  $('#es-tpl-reseed').addEventListener('click', () => {
    if (!confirm('重新加入所有预置模板?已存在的同名模板不会覆盖')) return;
    const existingIds = new Set(templates.map(t => t.id));
    for (const p of presets) {
      if (!existingIds.has(p.id)) templates.push({ ...p, preset: true });
    }
    saveTemplates();
    renderTplList();
    renderTplSelects();
    toast('已重置预置');
  });

  // =========== Reverse Modal ===========
  const modalRev = $('#es-modal-rev');
  $('#es-btn-reverse').addEventListener('click', () => {
    renderRevTplSelect();
    modalRev.classList.add('on');
  });
  modalRev.querySelectorAll('[data-close-rev]').forEach(el => el.addEventListener('click', () => modalRev.classList.remove('on')));

  let revImage = null;

  const revDrop = $('#es-rev-drop');
  const revFile = $('#es-rev-file');
  revDrop.addEventListener('click', () => revFile.click());
  revFile.addEventListener('change', () => {
    const f = revFile.files?.[0]; if (!f) return;
    readAsDataURL(f).then(dataUrl => { revImage = dataUrl; renderRevDropPreview(); });
  });
  revDrop.addEventListener('dragover', (e) => { e.preventDefault(); });
  revDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0]; if (!f || !f.type.startsWith('image/')) return;
    readAsDataURL(f).then(dataUrl => { revImage = dataUrl; renderRevDropPreview(); });
  });
  window.addEventListener('paste', (e) => {
    if (!modalRev.classList.contains('on')) return;
    const items = e.clipboardData?.items || [];
    for (const it of items) {
      if (it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) readAsDataURL(f).then(dataUrl => { revImage = dataUrl; renderRevDropPreview(); });
      }
    }
  });

  function renderRevDropPreview() {
    if (!revImage) { revDrop.classList.remove('has'); $('#es-rev-hint').textContent = '点击选择图片 / 拖拽 / ⌘V 粘贴'; return; }
    revDrop.classList.add('has');
    revDrop.innerHTML = `<img src="${escapeAttr(revImage)}"><input type="file" id="es-rev-file" accept="image/*" hidden>`;
  }

  function renderRevTplSelect() {
    const sel = $('#es-rev-tpl');
    sel.innerHTML = templates.map(t => `<option value="${escapeAttr(t.id)}">${escapeHtml(t.name)}</option>`).join('');
  }

  $('#es-rev-run').addEventListener('click', async () => {
    if (!revImage) { toast('请先上传图片'); return; }
    const tpl = templates.find(t => t.id === $('#es-rev-tpl').value);
    if (!tpl) { toast('请选择模板'); return; }
    const cred = window.App.getCredentialsFor('emoji-studio', { requireVision: true });
    if (!cred) { toast('请先配置支持识图的模型 (OpenAI / 通义千问)'); window.App?.openSettings?.(); return; }

    const out = $('#es-rev-out');
    out.innerHTML = loadingBlock('正在分析图片...');
    try {
      const res = await fetch('/api/emoji-studio/reverse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: revImage, template: tpl, ...cred })
      }).then(r => r.json());
      if (res.error) throw new Error(res.error === 'llm_parse_failed' ? '模型输出格式问题,重试' : res.error);

      out.innerHTML = `
        <div class="es-var">
          <div class="vh"><span class="vn">字段填充</span></div>
          <div class="vp">${Object.entries(res.fields || {}).map(([k, v]) => `<div><strong>${escapeHtml(k)}</strong>: ${escapeHtml(v)}</div>`).join('')}</div>
        </div>
        <div class="es-var" style="margin-top:8px">
          <div class="vh"><span class="vn">复刻提示词</span><span style="flex:1"></span><button class="es-btn sm" id="es-rev-use">🎨 直接用这个生图</button></div>
          <div class="vp">${escapeHtml(res.zhPrompt || '')}</div>
          <div class="vp" style="margin-top:4px">${escapeHtml(res.enPrompt || '')}</div>
        </div>
        ${res.characterCandidate ? `
        <div class="es-var" style="margin-top:8px">
          <div class="vh"><span class="vn">角色候选</span></div>
          <div class="vp">
            名称: ${escapeHtml(res.characterCandidate.name || '')}<br>
            标签: ${(res.characterCandidate.tags || []).map(t => escapeHtml(t)).join(' · ')}<br>
            适用: ${escapeHtml(res.characterCandidate.suitableAs || '')}<br>
            <span style="color:var(--ink-500);font-size:11px">P1 角色库上线后可一键保存</span>
          </div>
        </div>` : ''}
        ${res.nextActions?.length ? `
        <div class="es-var" style="margin-top:8px;background:#fff3bf;border-color:#ffd08a">
          <div class="vh"><span class="vn" style="background:#b77b00">下一步建议</span></div>
          <div class="vp" style="background:#fff">${res.nextActions.map(a => `· ${escapeHtml(a)}`).join('<br>')}</div>
        </div>` : ''}
      `;

      out.querySelector('#es-rev-use')?.addEventListener('click', () => {
        $('#es-desc').value = `复刻这张图:${res.zhPrompt || ''}`;
        const tplSel = $('#es-tpl-select');
        if (tplSel) tplSel.value = tpl.id;
        modalRev.classList.remove('on');
        toast('已填入描述,切回文字表情 tab 查看');
      });
    } catch (e) {
      out.innerHTML = `<div class="es-err">❌ ${escapeHtml(e.message)}</div>`;
    }
  });

  // =========== Template local storage ===========

  function loadTemplates(presets) {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_TPL));
      if (Array.isArray(stored?.templates) && stored.templates.length) return stored.templates;
    } catch {}
    // Seed from presets
    return presets.map(p => ({ ...p, preset: true }));
  }
  function saveTemplates() {
    localStorage.setItem(LS_TPL, JSON.stringify({ templates, _v: 1 }));
  }

  function renderTplSelects() {
    const sel = $('#es-tpl-select');
    const prev = sel.value;
    sel.innerHTML = templates.map(t => `<option value="${escapeAttr(t.id)}">${escapeHtml(t.name)} · ${t.fields?.length || 0} 字段</option>`).join('');
    if (prev && templates.some(t => t.id === prev)) sel.value = prev;
  }
  function currentTplId() { return $('#es-tpl-select')?.value; }
  function getCurrentTemplate() { return templates.find(t => t.id === currentTplId()); }

  // =========== Characters (P1) ===========

  function loadCharacters() {
    try {
      const arr = JSON.parse(localStorage.getItem(LS_CHARS));
      if (Array.isArray(arr)) return arr;
    } catch {}
    return [];
  }
  function saveCharacters() {
    // LRU prune
    characters.sort((a, b) => (b.lastUsedAt || b.createdAt) - (a.lastUsedAt || a.createdAt));
    if (characters.length > CHARS_MAX) characters = characters.slice(0, CHARS_MAX);
    localStorage.setItem(LS_CHARS, JSON.stringify(characters));
  }
  function addCharacter({ refImage, name = '新角色', tags = [] }) {
    const ch = {
      id: 'ch-' + Date.now(),
      name, refImage, tags,
      createdAt: Date.now(),
      lastUsedAt: Date.now()
    };
    characters.unshift(ch);
    saveCharacters();
    renderCharGrid();
    updateCharCountHint();
    return ch;
  }
  function deleteCharacter(id) {
    characters = characters.filter(c => c.id !== id);
    if (selectedChar?.id === id) { selectedChar = null; renderCharCurrent(); }
    saveCharacters();
    renderCharGrid();
    updateCharCountHint();
  }
  function selectChar(ch) {
    selectedChar = ch;
    if (ch) { ch.lastUsedAt = Date.now(); saveCharacters(); }
    renderCharCurrent();
    renderCharGrid();
    // Auto-close modal after a select
    setTimeout(() => $('#es-modal-chars').classList.remove('on'), 200);
  }
  function renderCharCurrent() {
    const slot = $('#es-char-current'); if (!slot) return;
    if (selectedChar) {
      slot.classList.add('has');
      slot.innerHTML = `
        <img src="${escapeAttr(selectedChar.refImage)}" alt="">
        <div class="slot-name">${escapeHtml(selectedChar.name)}</div>
      `;
    } else {
      slot.classList.remove('has');
      slot.innerHTML = `
        <div class="slot-empty">
          <div style="font-size:24px;opacity:0.4;margin-bottom:4px">🎪</div>
          <div>还没选角色</div>
          <div class="slot-hint">打开角色库 / 上传新角色</div>
        </div>
      `;
    }
  }
  function renderCharTplSelect() {
    const sel = $('#es-char-tpl'); if (!sel) return;
    const prev = sel.value;
    const charFirst = [...templates].sort((a, b) => (a.kind === 'character' ? -1 : 0) - (b.kind === 'character' ? -1 : 0));
    sel.innerHTML = charFirst.map(t => `<option value="${escapeAttr(t.id)}">${escapeHtml(t.name)} · ${t.fields?.length || 0} 字段</option>`).join('');
    if (prev && templates.some(t => t.id === prev)) sel.value = prev;
    else if (charFirst[0]) sel.value = charFirst[0].id;
  }
  function renderCharGrid() {
    const grid = $('#es-char-grid'); if (!grid) return;
    if (!characters.length) {
      grid.innerHTML = `
        <div class="es-char-empty">
          <div style="font-size:36px;opacity:0.4;margin-bottom:8px">🎪</div>
          角色库空空如也<br>
          <span style="font-size:11.5px">点右上「➕ 上传新角色」添加第一个</span>
        </div>
      `;
      return;
    }
    grid.innerHTML = characters.map(c => `
      <div class="es-char-card ${selectedChar?.id === c.id ? 'selected' : ''}" data-cid="${escapeAttr(c.id)}">
        <div class="thumb"><img src="${escapeAttr(c.refImage)}" alt=""></div>
        <div class="name" title="${escapeAttr(c.name)}">${escapeHtml(c.name)}</div>
        <button class="del" data-del-cid="${escapeAttr(c.id)}" title="删除">×</button>
      </div>
    `).join('');
    grid.querySelectorAll('.es-char-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-del-cid]')) return;
        const ch = characters.find(c => c.id === card.dataset.cid); if (!ch) return;
        selectChar(ch);
      });
    });
    grid.querySelectorAll('[data-del-cid]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm('删除这个角色?')) return;
        deleteCharacter(btn.dataset.delCid);
      });
    });
  }
  function updateCharCountHint() {
    const el = $('#es-char-count-hint'); if (!el) return;
    el.textContent = `${characters.length} 个角色 · 最多 ${CHARS_MAX}`;
  }

  // Character modal
  const modalChars = $('#es-modal-chars');
  function openCharModal() {
    renderCharGrid();
    updateCharCountHint();
    modalChars.classList.add('on');
  }
  modalChars?.querySelectorAll('[data-close-chars]').forEach(el => el.addEventListener('click', () => modalChars.classList.remove('on')));
  $('#es-char-add')?.addEventListener('click', () => pickFile(async (file) => {
    const dataUrl = await readAsDataURL(file);
    const name = prompt('给这个角色起个名字?', file.name.replace(/\.[^.]+$/, '').slice(0, 20)) || '未命名角色';
    addCharacter({ refImage: dataUrl, name });
  }));

  function pickFile(cb) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => { const f = input.files?.[0]; if (f) cb(f); };
    input.click();
  }

  // =========== Character pipeline (i2i) ===========

  async function runCharacterPipeline() {
    if (!selectedChar) { toast('请先选一个角色'); return; }
    const desc = $('#es-char-desc').value.trim();
    if (!desc) { toast('请填写表情/动作描述'); return; }
    const tpl = templates.find(t => t.id === $('#es-char-tpl').value);
    if (!tpl) { toast('请选模板'); return; }
    const count = parseInt(charCountEl.value, 10);
    const ratio = charRatioRow.querySelector('.es-ratio-chip.active')?.dataset.r || '1:1';

    const llmCred = window.App.getCredentialsFor('emoji-studio');
    if (!llmCred) { toast('请先配置文本模型'); window.App?.openSettings?.(); return; }
    const imgCred = window.App.getImageCredentialsFor('emoji-studio');
    if (!imgCred) { toast('请先配置图像模型'); window.App?.openSettings?.('jimeng', 'imageGen'); return; }
    if (imgCred.provider !== 'jimeng') {
      toast('角色一致性仅支持即梦 Seedream,请切换');
      window.App?.openSettings?.('jimeng', 'imageGen');
      return;
    }

    const btn = $('#es-btn-char-run');
    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = '🌀 填词中...';

    const out = $('#es-output');
    out.innerHTML = loadingBlock(`用 "${selectedChar.name}" 作角色参考,AI 正在填词...`);

    try {
      // Step 1: fill (lock character field with selectedChar.name for reference)
      const lockedFields = {};
      if (tpl.fields.some(f => f.key === 'character')) {
        lockedFields.character = selectedChar.name + '(参考上传的角色图,保持外观一致)';
      }
      const fillRes = await fetch('/api/emoji-studio/fill', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: desc, template: tpl, count, lockedFields,
          ...llmCred
        })
      }).then(r => r.json());
      if (fillRes.error) throw new Error(fillRes.error === 'llm_parse_failed' ? '填词 JSON 解析失败,重试' : fillRes.error);

      const variants = fillRes.variants || [];
      renderOutput({ variants, images: null, ratio, fillOnly: false });

      // Step 2: i2i generate with refImage
      btn.textContent = `🎪 图生图中 0/${variants.length}...`;
      const imgRes = await fetch('/api/emoji-studio/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompts: variants.map(v => v.enPrompt || v.zhPrompt || ''),
          ratio,
          imageProvider: imgCred.provider,
          imageCredentials: imgCred.credentials,
          refImage: selectedChar.refImage
        })
      }).then(r => r.json());
      if (imgRes.error) throw new Error(imgRes.error);

      renderOutput({ variants, images: imgRes.images, ratio, fillOnly: false });
    } catch (e) {
      out.innerHTML = `<div class="es-err">❌ ${escapeHtml(e.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }

  // =========== utils ===========

  function loadingBlock(msg) {
    return `<div class="es-empty"><div class="g" style="animation:xhs-pulse 1.2s infinite">🌀</div><div class="tt">${escapeHtml(msg)}</div></div>`;
  }
  function readAsDataURL(file) {
    return new Promise((ok, bad) => {
      const r = new FileReader();
      r.onload = () => ok(r.result); r.onerror = bad;
      r.readAsDataURL(file);
    });
  }
  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 16px;border-radius:8px;z-index:9999;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.15)';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }
}
