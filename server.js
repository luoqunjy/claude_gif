import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFeatures } from './core/registry.js';
import { llmInfo } from './core/llm.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: '15mb' }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/features', express.static(path.join(__dirname, 'features')));

const features = await loadFeatures();

app.get('/api/health', (req, res) => {
  res.json({ ok: true, llm: llmInfo(), features: features.map(f => f.id) });
});

app.get('/api/features', (req, res) => {
  res.json(features.map(f => ({
    id: f.id,
    name: f.name,
    icon: f.icon,
    description: f.description,
    ui: f.ui
  })));
});

for (const f of features) {
  if (f.routes?.prefix && f.routes?.router) {
    app.use(f.routes.prefix, f.routes.router);
    console.log(`✓ feature loaded: ${f.id} @ ${f.routes.prefix}`);
  }
}

app.use((err, req, res, next) => {
  console.error('[err]', err);
  res.status(500).json({ error: err.message || 'internal error' });
});

// 只在本地直接运行时启动监听; Vercel/其他 serverless 环境会 import 本模块并自行托管
if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    const info = llmInfo();
    console.log(`\n🌸 运营助手 running at http://localhost:${port}`);
    console.log(`   LLM: ${info.available ? '✓ 已配置' : '✗ 未配置 (降级规则模式)'}\n`);
  });
}

export default app;
