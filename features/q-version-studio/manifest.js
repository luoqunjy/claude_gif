import router from './routes.js';

export default {
  id: 'q-version-studio',
  name: 'Q版 Prompt',
  icon: '🎨',
  description: '上传立绘 + 选风格/传参考 → 生成 5 家主流 AI 作图工具的 Q版专属 Prompt,一键跳转预填',
  routes: { prefix: '/api/q-version-studio', router },
  ui: {
    panel: 'features/q-version-studio/ui/panel.html',
    script: 'features/q-version-studio/ui/panel.js'
  },
  capabilities: {
    needs: [
      { kind: 'llm.vision', purpose: '读参考图拆解 6 维度结构', required: true },
      { kind: 'llm.text', purpose: '生成各模型专属 Prompt', required: true }
    ]
  }
};
