/**
 * Q版 Prompt 工坊 — 单页两栏
 *
 * 流程:
 *   1) 上传角色图(必填) + 选预设风格 或 上传风格图(二选一)
 *   2) 选目标作图模型(多选,默认全选)
 *   3) 生成 → 后端读图拆解 6 维度 + 渲染各模型 prompt
 *   4) 结果卡片 + 复制按钮 + 跳转按钮(按档位 A/B/C)
 */

const FEATURE_ID = 'q-version-studio';

// 跳转档位 metadata(与 service.js 的 SUPPORTED_MODELS 对齐)
const JUMP_TIERS = {
  A: { label: 'A · 一键跳转预填', desc: '自动带 Prompt 打开目标工具', color: '#10b981' },
  B: { label: 'B · 跳转 + 提示装扩展', desc: '配合 Chrome 扩展可自动预填', color: '#f59e0b' },
  C: { label: 'C · 复制 + 打开官网', desc: '已复制到剪贴板,粘贴即可', color: '#6b7280' }
};

export function mount(root) {
  const state = {
    charImage: null,      // dataURL
    styleImage: null,     // dataURL
    charText: '',
    selectedPreset: null, // preset obj
    selectedModels: new Set(),
    presets: [],
    models: []
  };

  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];

  // ============ 模型芯片 ============
  const llmChip = window.App.createModelChip({
    featureId: FEATURE_ID,
    type: 'llm',
    onChange: () => {}
  });
  $('#qv-llm-chip').appendChild(llmChip);

  // ============ 初始化:拉预设 + 拉目标模型 ============
  Promise.all([
    fetch('/features/q-version-studio/presets/q-styles.json').then(r => r.json()),
    fetch('/api/q-version-studio/models').then(r => r.json())
  ]).then(([stylesData, modelsData]) => {
    state.presets = stylesData.presets || [];
    state.models = modelsData.models || [];
    renderPresets();
    renderModels();
    // 默认全选模型
    state.models.forEach(m => state.selectedModels.add(m.id));
    renderModels();
  }).catch(err => {
    console.error('[q-version-studio] init failed', err);
  });

  // ============ 预设列表 ============
  function renderPresets() {
    const cont = $('#qv-preset-list');
    cont.innerHTML = '';
    state.presets.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'style-chip' + (state.selectedPreset?.id === p.id ? ' active' : '');
      btn.dataset.id = p.id;
      btn.title = p.description || '';
      btn.innerHTML = `${p.emoji || '🎨'} ${escapeHtml(p.name)}`;
      btn.onclick = () => {
        state.selectedPreset = state.selectedPreset?.id === p.id ? null : p;
        renderPresets();
      };
      cont.appendChild(btn);
    });
  }

  // ============ 目标模型 checkbox ============
  function renderModels() {
    const cont = $('#qv-models');
    cont.innerHTML = '';
    state.models.forEach(m => {
      const btn = document.createElement('button');
      const checked = state.selectedModels.has(m.id);
      btn.className = 'style-chip' + (checked ? ' active' : '');
      btn.dataset.id = m.id;
      btn.title = `档位 ${m.jumpTier} · ${JUMP_TIERS[m.jumpTier]?.desc || ''}`;
      btn.innerHTML = `${escapeHtml(m.name)} <span class="ratio-tag" style="background:${JUMP_TIERS[m.jumpTier]?.color || '#6b7280'};color:#fff;">${m.jumpTier}</span>`;
      btn.onclick = () => {
        if (checked) state.selectedModels.delete(m.id);
        else state.selectedModels.add(m.id);
        renderModels();
      };
      cont.appendChild(btn);
    });
  }

  // ============ 图片上传 ============
  bindFileInput('#qv-char-file', '#qv-char-preview-wrap', (dataUrl) => {
    state.charImage = dataUrl;
  });
  bindFileInput('#qv-style-file', '#qv-style-preview-wrap', (dataUrl) => {
    state.styleImage = dataUrl;
  });

  $('#qv-char-text').oninput = (e) => { state.charText = e.target.value; };

  function bindFileInput(inputSel, previewSel, onLoad) {
    const input = $(inputSel);
    const preview = $(previewSel);
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      readFileAsDataURL(file).then(url => {
        onLoad(url);
        preview.innerHTML = `<img src="${url}" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid #e5e7eb">
          <button class="btn btn-ghost btn-sm" style="margin-top:6px" data-clear="1">清除</button>`;
        preview.querySelector('[data-clear]').onclick = () => {
          onLoad(null);
          preview.innerHTML = '';
          input.value = '';
        };
      });
    };
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ============ 生成按钮 ============
  $('#qv-btn-generate').onclick = async () => {
    if (!state.charImage && !state.charText.trim()) {
      alert('请上传角色图或填写角色描述');
      return;
    }
    if (!state.styleImage && !state.selectedPreset) {
      alert('请选择预设风格,或上传 Q版 参考图');
      return;
    }
    if (state.selectedModels.size === 0) {
      alert('请至少选一个目标作图模型');
      return;
    }

    const needVision = !!(state.charImage || state.styleImage);
    const creds = window.App.getCredentialsFor(FEATURE_ID, { requireVision: needVision });
    if (!creds) {
      showError(needVision
        ? '未找到支持识图的 LLM 凭据 —— 请在左下角「API 设置」里配置通义千问(qwen-vl-plus)或 OpenAI(gpt-4o-mini)'
        : '未找到可用的 LLM 凭据,请先在「API 设置」里配置一个');
      return;
    }

    const btn = $('#qv-btn-generate');
    btn.disabled = true;
    btn.textContent = '🧠 正在读图拆解 6 维度...';
    $('#qv-output').innerHTML = `<div class="empty"><div class="empty-icon">⏳</div>LLM 正在分析图像,通常需要 15~30 秒</div>`;

    try {
      const res = await fetch('/api/q-version-studio/one-shot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterImage: state.charImage,
          characterText: state.charText,
          styleImage: state.styleImage,
          stylePresetText: state.selectedPreset?.stylePresetText,
          targetModels: [...state.selectedModels],
          provider: creds.provider,
          credentials: creds.credentials
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.error === 'llm_parse_failed') {
        throw new Error('LLM 返回无法解析,原始输出:' + (data.raw || '').slice(0, 200));
      }
      renderResult(data);
    } catch (err) {
      showError(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '✨ 生成 Q版 Prompt';
    }
  };

  // ============ 结果渲染 ============
  function renderResult({ dimensions, prompts }) {
    const out = $('#qv-output');
    const dimJson = JSON.stringify(dimensions, null, 2);

    const cardsHtml = Object.values(prompts || {}).map(({ model, prompt }) => {
      const tierMeta = JUMP_TIERS[model.jumpTier];
      return `
        <div class="qv-result-card" style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin-bottom:12px;background:#fff">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-weight:600;font-size:15px">${escapeHtml(model.name)}</div>
            <span class="ratio-tag" style="background:${tierMeta.color};color:#fff;font-size:11px" title="${escapeHtml(tierMeta.desc)}">${model.jumpTier} · ${escapeHtml(tierMeta.label.split(' · ')[1] || '')}</span>
          </div>
          <pre class="qv-prompt-text" style="white-space:pre-wrap;word-break:break-word;background:#f9fafb;padding:10px;border-radius:6px;font-size:13px;line-height:1.55;max-height:260px;overflow:auto">${escapeHtml(prompt)}</pre>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn btn-secondary btn-sm" data-copy="${model.id}">📋 复制 Prompt</button>
            <button class="btn btn-primary btn-sm" data-jump="${model.id}">🚀 跳转 ${escapeHtml(model.name)}</button>
          </div>
        </div>
      `;
    }).join('');

    out.innerHTML = `
      <div style="margin-bottom:16px">
        <details>
          <summary style="cursor:pointer;font-weight:600;padding:6px 0">📐 6 维度拆解结果(点击展开查看 JSON)</summary>
          <pre style="background:#f3f4f6;padding:12px;border-radius:8px;font-size:12px;max-height:300px;overflow:auto;margin-top:8px">${escapeHtml(dimJson)}</pre>
        </details>
      </div>
      <div>${cardsHtml}</div>
    `;

    // 绑定复制/跳转
    out.querySelectorAll('[data-copy]').forEach(btn => {
      btn.onclick = () => {
        const modelId = btn.dataset.copy;
        const prompt = prompts[modelId]?.prompt;
        if (!prompt) return;
        copyToClipboard(prompt);
        btn.textContent = '✓ 已复制';
        setTimeout(() => { btn.textContent = '📋 复制 Prompt'; }, 1500);
      };
    });
    out.querySelectorAll('[data-jump]').forEach(btn => {
      btn.onclick = () => {
        const modelId = btn.dataset.jump;
        const entry = prompts[modelId];
        if (!entry) return;
        jumpToTool(entry.model, entry.prompt);
      };
    });
  }

  // ============ 跳转逻辑(按档位) ============
  function jumpToTool(model, prompt) {
    const tier = model.jumpTier;
    if (tier === 'A' && model.id === 'gpt-image') {
      // ChatGPT:URL 预填
      window.open(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`, '_blank');
      return;
    }
    if (tier === 'B' && model.id === 'nano-banana') {
      copyToClipboard(prompt);
      const firstTimeKey = 'qvGeminiHintShown';
      if (!localStorage.getItem(firstTimeKey)) {
        alert('已复制 Prompt 到剪贴板。\n\n首次使用建议装 Chrome 扩展「Gemini URL Prompt」可实现自动预填。\n\n未装扩展时直接粘贴即可。');
        localStorage.setItem(firstTimeKey, '1');
      }
      window.open(`https://gemini.google.com/app?prompt=${encodeURIComponent(prompt)}`, '_blank');
      return;
    }
    // C 档:复制 + 打开官网
    copyToClipboard(prompt);
    window.open(model.jumpUrl, '_blank');
    toast(`已复制 Prompt,请粘贴到 ${model.name}`);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
  }
  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:10px 18px;border-radius:24px;z-index:9999;font-size:14px';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  function showError(msg) {
    $('#qv-output').innerHTML = `<div class="empty" style="color:#dc2626"><div class="empty-icon">⚠️</div>${escapeHtml(msg)}</div>`;
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
}
