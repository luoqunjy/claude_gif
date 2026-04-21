import router from './routes.js';

export default {
  id: 'xhs-copywriter',
  name: '小红书爆款文案生成器',
  icon: '📕',
  description: '基于 CES 算法,按 5 种爆款类型生成标题/正文/标签/封面提示词/发布时间',
  routes: {
    prefix: '/api/xhs-copywriter',
    router
  },
  ui: {
    panel: 'features/xhs-copywriter/ui/panel.html',
    script: 'features/xhs-copywriter/ui/panel.js'
  },
  capabilities: {
    needs: [
      { kind: 'llm.text', purpose: '拆解爆款套路 + 写作', required: true },
      { kind: 'search.web', purpose: '搜真实对标笔记', required: true }
    ]
  }
};
