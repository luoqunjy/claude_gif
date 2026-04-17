import router from './routes.js';

export default {
  id: 'gif-maker',
  name: '静态图转 GIF',
  icon: '✨',
  description: '100+ 动画效果 / 特效叠加 / AI 自定义动画 / GIF 批量压缩',
  routes: {
    prefix: '/api/gif-maker',
    router
  },
  ui: {
    panel: 'features/gif-maker/ui/panel.html',
    script: 'features/gif-maker/ui/panel.js'
  }
};
