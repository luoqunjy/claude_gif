import router from './routes.js';

export default {
  id: 'meme-designer',
  name: '表情包设计助手',
  icon: '🎨',
  description: '反推提示词 / 生成表情包 / 文案库 / 经典模板 / 热梗搜索',
  routes: {
    prefix: '/api/meme-designer',
    router
  },
  ui: {
    panel: 'features/meme-designer/ui/panel.html',
    script: 'features/meme-designer/ui/panel.js'
  }
};
