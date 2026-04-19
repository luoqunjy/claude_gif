/**
 * IP 角色系统 — 露露 (知性向导) + 团小满 (常驻陪伴)
 *
 * 核心能力:
 *   - 团小满固定右下角常驻: 呼吸/眨眼/挥手/点击互动/鼠标追踪转头
 *   - 露露按 feature 出现引导,带对话气泡
 *   - 全局 fetch 拦截: 自动在 API 调用时触发"施法中/完成/出错"反馈
 *   - 单图 + CSS 动画方案,无需额外素材
 */

(() => {
  const ASSETS = {
    tuanxiaoman: '/assets/tuanxiaoman.png',
    lulu: '/assets/lulu.png'
  };

  // 文案池(后续可以 i18n)
  const WELCOME = ['欢迎回来~', '今天想做点什么?', '记得带上灵感!', '我一直在这里陪你~', '今天气色不错呀'];
  const CLICK = ['戳我干嘛呀~', '好痒好痒!', 'Hi~', '摸摸头,摸摸头', '要抱抱吗?', '看我跳一下!', '嘿嘿嘿~'];
  const CASTING = ['正在施法中…', 'AI 正在思考…', '马上就好~', '努力中,稍等~', '让我想一下…'];
  const SUCCESS = ['✨ 完成啦!', '看看效果!', '成功~', '耶!搞定了', '这波稳了', '🎉 完美!'];
  const ERROR = ['哎呀出错了', '再试一次?', '网络有点慢?', '有点小问题…', '换个姿势试试?'];

  // 进入不同 feature 时的欢迎语
  const FEATURE_INTROS = {
    'link-analyzer': '拆个爆款链接?我陪你!',
    'meme-designer': '来做个会火的表情包~',
    'gif-maker': '把静图变活!一起来!',
    'cover-designer': '做一张抓眼的封面呀~'
  };

  // 只对这些 API 路径触发反馈,避免每个健康检查都说话
  const TRACKED_API_PATTERNS = [
    '/analyze', '/generate', '/reverse', '/captions', '/gallery',
    '/expand-prompt', '/analyze-ref', '/ai-animation',
    '/parse', '/template',
    '/search'  // Serper 搜索
  ];

  const state = {
    tuanxiaoman: { el: null, img: null, bubble: null, bubbleTimer: null, stateTimer: null },
    lulu: { el: null, img: null, bubble: null, bubbleTimer: null }
  };

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ============ 团小满: 右下角常驻 ============
  function mountTuanxiaoman() {
    if (state.tuanxiaoman.el) return;
    const container = document.createElement('div');
    container.className = 'mascot mascot-tuanxiaoman';
    container.innerHTML = `
      <div class="mascot-bubble" style="display:none"></div>
      <img class="mascot-img" src="${ASSETS.tuanxiaoman}" alt="团小满" draggable="false">
    `;
    document.body.appendChild(container);

    const img = container.querySelector('.mascot-img');
    const bubble = container.querySelector('.mascot-bubble');

    state.tuanxiaoman.el = container;
    state.tuanxiaoman.img = img;
    state.tuanxiaoman.bubble = bubble;

    // 图片加载失败 → 隐藏整个 mascot 容器,不破坏页面
    img.addEventListener('error', () => {
      container.dataset.failed = '1';
      console.info('[mascot] tuanxiaoman 图片未找到,角色隐藏。保存 /assets/tuanxiaoman.png 即可出现。');
    }, { once: true });

    // 点击互动
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      say('tuanxiaoman', pick(CLICK));
      triggerAnim(container, 'bounce', 600);
    });

    // 鼠标追踪(轻微倾斜),让它感觉在看你
    document.addEventListener('mousemove', (e) => {
      if (!container.isConnected || container.dataset.failed) return;
      if (container.classList.contains('bounce') || container.classList.contains('celebrate') || container.classList.contains('sad') || container.classList.contains('casting')) return;
      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      // 水平距离 ±150px 内产生 ±5deg 微倾
      const tilt = Math.max(-5, Math.min(5, dx / 30));
      // 只在非 hover 状态下应用(hover 有自己的挥手动画)
      if (!container.matches(':hover')) {
        img.style.transform = `rotate(${tilt}deg)`;
      }
    }, { passive: true });

    // 离开窗口时归位
    document.addEventListener('mouseleave', () => {
      if (img) img.style.transform = '';
    });
  }

  // ============ 露露: 挂载到指定容器 ============
  function mountLulu(container, { size = 90 } = {}) {
    if (!container) return null;
    const lulu = document.createElement('div');
    lulu.className = 'mascot mascot-lulu enter';
    lulu.style.width = size + 'px';
    lulu.style.height = (size * 1.35) + 'px';
    lulu.innerHTML = `
      <div class="mascot-bubble" style="display:none"></div>
      <img class="mascot-img" src="${ASSETS.lulu}" alt="露露" draggable="false">
    `;
    container.appendChild(lulu);

    const img = lulu.querySelector('.mascot-img');
    img.addEventListener('error', () => {
      lulu.dataset.failed = '1';
      console.info('[mascot] lulu 图片未找到,角色隐藏。保存 /assets/lulu.png 即可出现。');
    }, { once: true });

    // 移除进场动画类,让呼吸动画接替
    setTimeout(() => lulu.classList.remove('enter'), 700);

    // 记为最新挂载的 lulu,后续 say('lulu', …) 会作用其上
    state.lulu.el = lulu;
    state.lulu.img = img;
    state.lulu.bubble = lulu.querySelector('.mascot-bubble');

    return lulu;
  }

  // ============ 气泡说话 ============
  function say(who, text, duration = 3800) {
    const s = state[who];
    if (!s?.bubble) return;
    if (s.el?.dataset?.failed) return;  // 图都挂了不说话
    clearTimeout(s.bubbleTimer);

    s.bubble.textContent = text;
    s.bubble.style.display = 'block';
    s.bubble.classList.remove('fade-out');
    s.bubble.classList.add('fade-in');

    s.bubbleTimer = setTimeout(() => {
      s.bubble.classList.remove('fade-in');
      s.bubble.classList.add('fade-out');
      setTimeout(() => {
        if (s.bubble) s.bubble.style.display = 'none';
      }, 260);
    }, duration);
  }

  function triggerAnim(el, klass, durationMs) {
    clearTimeout(state.tuanxiaoman.stateTimer);
    el.classList.remove('bounce', 'casting', 'celebrate', 'sad');
    // 强制 reflow 让动画重启
    void el.offsetWidth;
    el.classList.add(klass);
    state.tuanxiaoman.stateTimer = setTimeout(() => {
      el.classList.remove(klass);
    }, durationMs);
  }

  // ============ 公开 API ============
  window.Mascot = {
    init() {
      mountTuanxiaoman();
      setTimeout(() => say('tuanxiaoman', pick(WELCOME), 3500), 1200);
      this.wrapFetch();
    },

    say, pick,

    mountLulu,

    onFeatureEnter(featureId) {
      const msg = FEATURE_INTROS[featureId];
      if (msg) say('tuanxiaoman', msg, 3200);
    },

    onCasting() {
      if (!state.tuanxiaoman.el) return;
      state.tuanxiaoman.el.classList.add('casting');
      say('tuanxiaoman', pick(CASTING), 10000);
    },

    onSuccess() {
      if (!state.tuanxiaoman.el) return;
      state.tuanxiaoman.el.classList.remove('casting');
      triggerAnim(state.tuanxiaoman.el, 'celebrate', 800);
      say('tuanxiaoman', pick(SUCCESS), 2800);
    },

    onError() {
      if (!state.tuanxiaoman.el) return;
      state.tuanxiaoman.el.classList.remove('casting');
      triggerAnim(state.tuanxiaoman.el, 'sad', 1200);
      say('tuanxiaoman', pick(ERROR), 3200);
    },

    // 拦截 fetch,自动对关键 API 调用触发反馈
    wrapFetch() {
      const origFetch = window.fetch.bind(window);
      window.fetch = async function mascotFetch(input, init) {
        const url = typeof input === 'string' ? input : input?.url || '';
        const tracked = TRACKED_API_PATTERNS.some(p => url.includes(p));

        if (tracked) window.Mascot.onCasting();

        try {
          const res = await origFetch(input, init);
          if (tracked) {
            if (res.ok) {
              // 给小反馈:不是每次都 celebrate(避免过度),70% 概率说话
              setTimeout(() => {
                if (Math.random() < 0.7) window.Mascot.onSuccess();
                else {
                  // 安静模式:只归位状态,不说话
                  state.tuanxiaoman.el?.classList.remove('casting');
                }
              }, 400);
            } else {
              setTimeout(() => window.Mascot.onError(), 400);
            }
          }
          return res;
        } catch (err) {
          if (tracked) setTimeout(() => window.Mascot.onError(), 400);
          throw err;
        }
      };
    }
  };

  // ============ 自动启动 ============
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.Mascot.init());
  } else {
    window.Mascot.init();
  }
})();
