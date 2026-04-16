import router from './routes.js';

export default {
  id: 'link-analyzer',
  name: '内容链接分析',
  icon: '🔗',
  description: '粘贴抖音/小红书链接或上传多模态内容，自动拆解结构并生成可复用模板',
  routes: {
    prefix: '/api/link-analyzer',
    router
  },
  ui: {
    panel: 'features/link-analyzer/ui/panel.html',
    script: 'features/link-analyzer/ui/panel.js'
  }
};
