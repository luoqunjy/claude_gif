const nav = document.getElementById('feature-nav');
const workspace = document.getElementById('workspace');
const llmStatus = document.getElementById('llm-status');
const llmSwitcher = document.getElementById('llm-switcher');
const llmSelect = document.getElementById('llm-select');

const STORAGE_KEY = 'opsAssistant.provider';

/** 全局 App 对象,feature panel 可读取当前 provider */
window.App = {
  getProvider() {
    return localStorage.getItem(STORAGE_KEY) || null;
  },
  setProvider(id) {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }
};

let active = null;

async function main() {
  const [health, features] = await Promise.all([
    fetch('/api/health').then(r => r.json()).catch(() => null),
    fetch('/api/features').then(r => r.json())
  ]);

  renderLlmUi(health);

  if (!features.length) {
    workspace.innerHTML = `<div class="empty-page">尚未注册任何功能模块</div>`;
    return;
  }

  features.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'nav-item';
    item.innerHTML = `
      <span class="nav-icon">${f.icon || '🔸'}</span>
      <div class="nav-meta">
        <div class="nav-name">${escapeHtml(f.name)}</div>
      </div>
    `;
    item.addEventListener('click', () => loadFeature(f, item));
    nav.appendChild(item);
    if (i === 0) loadFeature(f, item);
  });
}

async function loadFeature(feature, el) {
  if (active === feature.id) return;
  active = feature.id;
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

function renderLlmUi(health) {
  const llm = health?.llm;
  const providers = llm?.providers || [];

  // Status badge
  if (providers.length > 0) {
    const storedProvider = window.App.getProvider();
    const valid = providers.find(p => p.id === storedProvider);
    const current = valid || providers.find(p => p.id === llm.active) || providers[0];
    window.App.setProvider(current.id);

    llmStatus.classList.remove('warn');
    llmStatus.classList.add('ok');
    llmStatus.querySelector('.llm-text').textContent = `${current.name} · ${current.model}`;
    llmStatus.title = current.baseUrl;
  } else {
    llmStatus.classList.remove('ok');
    llmStatus.classList.add('warn');
    llmStatus.querySelector('.llm-text').textContent = 'LLM 未配置（规则模式）';
    llmStatus.title = '请在 .env 中填入任一供应商的 API Key 后重启';
  }

  // Switcher dropdown
  if (providers.length >= 2) {
    llmSwitcher.hidden = false;
    llmSelect.innerHTML = '';
    providers.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name}${p.vision ? ' · 🖼️' : ''}`;
      llmSelect.appendChild(opt);
    });
    llmSelect.value = window.App.getProvider() || providers[0].id;
    llmSelect.addEventListener('change', () => {
      window.App.setProvider(llmSelect.value);
      const p = providers.find(x => x.id === llmSelect.value);
      if (p) {
        llmStatus.querySelector('.llm-text').textContent = `${p.name} · ${p.model}`;
        llmStatus.title = p.baseUrl;
        toast(`已切换到 ${p.name}`);
      }
    });
  } else {
    llmSwitcher.hidden = true;
  }
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast show';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 1800);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

main().catch(e => {
  workspace.innerHTML = `<div class="empty-page error">❌ 启动失败: ${escapeHtml(e.message)}</div>`;
});
