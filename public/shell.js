/**
 * 应用壳:加载 features、维护 LLM 凭据(localStorage)、渲染 API 设置弹窗
 */

const STORAGE_KEY = 'opsAssistant.llm.v2';
const SEARCH_STORAGE_KEY = 'opsAssistant.search.v1';

// ============== Storage helpers ==============
function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { active: 'kimi', providers: {} };
  } catch {
    return { active: 'kimi', providers: {} };
  }
}
function saveConfig(cfg) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}
function loadSearchConfig() {
  try {
    return JSON.parse(localStorage.getItem(SEARCH_STORAGE_KEY)) || { active: 'serper', providers: {} };
  } catch {
    return { active: 'serper', providers: {} };
  }
}
function saveSearchConfig(cfg) {
  localStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify(cfg));
}

// ============== Globals exposed to feature panels ==============
window.App = {
  getActiveProvider() {
    const cfg = loadConfig();
    return cfg.active || 'kimi';
  },
  getActiveProviderDef() {
    const cfg = loadConfig();
    const id = cfg.active || 'kimi';
    return supportedProviders.find(p => p.id === id);
  },
  getCredentials() {
    const cfg = loadConfig();
    const active = cfg.active || 'kimi';
    const cred = cfg.providers?.[active];
    if (!cred?.apiKey) return null;
    return { provider: active, credentials: cred };
  },
  getSearchCredentials() {
    const cfg = loadSearchConfig();
    const active = cfg.active || 'serper';
    const cred = cfg.providers?.[active];
    if (!cred?.apiKey) return null;
    return { provider: active, ...cred };
  },
  hasAnyKey() {
    const cfg = loadConfig();
    return Object.values(cfg.providers || {}).some(p => p?.apiKey);
  },
  hasVisionModel() {
    const cfg = loadConfig();
    const active = cfg.active;
    const def = supportedProviders.find(p => p.id === active);
    return Boolean(def?.vision && cfg.providers?.[active]?.apiKey);
  },
  listVisionProviders() {
    return supportedProviders.filter(p => p.vision);
  },
  switchProvider(providerId) {
    const cfg = loadConfig();
    if (cfg.providers?.[providerId]?.apiKey) {
      cfg.active = providerId;
      saveConfig(cfg);
      renderStatusAndSwitcher();
      return true;
    }
    return false;
  },
  openSettings(tabId) { openSettingsAt(tabId); }
};

// ============== Bootstrap ==============
const nav = document.getElementById('feature-nav');
const workspace = document.getElementById('workspace');
const llmStatus = document.getElementById('llm-status');
const llmSwitcher = document.getElementById('llm-switcher');
const llmSelect = document.getElementById('llm-select');
const btnOpenSettings = document.getElementById('btn-open-settings');

let supportedProviders = [];
let activeFeatureId = null;

let supportedSearchProviders = [];

async function main() {
  const [health, features] = await Promise.all([
    fetch('/api/health').then(r => r.json()).catch(() => null),
    fetch('/api/features').then(r => r.json())
  ]);

  supportedProviders = health?.llm?.supported || [];
  supportedSearchProviders = health?.search?.supported || [];

  renderStatusAndSwitcher();
  bindSettingsModal();

  if (!features.length) {
    workspace.innerHTML = `<div class="empty-page">尚未注册任何功能模块</div>`;
    return;
  }

  features.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'nav-item';
    item.innerHTML = `
      <span class="nav-icon">${f.icon || '🔸'}</span>
      <div class="nav-meta"><div class="nav-name">${escapeHtml(f.name)}</div></div>
    `;
    item.addEventListener('click', () => loadFeature(f, item));
    nav.appendChild(item);
    if (i === 0) loadFeature(f, item);
  });

  // 首次访问且未配置 → 自动弹出
  if (!window.App.hasAnyKey()) {
    setTimeout(() => openSettingsModal(), 500);
  }
}

async function loadFeature(feature, el) {
  if (activeFeatureId === feature.id) return;
  activeFeatureId = feature.id;
  [...nav.children].forEach(c => c.classList.toggle('active', c === el));

  workspace.innerHTML = `<div class="loading-page"><span class="spinner"></span>加载 ${escapeHtml(feature.name)}…</div>`;

  try {
    const html = await fetch('/' + feature.ui.panel).then(r => r.text());
    workspace.innerHTML = html;
    const mod = await import('/' + feature.ui.script + '?v=' + Date.now());
    if (typeof mod.mount === 'function') mod.mount(workspace);
  } catch (e) {
    workspace.innerHTML = `<div class="empty-page error">❌ 加载失败: ${escapeHtml(e.message)}</div>`;
  }
}

// ============== Status badge + provider switcher ==============
function renderStatusAndSwitcher() {
  if (!supportedProviders.length) return;

  const cfg = loadConfig();
  const configured = supportedProviders.filter(p => cfg.providers?.[p.id]?.apiKey);
  const activeId = (cfg.active && cfg.providers?.[cfg.active]?.apiKey)
    ? cfg.active
    : (configured[0]?.id || 'kimi');

  // 状态徽章
  const activeDef = supportedProviders.find(p => p.id === activeId);
  const activeCred = cfg.providers?.[activeId];
  if (activeCred?.apiKey) {
    llmStatus.classList.remove('warn'); llmStatus.classList.add('ok');
    llmStatus.querySelector('.llm-text').textContent = `${activeDef.name} · ${activeCred.model || activeDef.model}`;
    llmStatus.title = '已配置: ' + configured.map(p => p.name).join(' / ');
  } else {
    llmStatus.classList.remove('ok'); llmStatus.classList.add('warn');
    llmStatus.querySelector('.llm-text').textContent = '未配置 API Key';
    llmStatus.title = '点击上方「🔑 API 设置」或下拉框选择未配置项';
  }

  // 下拉框:永远显示所有 4 个供应商,未配置的加标识
  llmSwitcher.hidden = false;
  llmSelect.innerHTML = '';
  supportedProviders.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    const hasKey = Boolean(cfg.providers?.[p.id]?.apiKey);
    opt.textContent = `${p.name}${p.vision ? ' 🖼️' : ''}${hasKey ? '' : ' · 未配置'}`;
    if (!hasKey) opt.dataset.unconfigured = '1';
    llmSelect.appendChild(opt);
  });
  llmSelect.value = activeId;

  // 每次重绑 onchange (避免旧闭包)
  llmSelect.onchange = () => {
    const chosenId = llmSelect.value;
    const c = loadConfig();
    const chosenDef = supportedProviders.find(p => p.id === chosenId);
    const hasKey = Boolean(c.providers?.[chosenId]?.apiKey);

    if (!hasKey) {
      // 未配置 → 打开设置窗口到对应 tab,并把下拉选项回退
      toast(`${chosenDef.name} 还没配置,请先填入 API Key`);
      llmSelect.value = activeId;  // 不切换 active
      openSettingsAt(chosenId);
      return;
    }

    c.active = chosenId;
    saveConfig(c);
    renderStatusAndSwitcher();
    toast(`已切换到 ${chosenDef.name}`);
  };
}

// ============== Settings modal ==============
const modal = document.getElementById('settings-modal');
const tabsEl = document.getElementById('provider-tabs');
const formEl = document.getElementById('provider-form');
let modalActiveTab = 'kimi';

function bindSettingsModal() {
  btnOpenSettings.addEventListener('click', openSettingsModal);
  document.getElementById('settings-close').addEventListener('click', closeSettingsModal);
  document.getElementById('settings-cancel').addEventListener('click', closeSettingsModal);
  document.querySelector('#settings-modal .modal-backdrop').addEventListener('click', closeSettingsModal);
  document.getElementById('settings-save').addEventListener('click', handleSave);
  document.getElementById('settings-export').addEventListener('click', handleExport);
  document.getElementById('settings-import').addEventListener('click', handleImport);
  document.addEventListener('keydown', (e) => {
    if (!modal.hidden && e.key === 'Escape') closeSettingsModal();
  });
}

let modalActiveTabType = 'llm'; // 'llm' | 'search'

function openSettingsModal() { openSettingsAt(); }

function openSettingsAt(providerId, type = 'llm') {
  if (!supportedProviders.length) {
    toast('供应商列表加载中,请稍后再试'); return;
  }
  modalActiveTabType = type;
  if (type === 'search') {
    modalActiveTab = providerId || supportedSearchProviders[0]?.id || 'serper';
  } else {
    const cfg = loadConfig();
    if (providerId && supportedProviders.find(p => p.id === providerId)) {
      modalActiveTab = providerId;
    } else {
      modalActiveTab = (cfg.active && supportedProviders.find(p => p.id === cfg.active)) ? cfg.active : 'kimi';
    }
  }
  renderTabs();
  renderForm();
  modal.hidden = false;
  setTimeout(() => formEl.querySelector('input[type="password"]')?.focus(), 100);
}

function closeSettingsModal() { modal.hidden = true; }

function renderTabs() {
  const cfg = loadConfig();
  const searchCfg = loadSearchConfig();
  tabsEl.innerHTML = '';

  // LLM section
  const llmSection = document.createElement('div');
  llmSection.className = 'provider-section';
  llmSection.innerHTML = '<div class="provider-section-title">🤖 LLM 模型</div>';
  const llmTabs = document.createElement('div');
  llmTabs.className = 'provider-tabs-row';
  supportedProviders.forEach(p => {
    const tab = document.createElement('button');
    const isActive = modalActiveTabType === 'llm' && p.id === modalActiveTab;
    tab.className = 'provider-tab' + (isActive ? ' active' : '');
    const hasKey = Boolean(cfg.providers?.[p.id]?.apiKey);
    tab.innerHTML = `${p.id === 'kimi' ? '⭐ ' : ''}${escapeHtml(p.name)}${hasKey ? ' <span class="dot-on"></span>' : ''}${p.vision ? ' <span class="badge-mini">🖼️</span>' : ''}`;
    tab.addEventListener('click', () => {
      modalActiveTabType = 'llm';
      modalActiveTab = p.id;
      renderTabs();
      renderForm();
    });
    llmTabs.appendChild(tab);
  });
  llmSection.appendChild(llmTabs);
  tabsEl.appendChild(llmSection);

  // Search section
  if (supportedSearchProviders.length > 0) {
    const searchSection = document.createElement('div');
    searchSection.className = 'provider-section';
    searchSection.innerHTML = '<div class="provider-section-title">🌐 搜索服务 <span class="section-sub">(用于表情包热梗搜索)</span></div>';
    const searchTabs = document.createElement('div');
    searchTabs.className = 'provider-tabs-row';
    supportedSearchProviders.forEach(p => {
      const tab = document.createElement('button');
      const isActive = modalActiveTabType === 'search' && p.id === modalActiveTab;
      tab.className = 'provider-tab' + (isActive ? ' active' : '');
      const hasKey = Boolean(searchCfg.providers?.[p.id]?.apiKey);
      tab.innerHTML = `${escapeHtml(p.name)}${hasKey ? ' <span class="dot-on"></span>' : ''}`;
      tab.addEventListener('click', () => {
        modalActiveTabType = 'search';
        modalActiveTab = p.id;
        renderTabs();
        renderForm();
      });
      searchTabs.appendChild(tab);
    });
    searchSection.appendChild(searchTabs);
    tabsEl.appendChild(searchSection);
  }
}

function renderForm() {
  if (modalActiveTabType === 'search') return renderSearchForm();
  return renderLlmForm();
}

function renderSearchForm() {
  const def = supportedSearchProviders.find(p => p.id === modalActiveTab);
  if (!def) { formEl.innerHTML = ''; return; }
  const cfg = loadSearchConfig();
  const cur = cfg.providers?.[modalActiveTab] || {};

  formEl.innerHTML = `
    <div class="form-row">
      <label class="form-label">API Key <span class="req">*</span></label>
      <div class="key-input-wrap">
        <input type="password" id="f-apikey" placeholder="${escapeHtml(`粘贴 ${def.name} 的 API Key`)}" value="${escapeHtml(cur.apiKey || '')}">
        <button type="button" class="key-toggle" id="f-toggle">显示</button>
      </div>
      <div class="form-hint">
        没有 Key？<a href="${escapeHtml(def.signupUrl)}" target="_blank" rel="noopener">前往 ${escapeHtml(def.name)} 申请 ↗</a>
        <span style="color:var(--green-500);margin-left:8px">（${escapeHtml(def.freeTier)}）</span>
      </div>
      <div class="form-hint" style="margin-top:8px;padding:8px;background:var(--pink-50);border-radius:8px;">
        💡 Serper 是基于 Google Images 的搜索服务,邮箱注册即可,无需信用卡。
      </div>
    </div>
  `;

  document.getElementById('f-toggle').addEventListener('click', () => {
    const inp = document.getElementById('f-apikey');
    const isPwd = inp.type === 'password';
    inp.type = isPwd ? 'text' : 'password';
    document.getElementById('f-toggle').textContent = isPwd ? '隐藏' : '显示';
  });
}

function renderLlmForm() {
  const def = supportedProviders.find(p => p.id === modalActiveTab);
  if (!def) { formEl.innerHTML = ''; return; }
  const cfg = loadConfig();
  const cur = cfg.providers?.[modalActiveTab] || {};

  formEl.innerHTML = `
    <div class="form-row">
      <label class="form-label">API Key <span class="req">*</span></label>
      <div class="key-input-wrap">
        <input type="password" id="f-apikey" placeholder="${escapeHtml(`粘贴 ${def.name} 的 API Key`)}" value="${escapeHtml(cur.apiKey || '')}">
        <button type="button" class="key-toggle" id="f-toggle">显示</button>
      </div>
      <div class="form-hint">
        没有 Key？<a href="${escapeHtml(def.signupUrl)}" target="_blank" rel="noopener">前往 ${escapeHtml(def.name)} 申请 ↗</a>
        ${def.id === 'kimi' ? '<span style="color:var(--green-500);margin-left:8px">（推荐：新用户送额度）</span>' : ''}
        ${def.vision ? '<span class="badge-vision">🖼️ 支持识图</span>' : ''}
      </div>
    </div>

    <details class="form-advanced">
      <summary>高级设置（一般不用改）</summary>
      <div class="form-row">
        <label class="form-label">Base URL</label>
        <input type="text" id="f-baseurl" placeholder="${escapeHtml(def.baseUrl)}" value="${escapeHtml(cur.baseUrl || '')}">
      </div>
      <div class="form-row">
        <label class="form-label">Model</label>
        <input type="text" id="f-model" placeholder="${escapeHtml(def.model)}" value="${escapeHtml(cur.model || '')}">
        ${def.id === 'kimi' ? '<div class="form-hint">可选: moonshot-v1-8k / 32k / 128k / auto</div>' : ''}
      </div>
    </details>
  `;

  document.getElementById('f-toggle').addEventListener('click', () => {
    const inp = document.getElementById('f-apikey');
    const isPwd = inp.type === 'password';
    inp.type = isPwd ? 'text' : 'password';
    document.getElementById('f-toggle').textContent = isPwd ? '隐藏' : '显示';
  });
}

function handleSave() {
  const apiKey = document.getElementById('f-apikey').value.trim();

  if (modalActiveTabType === 'search') {
    const cfg = loadSearchConfig();
    if (!apiKey) {
      delete cfg.providers[modalActiveTab];
      toast('已清除该搜索服务配置');
    } else {
      cfg.providers[modalActiveTab] = { apiKey };
      cfg.active = modalActiveTab;
      toast(`✓ ${supportedSearchProviders.find(p => p.id === modalActiveTab).name} 已保存`);
    }
    saveSearchConfig(cfg);
    renderStatusAndSwitcher();
    closeSettingsModal();
    return;
  }

  const baseUrl = document.getElementById('f-baseurl')?.value.trim() || '';
  const model = document.getElementById('f-model')?.value.trim() || '';
  const cfg = loadConfig();
  if (!apiKey) {
    delete cfg.providers[modalActiveTab];
    toast('已清除该供应商配置');
  } else {
    cfg.providers[modalActiveTab] = { apiKey, baseUrl, model };
    cfg.active = modalActiveTab;
    toast(`✓ ${supportedProviders.find(p => p.id === modalActiveTab).name} 已保存`);
  }
  saveConfig(cfg);
  renderStatusAndSwitcher();
  closeSettingsModal();
}

function handleExport() {
  const cfg = loadConfig();
  const searchCfg = loadSearchConfig();
  const count = Object.keys(cfg.providers || {}).filter(k => cfg.providers[k]?.apiKey).length;
  const searchCount = Object.keys(searchCfg.providers || {}).filter(k => searchCfg.providers[k]?.apiKey).length;
  if (!count && !searchCount) { toast('当前没有任何已配置的供应商,无需导出', 'error'); return; }

  const payload = {
    _app: 'ops-assistant',
    _version: 'v2',
    exportedAt: new Date().toISOString(),
    active: cfg.active,
    providers: cfg.providers,
    search: searchCfg
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ops-assistant-config-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`✓ 已导出 ${count} 个供应商,请妥善保管文件(内含 API Key)`);
}

function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.providers || typeof data.providers !== 'object') {
        throw new Error('格式错误:不是有效的配置文件');
      }

      const importedIds = Object.keys(data.providers).filter(k => data.providers[k]?.apiKey);

      const current = loadConfig();
      const merged = {
        active: data.active && data.providers[data.active]?.apiKey ? data.active : current.active,
        providers: { ...current.providers }
      };
      for (const id of importedIds) {
        merged.providers[id] = data.providers[id];
      }
      saveConfig(merged);

      // 同步导入搜索服务配置(向后兼容旧文件)
      let searchImportedCount = 0;
      if (data.search?.providers) {
        const currentSearch = loadSearchConfig();
        const sIds = Object.keys(data.search.providers).filter(k => data.search.providers[k]?.apiKey);
        searchImportedCount = sIds.length;
        const mergedSearch = {
          active: data.search.active && data.search.providers[data.search.active]?.apiKey ? data.search.active : currentSearch.active,
          providers: { ...currentSearch.providers }
        };
        for (const id of sIds) mergedSearch.providers[id] = data.search.providers[id];
        saveSearchConfig(mergedSearch);
      }

      if (!importedIds.length && !searchImportedCount) {
        throw new Error('文件里没有任何已配置的供应商');
      }

      // 刷新所有 UI
      renderStatusAndSwitcher();
      renderTabs();
      renderForm();
      const parts = [];
      if (importedIds.length) parts.push(`${importedIds.length} 个 LLM`);
      if (searchImportedCount) parts.push(`${searchImportedCount} 个搜索服务`);
      toast(`✓ 已导入 ${parts.join(' + ')}`);
    } catch (err) {
      toast('导入失败: ' + err.message, 'error');
    }
  };
  input.click();
}

// ============== Utilities ==============
function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type} show`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2000);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

main().catch(e => {
  workspace.innerHTML = `<div class="empty-page error">❌ 启动失败: ${escapeHtml(e.message)}</div>`;
});
