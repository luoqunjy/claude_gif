import router from './routes.js';

export default {
  id: 'cover-designer',
  name: '封面图设计助手',
  icon: '🖼️',
  description: '找热门封面 / 主题生图 / 参考图仿制,一键出多尺寸封面',
  routes: { prefix: '/api/cover-designer', router },
  ui: {
    panel: 'features/cover-designer/ui/panel.html',
    script: 'features/cover-designer/ui/panel.js'
  },
  capabilities: {
    needs: [
      { kind: 'llm.text', purpose: '封面文案 / 风格分析', required: true },
      { kind: 'imageGen.t2i', purpose: '主题生图', required: true },
      { kind: 'search.images', purpose: '找热门封面参考', required: false }
    ]
  }
};
