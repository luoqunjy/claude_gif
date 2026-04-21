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
  },
  capabilities: {
    needs: [
      { kind: 'llm.text', purpose: 'AI 按模板填词', required: true },
      { kind: 'imageGen.t2i', purpose: '批量出图', required: true },
      { kind: 'llm.vision', purpose: '反推图片按模板回填字段', required: false }
    ]
  }
};
