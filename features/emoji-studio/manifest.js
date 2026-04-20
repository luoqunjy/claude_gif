import router from './routes.js';

export default {
  id: 'emoji-studio',
  name: '爆款表情工厂',
  icon: '🏭',
  description: '文字表情 / 角色表情 / 结构化提示词 / 批量生成 / 抠图 / GIF 动画化 一站式产线',
  routes: {
    prefix: '/api/emoji-studio',
    router
  },
  ui: {
    panel: 'features/emoji-studio/ui/panel.html',
    script: 'features/emoji-studio/ui/panel.js'
  }
};
