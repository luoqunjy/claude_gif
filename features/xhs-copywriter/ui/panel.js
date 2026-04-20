export function mount(root) {
  const $ = (s) => root.querySelector(s);

  // --- header tools ---
  if (window.App?.createModelChip) {
    const chip = window.App.createModelChip({ featureId: 'xhs-copywriter', type: 'llm' });
    $('#xhs-llm-chip')?.appendChild(chip);
  }
  $('#xhs-btn-settings')?.addEventListener('click', () => window.App?.openSettings?.());
  $('#xhs-btn-config-serper')?.addEventListener('click', () => window.App?.openSettings?.('serper', 'search'));

  // Serper gate banner
  const serperCred = window.App?.getSearchCredentials?.();
  if (!serperCred?.apiKey) $('#xhs-no-serper').hidden = false;

  // Auto-grow textarea
  const intentEl = $('#xhs-intent');
  const keywordEl = $('#xhs-keyword');
  autoGrow(intentEl);
  intentEl.addEventListener('input', () => autoGrow(intentEl));
  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  // Cmd+Enter to run
  [keywordEl, intentEl].forEach(el => {
    el.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        $('#xhs-btn-run').click();
      }
    });
  });

  const panes = {
    bm:   { root: $('#xhs-pane-bm'),   body: $('#xhs-bm-body'),   sub: $('#xhs-bm-sub'),   badge: $('#xhs-bm-count') },
    an:   { root: $('#xhs-pane-an'),   body: $('#xhs-an-body'),   sub: $('#xhs-an-sub') },
    note: { root: $('#xhs-pane-note'), body: $('#xhs-note-body') }
  };

  let lastState = { keyword: '', intent: '', benchmark: null, analysis: null, note: null };

  // ============ Run pipeline ============
  $('#xhs-btn-run').addEventListener('click', async () => {
    const keyword = keywordEl.value.trim();
    const intent = intentEl.value.trim();
    if (!keyword) { toast('请先填主题关键词'); keywordEl.focus(); return; }

    const cred = window.App.getCredentialsFor('xhs-copywriter');
    if (!cred) { toast('请先配置 LLM API Key'); window.App?.openSettings?.(); return; }
    const searchCred = window.App.getSearchCredentials();
    if (!searchCred?.apiKey) {
      toast('RAG 流程需要 Serper, 请先配置');
      window.App?.openSettings?.('serper', 'search');
      return;
    }

    lastState = { keyword, intent, benchmark: null, analysis: null, note: null };

    setPaneState('bm', 'running', '搜索中 · Serper');
    setPaneState('an', 'pending', '等待');
    setPaneState('note', 'pending', '等待');
    panes.bm.body.innerHTML = skeleton(5);
    panes.an.body.innerHTML = '';
    panes.note.body.innerHTML = '';
    panes.bm.badge.hidden = true;
    $('#xhs-btn-regen').hidden = true;

    const btn = $('#xhs-btn-run');
    btn.disabled = true;
    const origLabel = btn.textContent;
    btn.textContent = '🌀 运行中...';

    try {
      const res = await fetch('/api/xhs-copywriter/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword, intent,
          ...cred,
          searchCredentials: { provider: searchCred.provider || 'serper', apiKey: searchCred.apiKey }
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        const msg = data.error === 'llm_parse_failed'
          ? `${data.stage === 'analyze' ? '拆解' : '写作'}阶段模型输出不是合法 JSON,再点一次通常就好`
          : (data.error || `HTTP ${res.status}`);
        // Render benchmark partial if exists
        if (data.benchmark) { lastState.benchmark = data.benchmark; renderBenchmark(); }
        if (data.analysis) { lastState.analysis = data.analysis; renderAnalysis(); }
        throw new Error(msg);
      }

      lastState.benchmark = data.benchmark;
      lastState.analysis = data.analysis;
      lastState.note = data.note;

      renderBenchmark();
      setPaneState('an', 'running', '拆解中');
      panes.an.body.innerHTML = skeleton(4);
      await delay(120);
      renderAnalysis();

      setPaneState('note', 'running', '写作中');
      panes.note.body.innerHTML = skeleton(6);
      await delay(120);
      renderNote();
    } catch (e) {
      panes.note.body.innerHTML = `<div class="xhs-err">❌ ${escapeHtml(e.message)}</div>`;
      setPaneState('note', 'pending');
    } finally {
      btn.disabled = false;
      btn.textContent = origLabel;
    }
  });

  // ============ Regenerate (same analysis, new note) ============
  $('#xhs-btn-regen').addEventListener('click', async () => {
    if (!lastState.analysis) return;
    const cred = window.App.getCredentialsFor('xhs-copywriter');
    if (!cred) { toast('请配置 LLM API Key'); return; }

    const btn = $('#xhs-btn-regen');
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = '🌀 写作中...';
    setPaneState('note', 'running', '换一篇');
    panes.note.body.innerHTML = skeleton(6);

    try {
      const res = await fetch('/api/xhs-copywriter/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: lastState.keyword,
          intent: lastState.intent,
          analysis: lastState.analysis,
          ...cred
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      lastState.note = data;
      renderNote();
    } catch (e) {
      panes.note.body.innerHTML = `<div class="xhs-err">❌ ${escapeHtml(e.message)}</div>`;
      toast('换一篇失败: ' + e.message);
      setPaneState('note', 'done');
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  });

  // ============ Pane state helpers ============
  function setPaneState(key, state, subText) {
    const p = panes[key];
    if (!p) return;
    p.root.classList.remove('is-running', 'is-done', 'is-active');
    if (state === 'running') p.root.classList.add('is-running', 'is-active');
    else if (state === 'done') p.root.classList.add('is-done');
    if (subText !== undefined && p.sub) p.sub.textContent = subText || '';
  }

  function skeleton(rows) {
    return `<div class="xhs-skeleton">${Array.from({ length: rows }).map((_, i) =>
      `<div class="xhs-skel-bar ${i % 3 === 0 ? 'short' : ''} ${i % 4 === 0 ? 'tiny' : ''}"></div>`
    ).join('')}</div>`;
  }

  // ============ Renderers ============
  function renderBenchmark() {
    const bm = lastState.benchmark;
    if (!bm) return;
    const list = (bm.benchmarks || []).map((b, i) => `
      <div class="xhs-bm-item">
        <div><span class="idx">${String(i + 1).padStart(2, '0')}</span><span class="t">${escapeHtml(b.title)}</span></div>
        ${b.snippet ? `<div class="s">${escapeHtml(b.snippet.slice(0, 140))}${b.snippet.length > 140 ? '…' : ''}</div>` : ''}
        <div class="m">
          <span>${escapeHtml(b.source || '')}</span>
          ${b.link ? `<a href="${escapeAttr(b.link)}" target="_blank" rel="noopener">打开 ↗</a>` : ''}
        </div>
      </div>
    `).join('');
    panes.bm.body.innerHTML = list || `<div class="xhs-empty"><div class="glyph">🫥</div><div>没搜到 —— 换个更具体的关键词试试</div></div>`;
    panes.bm.badge.hidden = false;
    panes.bm.badge.textContent = `${bm.benchmarks?.length || 0} 条`;
    panes.bm.sub.textContent = bm.queries?.[0] || '';
    setPaneState('bm', 'done');
  }

  function renderAnalysis() {
    const a = lastState.analysis;
    if (!a) return;

    const card = (icon, cap, items) => items?.length ? `
      <div class="xhs-an-card">
        <div class="cap">${icon} ${cap}</div>
        <ul>${items.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
      </div>` : '';

    const proseCard = (icon, cap, text) => text ? `
      <div class="xhs-an-card">
        <div class="cap">${icon} ${cap}</div>
        <div class="prose">${escapeHtml(text)}</div>
      </div>` : '';

    panes.an.body.innerHTML = `
      <div class="xhs-an-grid">
        ${card('🎣', '钩子类型', a.hookTypes)}
        ${card('💗', '情绪锚点', a.emotionAnchors)}
        ${proseCard('🦴', '内容骨架', a.structurePattern)}
        ${card('🔑', '关键词规则', a.keywordRules)}
        ${card('📏', '标题公式', a.titleFormulas)}
        ${card('🏷️', '常见标签', a.commonTags)}
        ${card('🚫', '要避开的雷区', a.avoidThese)}
        ${a.takeaway ? `<div class="xhs-an-takeaway"><div class="cap">💡 核心要义</div>${escapeHtml(a.takeaway)}</div>` : ''}
      </div>
    `;
    setPaneState('an', 'done', '已拆解');
  }

  function renderNote() {
    const n = lastState.note;
    if (!n) return;

    const titleLen = [...(n.title || '')].length;
    const contentLen = [...(n.content || '')].length;
    const tags = Array.isArray(n.tags) ? n.tags : [];
    const sc = n._selfCheck || {};
    const titleOk = titleLen <= 20;
    const lenOk = contentLen >= 300 && contentLen <= 600;

    panes.note.body.innerHTML = `
      <div class="xhs-note">
        <div class="xhs-note-rule"></div>
        <div class="xhs-note-title">${escapeHtml(n.title || '')}</div>
        <div class="xhs-note-meta">
          <span>标题 ${titleLen} 字 <span class="${titleOk ? 'ok' : 'warn'}">${titleOk ? '✓' : '⚠ 超 20 字'}</span></span>
          ${sc.keywordInFirst13Chars !== undefined ? `<span class="${sc.keywordInFirst13Chars ? 'ok' : 'warn'}">${sc.keywordInFirst13Chars ? '✓ 关键词在前 13 字' : '⚠ 关键词位置'}</span>` : ''}
          ${sc.titleHookUsed ? `<span>钩子: ${escapeHtml(sc.titleHookUsed)}</span>` : ''}
          <span style="margin-left:auto"><button class="xhs-btn-ghost" data-copy="title">复制</button></span>
        </div>

        <div class="xhs-note-body">${escapeHtml(n.content || '')}</div>
        <div class="xhs-note-meta" style="border-bottom:none;padding-bottom:0">
          <span>正文 ${contentLen} 字 <span class="${lenOk ? 'ok' : 'warn'}">${lenOk ? '✓' : '⚠ 建议 300-600'}</span></span>
          ${sc.hasConcretePlaceholders ? '<span class="ok">✓ 用占位符替代编造</span>' : ''}
          <span style="margin-left:auto">
            <button class="xhs-btn-ghost" data-copy="content">复制正文</button>
            <button class="xhs-btn-ghost" data-copy="full">复制全文</button>
          </span>
        </div>

        ${tags.length ? `
        <div>
          <div class="xhs-note-tags">${tags.map(t => `<span class="xhs-note-tag">${escapeHtml(t)}</span>`).join('')}</div>
          <div class="xhs-copy-row"><button class="xhs-btn-ghost" data-copy="tags">复制标签</button></div>
        </div>` : ''}

        <div class="xhs-note-metarow">
          <div class="xhs-note-metabox">
            <div class="mlabel">⏰ 建议发布时间</div>
            <div>${escapeHtml(n.best_time || '—')}</div>
          </div>
          <div class="xhs-note-metabox">
            <div class="mlabel">💬 结尾 CTA</div>
            <div>${escapeHtml(n.cta || '—')}</div>
          </div>
        </div>

        ${n.cover_prompt ? `
        <div>
          <div class="xhs-note-cover-label">🖼️ 封面 AI 提示词 · 3:4</div>
          <div class="xhs-note-cover">${escapeHtml(n.cover_prompt)}</div>
          <div class="xhs-copy-row"><button class="xhs-btn-ghost" data-copy="cover">复制</button></div>
        </div>` : ''}
      </div>
    `;
    setPaneState('note', 'done');
    $('#xhs-btn-regen').hidden = false;

    panes.note.body.querySelectorAll('[data-copy]').forEach(b => {
      b.addEventListener('click', () => {
        const key = b.dataset.copy;
        const n = lastState.note; if (!n) return;
        const tags = Array.isArray(n.tags) ? n.tags : [];
        let txt = '';
        if (key === 'title') txt = n.title || '';
        else if (key === 'content') txt = n.content || '';
        else if (key === 'tags') txt = tags.join(' ');
        else if (key === 'cover') txt = n.cover_prompt || '';
        else if (key === 'full') txt = `${n.title}\n\n${n.content}\n\n${tags.join(' ')}`;
        navigator.clipboard?.writeText(txt).then(() => toast('已复制'));
      });
    });
  }

  // ============ utils ============
  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 16px;border-radius:8px;z-index:9999;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.15)';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }
}
