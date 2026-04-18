import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFeatures } from './core/registry.js';
import { llmInfo } from './core/llm.js';
import { supportedSearchProviders } from './core/search.js';
import { imageGenInfo } from './core/image-gen.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: '15mb' }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/features', express.static(path.join(__dirname, 'features')));

const features = await loadFeatures();

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    llm: llmInfo(),
    search: { supported: supportedSearchProviders() },
    imageGen: imageGenInfo(),
    features: features.map(f => f.id)
  });
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

// 未匹配的 API 路径返回 JSON 404
app.use('/api', (req, res) => {
  res.status(404).json({ error: `no such route: ${req.method} ${req.originalUrl}` });
});

// 其他所有未匹配路径回落到 index.html(SPA-style,避免被 Express 默认 404 页吓到)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[err]', err);
  res.status(500).json({ error: err.message || 'internal error' });
});

// 只在本地直接运行时启动监听; Vercel/其他 serverless 环境会 import 本模块并自行托管
if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`\n🌸 运营助手 running at http://localhost:${port}`);
    console.log(`   模式: BYO Key (用户在页面填写自己的 API Key)\n`);
  });
}

export default app;
