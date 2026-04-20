export function mount(root) {
  const $ = (s) => root.querySelector(s);

  if (window.App?.createModelChip) {
    const chip = window.App.createModelChip({ featureId: 'xhs-copywriter', type: 'llm' });
    $('#xhs-llm-chip')?.appendChild(chip);
  }
  $('#xhs-btn-settings')?.addEventListener('click', () => window.App?.openSettings?.());
  $('#xhs-btn-config-serper')?.addEventListener('click', () => window.App?.openSettings?.('serper', 'search'));

  // 检测 Serper
  const serperCred = window.App?.getSearchCredentials?.();
  if (!serperCred?.apiKey) {
    $('#xhs-no-serper').hidden = false;
  }

  const out = $('#xhs-output');
  let lastState = { keyword: '', intent: '', benchmark: null, analysis: null, note: null };

  $('#xhs-btn-run').addEventListener('click', async () => {
    const keyword = $('#xhs-keyword').value.trim();
    const intent = $('#xhs-intent').value.trim();
    if (!keyword) { toast('请先填主题关键词'); return; }

    const cred = window.App.getCredentialsFor('xhs-copywriter');
    if (!cred) {
      toast('请先配置 LLM API Key');
      window.App?.openSettings?.();
      return;
    }
    const searchCred = window.App.getSearchCredentials();
    if (!searchCred?.apiKey) {
      toast('RAG 流程需要 Serper,请先配置');
      window.App?.openSettings?.('serper', 'search');
      return;
    }

    lastState = { keyword, intent, benchmark: null, analysis: null, note: null };
    renderStages({ keyword, stage: 'benchmark', progress: 'run' });

    const btn = $('#xhs-btn-run');
    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = '运行中...';

    try {
      const res = await fetch('/api/xhs-copywriter/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword,
          intent,
          ...cred,
          searchCredentials: { provider: searchCred.provider || 'serper', apiKey: searchCred.apiKey }
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        const msg = data.error === 'llm_parse_failed'
          ? `${data.stage === 'analyze' ? '拆解' : '写作'}阶段模型输出不是合法 JSON,再点一次通常就好`
          : (data.error || `HTTP ${res.status}`);
        throw new Error(msg);
      }

      lastState.benchmark = data.benchmark;
      lastState.analysis = data.analysis;
      lastState.note = data.note;
      renderFull();
    } catch (e) {
      out.innerHTML = `<div class="error-block" style="padding:14px;color:#c00">❌ ${escapeHtml(e.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  });

  // --------- Stage skeleton rendering ---------

  function renderStages({ keyword, stage, progress }) {
    out.innerHTML = `
      <div class="xhs-stage ${stage === 'benchmark' ? '' : 'pending'}">
        <div class="xhs-stage-head ${progress === 'run' && stage === 'benchmark' ? 'run' : ''}">
          <span class="snum">1</span>
          <span>🔍 对标爆款</span>
          <span class="sstatus">${progress === 'run' && stage === 'benchmark' ? '搜索中 · 调用 Serper…' : '等待'}</span>
        </div>
        <div class="xhs-stage-body"><div class="empty">...</div></div>
      </div>
      <div class="xhs-stage pending">
        <div class="xhs-stage-head"><span class="snum">2</span><span>🧬 爆款套路拆解</span><span class="sstatus">等待</span></div>
      </div>
      <div class="xhs-stage pending">
        <div class="xhs-stage-head"><span class="snum">3</span><span>📝 你的爆款笔记</span><span class="sstatus">等待</span></div>
      </div>
    `;
  }

  // --------- Final rendering (all 3 stages) ---------

  function renderFull() {
    const { benchmark, analysis, note } = lastState;
    out.innerHTML = `
      ${renderBenchmark(benchmark)}
      ${renderAnalysis(analysis)}
      ${renderNote(note)}
    `;
    wireOutputHandlers();
  }

  function renderBenchmark(bm) {
    if (!bm) return '';
    const list = (bm.benchmarks || []).map((b, i) => `
      <div class="xhs-bm-item">
        <div class="bidx">${i + 1}</div>
        <div style="flex:1;min-width:0">
          <div class="btitle">${escapeHtml(b.title)}</div>
          ${b.snippet ? `<div class="bsnip">${escapeHtml(b.snippet)}</div>` : ''}
          <div class="bsrc">${escapeHtml(b.source || '')} ${b.link ? `· <a href="${escapeAttr(b.link)}" target="_blank" rel="noopener">打开</a>` : ''}</div>
        </div>
      </div>
    `).join('');

    return `
      <div class="xhs-stage">
        <div class="xhs-stage-head done">
          <span class="snum">1</span>
          <span>🔍 对标爆款 · ${bm.benchmarks?.length || 0} 条</span>
          <span class="sstatus">Serper 搜索:${escapeHtml(bm.queries?.[0] || '')}</span>
        </div>
        <div class="xhs-stage-body">
          <div class="xhs-bm-list">${list || '<div class="empty">没搜到</div>'}</div>
        </div>
      </div>
    `;
  }

  function renderAnalysis(a) {
    if (!a) return '';
    const card = (icon, cap, items) => items?.length ? `
      <div class="xhs-analysis-card">
        <div class="acap">${icon} ${cap}</div>
        <ul>${items.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
      </div>` : '';

    return `
      <div class="xhs-stage">
        <div class="xhs-stage-head done">
          <span class="snum">2</span>
          <span>🧬 爆款套路拆解</span>
          <span class="sstatus">模型从对标里提炼出的可复用规则</span>
        </div>
        <div class="xhs-stage-body">
          <div class="xhs-analysis-grid">
            ${card('🎣', '钩子类型', a.hookTypes)}
            ${card('💗', '情绪锚点', a.emotionAnchors)}
            ${card('🦴', '内容骨架', a.structurePattern ? [a.structurePattern] : null)}
            ${card('🔑', '关键词规则', a.keywordRules)}
            ${card('📏', '标题公式', a.titleFormulas)}
            ${card('🏷️', '常见标签', a.commonTags)}
            ${card('🚫', '要避开的雷区', a.avoidThese)}
            ${a.takeaway ? `<div class="xhs-analysis-takeaway">💡 核心要义 · ${escapeHtml(a.takeaway)}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function renderNote(n) {
    if (!n) return '';
    const titleLen = [...(n.title || '')].length;
    const contentLen = [...(n.content || '')].length;
    const tags = Array.isArray(n.tags) ? n.tags : [];
    const sc = n._selfCheck || {};
    const titleOk = titleLen <= 20;
    const lenOk = contentLen >= 300 && contentLen <= 600;

    return `
      <div class="xhs-stage">
        <div class="xhs-stage-head done">
          <span class="snum">3</span>
          <span>📝 你的爆款笔记</span>
          <span class="sstatus">
            <button class="btn btn-ghost btn-sm" data-action="regenerate">🎲 换一篇(不重新搜)</button>
          </span>
        </div>
        <div class="xhs-stage-body">
          <div class="xhs-note-title">${escapeHtml(n.title || '')}</div>
          <div class="xhs-note-meta">
            <span>标题 ${titleLen} 字 <span class="${titleOk ? 'sc-ok' : 'sc-warn'}">${titleOk ? '✓' : '⚠️ 超 20 字'}</span></span>
            ${sc.keywordInFirst13Chars !== undefined ? `<span class="${sc.keywordInFirst13Chars ? 'sc-ok' : 'sc-warn'}">${sc.keywordInFirst13Chars ? '✓ 关键词在前 13 字' : '⚠️ 关键词不在前 13 字'}</span>` : ''}
            ${sc.titleHookUsed ? `<span>钩子:${escapeHtml(sc.titleHookUsed)}</span>` : ''}
            <button class="btn btn-ghost btn-sm" data-copy="title">📋 复制标题</button>
          </div>

          <div class="xhs-note-content">${escapeHtml(n.content || '')}</div>
          <div class="xhs-note-meta">
            <span>正文 ${contentLen} 字 <span class="${lenOk ? 'sc-ok' : 'sc-warn'}">${lenOk ? '✓' : '⚠️ 建议 300-600 字'}</span></span>
            ${sc.hasConcretePlaceholders ? '<span class="sc-ok">✓ 已用占位符,避免编造细节</span>' : ''}
            <button class="btn btn-ghost btn-sm" data-copy="content">📋 复制正文</button>
            <button class="btn btn-ghost btn-sm" data-copy="full">📋 复制全文(标题+正文+标签)</button>
          </div>

          ${tags.length ? `
          <div>
            <div class="xhs-note-meta">标签 · ${tags.length} 个</div>
            <div class="xhs-tags">${tags.map(t => `<span class="xhs-tag">${escapeHtml(t)}</span>`).join('')}</div>
            <div class="xhs-copy-row">
              <button class="btn btn-ghost btn-sm" data-copy="tags">📋 复制标签</button>
            </div>
          </div>` : ''}

          <div class="xhs-meta-row">
            <div class="xhs-meta-card">
              <div class="mlabel">⏰ 建议发布时间</div>
              <div>${escapeHtml(n.best_time || '')}</div>
            </div>
            <div class="xhs-meta-card">
              <div class="mlabel">💬 结尾 CTA</div>
              <div>${escapeHtml(n.cta || '')}</div>
            </div>
          </div>

          ${n.cover_prompt ? `
          <div>
            <div class="xhs-note-meta">🖼️ 封面 AI 绘图提示词(3:4 竖图)</div>
            <div class="xhs-cover-prompt">${escapeHtml(n.cover_prompt)}</div>
            <div class="xhs-copy-row">
              <button class="btn btn-ghost btn-sm" data-copy="cover">📋 复制封面提示词</button>
            </div>
          </div>` : ''}
        </div>
      </div>
    `;
  }

  function wireOutputHandlers() {
    out.querySelectorAll('[data-copy]').forEach(b => {
      b.addEventListener('click', () => {
        const n = lastState.note; if (!n) return;
        const tags = Array.isArray(n.tags) ? n.tags : [];
        const key = b.dataset.copy;
        let txt = '';
        if (key === 'title') txt = n.title || '';
        else if (key === 'content') txt = n.content || '';
        else if (key === 'tags') txt = tags.join(' ');
        else if (key === 'cover') txt = n.cover_prompt || '';
        else if (key === 'full') txt = `${n.title}\n\n${n.content}\n\n${tags.join(' ')}`;
        navigator.clipboard?.writeText(txt).then(() => toast('已复制'));
      });
    });

    out.querySelectorAll('[data-action="regenerate"]').forEach(b => {
      b.addEventListener('click', async () => {
        if (!lastState.analysis) return;
        const cred = window.App.getCredentialsFor('xhs-copywriter');
        if (!cred) { toast('请配置 LLM API Key'); return; }

        b.disabled = true; b.textContent = '写作中...';
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
          renderFull();
        } catch (e) {
          toast('换一篇失败:' + e.message);
          b.disabled = false;
          b.textContent = '🎲 换一篇(不重新搜)';
        }
      });
    });
  }

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
