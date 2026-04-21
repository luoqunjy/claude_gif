/**
 * 应用壳:加载 features、维护 LLM 凭据(localStorage)、渲染 API 设置弹窗
 */

const STORAGE_KEY = 'opsAssistant.llm.v2';
const SEARCH_STORAGE_KEY = 'opsAssistant.search.v1';
const IMAGE_STORAGE_KEY = 'opsAssistant.imageGen.v1';

// ============== Storage helpers ==============
function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { active: 'kimi', providers: {}, modulePreferences: {} };
  } catch {
    return { active: 'kimi', providers: {}, modulePreferences: {} };
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
function loadImageConfig() {
  try {
    return JSON.parse(localStorage.getItem(IMAGE_STORAGE_KEY)) || { active: 'google-imagen', providers: {} };
  } catch {
    return { active: 'google-imagen', providers: {} };
  }
}
function saveImageConfig(cfg) {
  localStorage.setItem(IMAGE_STORAGE_KEY, JSON.stringify(cfg));
}

// ============== Globals exposed to feature panels ==============
window.App = {
  // —— 全局默认 (向后兼容) ——
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
    return App.getCredentialsFor();
  },

  // —— 新: 按模块/按能力选择模型 ——
  // featureId: e.g. 'meme-designer', 'cover-designer'
  // requireVision: 若 true,偏好视觉模型
  getCredentialsFor(featureId, { requireVision = false } = {}) {
    const cfg = loadConfig();
    const prefs = cfg.modulePreferences?.[featureId] || {};
    // 1. 模块偏好; 2. 全局 active; 3. 默认 kimi
    let providerId = prefs.llm || cfg.active || 'kimi';
    // 能力要求不满足时,自动降级到第一个满足能力的已配置模型
    if (requireVision) {
      const def = supportedProviders.find(p => p.id === providerId);
      if (!def?.vision) {
        const fallback = supportedProviders.find(p => p.vision && cfg.providers?.[p.id]?.apiKey);
        if (fallback) providerId = fallback.id;
      }
    }
    const cred = cfg.providers?.[providerId];
    if (!cred?.apiKey) return null;
    return { provider: providerId, credentials: cred };
  },

  getImageCredentialsFor(featureId) {
    const llmCfg = loadConfig();
    const imgCfg = loadImageConfig();
    const prefs = llmCfg.modulePreferences?.[featureId] || {};
    const providerId = prefs.imageGen || imgCfg.active;
    if (!providerId) return null;
    const cred = imgCfg.providers?.[providerId];
    if (!cred?.apiKey) return null;
    return { provider: providerId, credentials: cred };
  },

  setModulePreference(featureId, type, providerId) {
    const cfg = loadConfig();
    if (!cfg.modulePreferences) cfg.modulePreferences = {};
    if (!cfg.modulePreferences[featureId]) cfg.modulePreferences[featureId] = {};
    if (providerId) {
      cfg.modulePreferences[featureId][type] = providerId;
    } else {
      delete cfg.modulePreferences[featureId][type];
    }
    saveConfig(cfg);
    renderStatusAndSwitcher();
  },

  getModulePreference(featureId, type) {
    const cfg = loadConfig();
    return cfg.modulePreferences?.[featureId]?.[type] || null;
  },

  // —— 搜索 ——
  getSearchCredentials() {
    const cfg = loadSearchConfig();
    const active = cfg.active || 'serper';
    const cred = cfg.providers?.[active];
    if (!cred?.apiKey) return null;
    return { provider: active, ...cred };
  },

  // —— 能力查询 ——
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
  listConfiguredLlmProviders() {
    const cfg = loadConfig();
    return supportedProviders.filter(p => cfg.providers?.[p.id]?.apiKey);
  },
  listConfiguredImageProviders() {
    const cfg = loadImageConfig();
    return supportedImageProviders.filter(p => cfg.providers?.[p.id]?.apiKey);
  },
  listSupportedImageProviders() {
    return [...supportedImageProviders];
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
  openSettings(tabId, type = 'llm') { openSettingsAt(tabId, type); },

  // —— 可复用 UI: 模型选择芯片 ——
  // 插在 feature panel 顶部让用户为本 feature 切换模型
  // 新增:按 feature.capabilities 自动过滤 + 标记不兼容
  createModelChip({ featureId, type = 'llm', onChange, requireCapability = null }) {
    const chip = document.createElement('div');
    chip.className = 'model-chip';

    // Resolve required capabilities from feature manifest
    const feature = (cachedFeatures || []).find(f => f.id === featureId);
    const needs = feature?.capabilities?.needs || [];
    const typeNeeds = needs.filter(n => n.kind?.startsWith(type === 'imageGen' ? 'imageGen' : 'llm'));
    const needsVision = requireCapability === 'vision' || typeNeeds.some(n => n.kind === 'llm.vision' && n.required);
    const needsT2I = typeNeeds.some(n => n.kind === 'imageGen.t2i' && n.required);

    function providerSupports(p) {
      const caps = p.capabilities || [];
      if (type === 'imageGen') return needsT2I ? caps.includes('t2i') : true;
      if (needsVision) return caps.includes('vision') || p.vision;
      return caps.includes('text') || !caps.length;
    }

    renderChip();

    function renderChip() {
      const options = type === 'imageGen' ? supportedImageProviders : supportedProviders;
      const cfg = type === 'imageGen' ? loadImageConfig() : loadConfig();

      const curId = type === 'imageGen'
        ? (App.getImageCredentialsFor(featureId)?.provider)
        : (App.getCredentialsFor(featureId, { requireVision: needsVision })?.provider);
      const curDef = options.find(p => p.id === curId);

      const icon = type === 'imageGen' ? '🎨' : '📝';
      const name = curDef?.name || '(未选择)';
      const missing = !curId;
      const incompat = curDef && !providerSupports(curDef);

      chip.className = 'model-chip' + (missing ? ' compat-fail' : incompat ? ' compat-warn' : '');

      chip.innerHTML = `
        <button class="chip-btn ${missing ? 'warn' : ''}" title="${missing ? '未配置兼容的模型' : incompat ? '当前模型可能不支持本功能' : ''}">
          <span class="chip-icon">${icon}</span>
          <span class="chip-name">${escapeHtml(name)}</span>
          ${incompat ? '<span style="color:#c85000;margin-left:4px">⚠</span>' : ''}
          <span class="chip-caret">▾</span>
        </button>
      `;
      const btn = chip.querySelector('.chip-btn');
      btn.onclick = (e) => {
        e.stopPropagation();
        showMenu();
      };
    }

    function showMenu() {
      const existing = document.querySelector('.chip-menu');
      if (existing) { existing.remove(); return; }
      const cfg = type === 'imageGen' ? loadImageConfig() : loadConfig();
      const options = type === 'imageGen' ? supportedImageProviders : supportedProviders;

      const menu = document.createElement('div');
      menu.className = 'chip-menu';

      // Sort: compatible+configured first, compatible+unconfigured next, incompatible last
      const sorted = [...options].sort((a, b) => {
        const aComp = providerSupports(a), bComp = providerSupports(b);
        const aKey = Boolean(cfg.providers?.[a.id]?.apiKey), bKey = Boolean(cfg.providers?.[b.id]?.apiKey);
        if (aComp !== bComp) return aComp ? -1 : 1;
        if (aKey !== bKey) return aKey ? -1 : 1;
        return 0;
      });

      const opts = sorted.map(p => {
        const hasKey = Boolean(cfg.providers?.[p.id]?.apiKey);
        const compat = providerSupports(p);
        const badges = [];
        if (p.capabilities?.includes('vision')) badges.push('<span class="chip-badge">🖼️</span>');
        if (p.recommended && compat) badges.push('<span class="chip-badge" style="background:#ffb700;color:#fff">★</span>');
        const note = !compat ? '' : (hasKey ? '' : '<span class="chip-dim">· 未配置</span>');
        return `<div class="chip-menu-item ${hasKey ? '' : 'unconfigured'} ${compat ? '' : 'incompat'}" data-id="${p.id}" ${!compat ? 'title="此模型不支持本功能所需能力"' : ''}>
          ${escapeHtml(p.name)}${badges.join('')}${note}
        </div>`;
      }).join('');

      const capHint = typeNeeds.length
        ? `本功能需要: ${typeNeeds.map(n => n.kind.split('.')[1]).join(' + ')}`
        : '';

      menu.innerHTML = `
        <div class="chip-menu-title">${type === 'imageGen' ? '🎨 图像模型' : '📝 文本模型'} · 仅本模块生效</div>
        ${capHint ? `<div class="chip-menu-item cap-badges">${capHint}</div>` : ''}
        ${opts}
        <div class="chip-menu-item chip-menu-clear" data-id="">使用全局默认</div>
      `;

      const rect = chip.getBoundingClientRect();
      menu.style.position = 'fixed';
      menu.style.top = `${rect.bottom + 4}px`;
      menu.style.left = `${rect.left}px`;
      menu.style.zIndex = '500';
      document.body.appendChild(menu);

      menu.querySelectorAll('.chip-menu-item').forEach(it => {
        it.onclick = () => {
          const id = it.dataset.id;
          const hasKey = id ? Boolean(cfg.providers?.[id]?.apiKey) : true;
          if (id && !hasKey) {
            // 未配置,打开设置跳到对应 tab
            openSettingsAt(id, type === 'imageGen' ? 'imageGen' : 'llm');
            menu.remove();
            return;
          }
          App.setModulePreference(featureId, type, id || null);
          menu.remove();
          renderChip();
          if (onChange) onChange(id);
        };
      });

      // 点外部关闭
      setTimeout(() => {
        const off = (e) => {
          if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', off);
          }
        };
        document.addEventListener('click', off);
      }, 0);
    }

    chip.refresh = renderChip;
    return chip;
  }
};
const App = window.App;

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
let supportedImageProviders = [];

async function main() {
  const [health, features] = await Promise.all([
    fetch('/api/health').then(r => r.json()).catch(() => null),
    fetch('/api/features').then(r => r.json())
  ]);

  supportedProviders = health?.llm?.supported || [];
  supportedSearchProviders = health?.search?.supported || [];
  supportedImageProviders = health?.imageGen?.supported || [];

  renderStatusAndSwitcher();
  bindSettingsModal();

  if (!features.length) {
    workspace.innerHTML = `<div class="empty-page">尚未注册任何功能模块</div>`;
    return;
  }

  // 缓存 features 给 landing 页用
  cachedFeatures = features;

  // 先加"首页"nav,再加各 feature
  const homeItem = document.createElement('div');
  homeItem.className = 'nav-item active';
  homeItem.dataset.homeNav = '1';
  homeItem.innerHTML = `
    <span class="nav-icon">🏠</span>
    <div class="nav-meta"><div class="nav-name">首页</div></div>
  `;
  homeItem.addEventListener('click', () => renderLanding());
  nav.appendChild(homeItem);

  features.forEach((f) => {
    const item = document.createElement('div');
    item.className = 'nav-item';
    item.dataset.featureId = f.id;
    item.innerHTML = `
      <span class="nav-icon">${f.icon || '🔸'}</span>
      <div class="nav-meta"><div class="nav-name">${escapeHtml(f.name)}</div></div>
    `;
    item.addEventListener('click', () => loadFeature(f, item));
    nav.appendChild(item);
  });

  // 品牌区点击也回到首页
  document.querySelector('.brand')?.addEventListener('click', () => renderLanding());

  // 默认展示首页(不再自动进第一个 feature)
  renderLanding();

  // 首次访问且未配置 → 自动弹出设置
  if (!window.App.hasAnyKey()) {
    setTimeout(() => openSettingsModal(), 800);
  }
}

let cachedFeatures = [];

function renderLanding() {
  activeFeatureId = null;
  [...nav.children].forEach(c => c.classList.toggle('active', !!c.dataset.homeNav));

  workspace.innerHTML = `
    <div class="landing">
      <div class="landing-hero">
        <div class="landing-hero-characters">
          <img class="landing-lulu" src="/assets/lulu.png" alt="露露" draggable="false"
               onerror="this.style.display='none'">
        </div>
        <div class="landing-hero-text">
          <div class="landing-chip">运营小助手 · Ops Assistant</div>
          <h1 class="landing-title">你好呀~ 我是<span class="hl">露露</span></h1>
          <p class="landing-subtitle">和右下角的<span class="hl-green">团小满</span>一起,陪你做出爆款内容 ✨</p>
          <p class="landing-hint">选一个工具开始,或者直接从左侧边栏切换</p>
        </div>
      </div>

      <div class="landing-grid">
        ${cachedFeatures.map(f => `
          <button class="landing-card" data-feature-id="${escapeHtml(f.id)}">
            <div class="landing-card-icon">${f.icon || '🔸'}</div>
            <div class="landing-card-body">
              <div class="landing-card-title">${escapeHtml(f.name)}</div>
              <div class="landing-card-desc">${escapeHtml(f.description || '')}</div>
            </div>
            <div class="landing-card-arrow">→</div>
          </button>
        `).join('')}
      </div>

      <div class="landing-footer">
        <span>🔑 用自己的 API Key 驱动</span>
        <span>·</span>
        <span>数据全部存在你自己的浏览器</span>
      </div>
    </div>
  `;

  workspace.querySelectorAll('.landing-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.featureId;
      const feature = cachedFeatures.find(f => f.id === id);
      const navItem = [...nav.children].find(c => c.dataset.featureId === id);
      if (feature && navItem) loadFeature(feature, navItem);
    });
  });

  // 对 landing 的 Lulu 图加载失败降级
  const luluImg = workspace.querySelector('.landing-lulu');
  if (luluImg) {
    luluImg.addEventListener('load', () => {
      if (luluImg.naturalWidth === 0) luluImg.style.display = 'none';
    });
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
    // 页面转场:淡入
    workspace.classList.remove('fade-in');
    void workspace.offsetWidth;
    workspace.classList.add('fade-in');

    const mod = await import('/' + feature.ui.script + '?v=' + Date.now());
    if (typeof mod.mount === 'function') mod.mount(workspace);

    // 把空态里的 emoji icon 换成露露
    setTimeout(() => upgradeEmptyStates(workspace), 0);

    // 团小满对用户打个招呼
    window.Mascot?.onFeatureEnter?.(feature.id);
  } catch (e) {
    workspace.innerHTML = `<div class="empty-page error">❌ 加载失败: ${escapeHtml(e.message)}</div>`;
  }
}

// 扫描 .empty 里的 .empty-icon, 替换成露露露头(加载失败则保留原 emoji)
function upgradeEmptyStates(root) {
  root.querySelectorAll('.empty .empty-icon').forEach(icon => {
    if (icon.dataset.upgraded) return;
    icon.dataset.upgraded = '1';
    const origContent = icon.innerHTML;
    const img = document.createElement('img');
    img.className = 'empty-lulu-img';
    img.src = '/assets/lulu.png';
    img.alt = '露露';
    img.draggable = false;
    img.addEventListener('load', () => {
      if (img.naturalWidth === 0) {
        // fallback 到 emoji
        icon.innerHTML = origContent;
      } else {
        icon.classList.add('empty-icon-lulu');
      }
    });
    img.addEventListener('error', () => { icon.innerHTML = origContent; });
    icon.innerHTML = '';
    icon.appendChild(img);
  });
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

// ============== Settings modal (Model Library) ==============
const modal = document.getElementById('settings-modal');
const libRoot = document.getElementById('lib-root');
let modalActiveTab = 'zhipu';

function bindSettingsModal() {
  btnOpenSettings.addEventListener('click', openSettingsModal);
  document.getElementById('settings-close').addEventListener('click', closeSettingsModal);
  document.getElementById('settings-cancel').addEventListener('click', closeSettingsModal);
  document.querySelector('#settings-modal .modal-backdrop').addEventListener('click', closeSettingsModal);
  document.getElementById('settings-export').addEventListener('click', handleExport);
  document.getElementById('settings-import').addEventListener('click', handleImport);
  document.addEventListener('keydown', (e) => {
    if (!modal.hidden && e.key === 'Escape') closeSettingsModal();
  });
}

let modalActiveTabType = 'llm'; // 'llm' | 'search' | 'imageGen'

function openSettingsModal() { openSettingsAt(); }

function openSettingsAt(providerId, type = 'llm') {
  if (!supportedProviders.length) {
    toast('供应商列表加载中,请稍后再试'); return;
  }
  modalActiveTabType = type;
  modalActiveTab = providerId || null;
  renderModelLibrary();
  modal.hidden = false;
  // Auto-scroll to the requested provider card
  if (providerId) {
    setTimeout(() => {
      const card = libRoot.querySelector(`.lib-card[data-pid="${providerId}"][data-ptype="${type}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.querySelector('input[type="password"]')?.focus();
      }
    }, 100);
  }
}

function closeSettingsModal() { modal.hidden = true; }

// ---- Aggregate what each feature uses (for "用于:" labels) ----
function featuresUsing(capKind) {
  return (cachedFeatures || []).filter(f => {
    const needs = f.capabilities?.needs || [];
    return needs.some(n => n.kind === capKind);
  });
}
const CAP_META = {
  text: { label: '文本', icon: '📝' },
  vision: { label: '识图', icon: '👁️' },
  t2i: { label: '文生图', icon: '🎨' },
  i2i: { label: '图生图', icon: '🔄' },
  web: { label: '搜网页', icon: '🌐' },
  images: { label: '搜图片', icon: '🖼️' }
};

function priceTag(def) {
  const p = def.pricing; if (!p) return '';
  const cls = p.tier === 'free-unlimited' || p.tier === 'free-trial' ? 'price-free'
           : p.tier === 'paid-cheap' ? 'price-cheap' : 'price-paid';
  return `<span class="lib-chip ${cls}">${escapeHtml(p.label || p.tier)}</span>`;
}

function capChips(def) {
  return (def.capabilities || []).map(c => {
    const m = CAP_META[c] || { label: c, icon: '' };
    return `<span class="lib-chip cap">${m.icon} ${escapeHtml(m.label)}</span>`;
  }).join('');
}

function usedByText(capKind) {
  const features = featuresUsing(capKind);
  if (!features.length) return '';
  return `用于: ${features.map(f => `<strong>${escapeHtml(f.name)}</strong>`).join(' · ')}`;
}

// ---- Render the full model library ----
function renderModelLibrary() {
  const llmCfg = loadConfig();
  const searchCfg = loadSearchConfig();
  const imgCfg = loadImageConfig();

  // Sort: recommended first, then configured, then others
  const sortProviders = (list, getCfg) => [...list].sort((a, b) => {
    const ak = getCfg(a.id), bk = getCfg(b.id);
    if (a.recommended && !b.recommended) return -1;
    if (b.recommended && !a.recommended) return 1;
    if (ak && !bk) return -1;
    if (bk && !ak) return 1;
    return 0;
  });

  const llmList = sortProviders(supportedProviders, id => llmCfg.providers?.[id]?.apiKey);
  const imgList = sortProviders(supportedImageProviders, id => imgCfg.providers?.[id]?.apiKey);
  const searchList = sortProviders(supportedSearchProviders, id => searchCfg.providers?.[id]?.apiKey);

  libRoot.innerHTML = `
    <div class="lib-sec">
      <div class="lib-sec-head">
        <h3>📝 文本模型 (LLM)</h3>
        <span class="sub">文字生成 / 提示词 / 识图 (部分)</span>
        <span class="used-by">${usedByText('llm.text')}</span>
      </div>
      <div class="lib-grid">
        ${llmList.map(p => renderCard(p, 'llm', Boolean(llmCfg.providers?.[p.id]?.apiKey))).join('')}
      </div>
    </div>

    <div class="lib-sec">
      <div class="lib-sec-head">
        <h3>🎨 图像生成</h3>
        <span class="sub">文生图 / 后续会加图生图</span>
        <span class="used-by">${usedByText('imageGen.t2i')}</span>
      </div>
      <div class="lib-grid">
        ${imgList.map(p => renderCard(p, 'imageGen', Boolean(imgCfg.providers?.[p.id]?.apiKey))).join('')}
      </div>
    </div>

    <div class="lib-sec">
      <div class="lib-sec-head">
        <h3>🔍 搜索服务</h3>
        <span class="sub">搜真实笔记 / 热梗图</span>
        <span class="used-by">${usedByText('search.web') || usedByText('search.images')}</span>
      </div>
      <div class="lib-grid">
        ${searchList.map(p => renderCard(p, 'search', Boolean(searchCfg.providers?.[p.id]?.apiKey))).join('')}
      </div>
    </div>

    <div class="lib-sec">
      <div class="lib-sec-head">
        <h3>✂ 抠图</h3>
        <span class="sub">P1 规划中 · Replicate / 抠抠图 / 火山视觉</span>
      </div>
      <div style="font-size:12.5px;color:var(--ink-500);padding:14px;background:var(--pink-50);border-radius:10px;line-height:1.6;">
        P1 将接入 3 家抠图服务,支持生图后一键去背景。目前新生成的图暂不支持抠图,需要的话可以先用 <a href="https://www.koukoutu.com" target="_blank" rel="noopener" style="color:#d6336c">抠抠图</a> 在线版。
      </div>
    </div>
  `;

  // Bind handlers on all cards
  libRoot.querySelectorAll('.lib-card').forEach(card => {
    const pid = card.dataset.pid;
    const ptype = card.dataset.ptype;
    const btnToggle = card.querySelector('[data-action="toggle"]');
    const btnClear = card.querySelector('[data-action="clear"]');
    const btnSave = card.querySelector('[data-action="save"]');
    const btnCancel = card.querySelector('[data-action="cancel"]');
    const keyInput = card.querySelector('input[type="password"]');
    const keyToggle = card.querySelector('.toggle');

    btnToggle?.addEventListener('click', () => {
      const isOpen = card.classList.contains('open');
      libRoot.querySelectorAll('.lib-card.open').forEach(c => collapseCard(c));
      if (!isOpen) expandCard(card);
    });
    btnCancel?.addEventListener('click', () => collapseCard(card));
    btnSave?.addEventListener('click', () => saveCard(pid, ptype, card));
    btnClear?.addEventListener('click', () => {
      if (!confirm('清除这个模型的 API Key?')) return;
      saveCard(pid, ptype, card, { clear: true });
    });
    keyToggle?.addEventListener('click', () => {
      if (!keyInput) return;
      const isPwd = keyInput.type === 'password';
      keyInput.type = isPwd ? 'text' : 'password';
      keyToggle.textContent = isPwd ? '隐藏' : '显示';
    });
  });

  // Open requested card
  if (modalActiveTab) {
    const card = libRoot.querySelector(`.lib-card[data-pid="${modalActiveTab}"][data-ptype="${modalActiveTabType}"]`);
    if (card) expandCard(card);
  }
}

function expandCard(card) {
  card.classList.add('open');
  const cfgBox = card.querySelector('.lib-cfg');
  if (cfgBox) cfgBox.hidden = false;
}
function collapseCard(card) {
  card.classList.remove('open');
  const cfgBox = card.querySelector('.lib-cfg');
  if (cfgBox) cfgBox.hidden = true;
}

function renderCard(def, ptype, configured) {
  const cfgObj = ptype === 'imageGen' ? loadImageConfig() : (ptype === 'search' ? loadSearchConfig() : loadConfig());
  const cur = cfgObj.providers?.[def.id] || {};

  const steps = (def.signupSteps || []).map(s => `<li>${escapeHtml(s)}</li>`).join('');

  return `
    <div class="lib-card ${configured ? 'configured' : ''} ${def.recommended ? 'recommended' : ''}" data-pid="${escapeHtml(def.id)}" data-ptype="${escapeHtml(ptype)}">
      <div class="lib-card-head">
        <span class="ico">${def.icon || '🤖'}</span>
        <div class="name">${escapeHtml(def.name)}</div>
        <div class="status">
          ${configured ? '<span class="status on">✓ 已配置</span>' : '<span class="status off">未配置</span>'}
        </div>
      </div>
      ${def.tagline ? `<div class="tagline">${escapeHtml(def.tagline)}</div>` : ''}
      <div class="lib-chips">
        ${capChips(def)}
        ${priceTag(def)}
      </div>
      ${def.warning ? `<div class="lib-warn">${escapeHtml(def.warning)}</div>` : ''}
      <div class="lib-card-actions">
        <button class="lib-btn primary" data-action="toggle">${configured ? '⚙ 查看 / 修改' : '⚡ 配置 Key'}</button>
        ${def.signupUrl ? `<a class="lib-btn" href="${escapeHtml(def.signupUrl)}" target="_blank" rel="noopener" style="text-decoration:none">${configured ? '官网' : '去申请 ↗'}</a>` : ''}
      </div>

      <div class="lib-cfg" hidden>
        ${steps ? `<div><h4>3 步拿 Key</h4><ol>${steps}</ol></div>` : ''}
        <div>
          <label class="lib-input-label">API Key <span class="req">*</span></label>
          <div class="lib-key-wrap">
            <input type="password" class="lib-f-apikey" placeholder="粘贴你的 API Key" value="${escapeHtml(cur.apiKey || '')}">
            <button class="toggle" type="button">显示</button>
          </div>
        </div>
        <details class="lib-adv">
          <summary>高级设置 (一般不用改)</summary>
          <div class="row">
            <label class="lib-input-label">Model ID${def.id === 'doubao' ? ' <span style="color:#c92a2a">· 必填你开通的具体版本</span>' : ''}</label>
            <div class="lib-key-wrap"><input type="text" class="lib-f-model" placeholder="${escapeHtml(def.model || '')}" value="${escapeHtml(cur.model || '')}"></div>
          </div>
          <div class="row">
            <label class="lib-input-label">Base URL</label>
            <div class="lib-key-wrap"><input type="text" class="lib-f-baseurl" placeholder="${escapeHtml(def.baseUrl || '')}" value="${escapeHtml(cur.baseUrl || '')}"></div>
          </div>
        </details>
        <div class="lib-cfg-actions">
          ${configured ? '<button class="lib-btn danger" data-action="clear">🗑 清除</button>' : ''}
          <span class="spacer"></span>
          <button class="lib-btn" data-action="cancel">取消</button>
          <button class="lib-btn primary" data-action="save">💾 保存</button>
        </div>
      </div>
    </div>
  `;
}

function saveCard(pid, ptype, card, { clear = false } = {}) {
  const apiKey = clear ? '' : (card.querySelector('.lib-f-apikey')?.value.trim() || '');
  const model = card.querySelector('.lib-f-model')?.value.trim() || '';
  const baseUrl = card.querySelector('.lib-f-baseurl')?.value.trim() || '';

  if (ptype === 'search') {
    const cfg = loadSearchConfig();
    if (!apiKey) { delete cfg.providers[pid]; toast('已清除'); }
    else { cfg.providers[pid] = { apiKey }; cfg.active = pid; toast('✓ 已保存'); }
    saveSearchConfig(cfg);
  } else if (ptype === 'imageGen') {
    const cfg = loadImageConfig();
    if (!apiKey) { delete cfg.providers[pid]; toast('已清除'); }
    else { cfg.providers[pid] = { apiKey, baseUrl, model }; cfg.active = pid; toast('✓ 已保存'); }
    saveImageConfig(cfg);
  } else {
    const cfg = loadConfig();
    if (!apiKey) { delete cfg.providers[pid]; toast('已清除'); }
    else { cfg.providers[pid] = { apiKey, baseUrl, model }; cfg.active = pid; toast('✓ 已保存'); }
    saveConfig(cfg);
  }
  renderStatusAndSwitcher();
  renderModelLibrary();
}

// Back-compat stubs (old code path references)
function renderTabs() { renderModelLibrary(); }
function renderForm() { /* no-op: rendered inside renderModelLibrary */ }



function handleExport() {
  const cfg = loadConfig();
  const searchCfg = loadSearchConfig();
  const imageCfg = loadImageConfig();
  const count = Object.keys(cfg.providers || {}).filter(k => cfg.providers[k]?.apiKey).length;
  const searchCount = Object.keys(searchCfg.providers || {}).filter(k => searchCfg.providers[k]?.apiKey).length;
  const imageCount = Object.keys(imageCfg.providers || {}).filter(k => imageCfg.providers[k]?.apiKey).length;
  if (!count && !searchCount && !imageCount) { toast('当前没有任何已配置的供应商,无需导出', 'error'); return; }

  const payload = {
    _app: 'ops-assistant',
    _version: 'v3',
    exportedAt: new Date().toISOString(),
    active: cfg.active,
    providers: cfg.providers,
    modulePreferences: cfg.modulePreferences || {},
    search: searchCfg,
    imageGen: imageCfg
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

      // 同步导入搜索服务配置
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

      // 同步导入图像生成配置
      let imageImportedCount = 0;
      if (data.imageGen?.providers) {
        const currentImage = loadImageConfig();
        const iIds = Object.keys(data.imageGen.providers).filter(k => data.imageGen.providers[k]?.apiKey);
        imageImportedCount = iIds.length;
        const mergedImage = {
          active: data.imageGen.active && data.imageGen.providers[data.imageGen.active]?.apiKey ? data.imageGen.active : currentImage.active,
          providers: { ...currentImage.providers }
        };
        for (const id of iIds) mergedImage.providers[id] = data.imageGen.providers[id];
        saveImageConfig(mergedImage);
      }

      // 模块偏好也合并
      if (data.modulePreferences) {
        const cfg2 = loadConfig();
        cfg2.modulePreferences = { ...(cfg2.modulePreferences || {}), ...data.modulePreferences };
        saveConfig(cfg2);
      }

      if (!importedIds.length && !searchImportedCount && !imageImportedCount) {
        throw new Error('文件里没有任何已配置的供应商');
      }

      // 刷新所有 UI
      renderStatusAndSwitcher();
      renderTabs();
      renderForm();
      const parts = [];
      if (importedIds.length) parts.push(`${importedIds.length} 个 LLM`);
      if (searchImportedCount) parts.push(`${searchImportedCount} 个搜索服务`);
      if (imageImportedCount) parts.push(`${imageImportedCount} 个图像模型`);
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
