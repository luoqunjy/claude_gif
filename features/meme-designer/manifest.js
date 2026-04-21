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
  },
  // 注:将被 emoji-studio 替代,保留做过渡期对照
  deprecated: true,
  replacedBy: 'emoji-studio',
  capabilities: {
    needs: [
      { kind: 'llm.text', purpose: '提示词生成', required: true },
      { kind: 'llm.vision', purpose: '反推表情包图片', required: false },
      { kind: 'search.images', purpose: '热梗图搜索', required: false }
    ]
  }
};
