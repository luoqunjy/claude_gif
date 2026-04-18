import express from 'express';
import * as service from './service.js';

const router = express.Router();
const wrap = (h) => async (req, res) => {
  try { res.json(await h(req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
};

router.post('/expand-prompt', wrap(b => service.expandPrompt(b)));
router.post('/analyze-ref', wrap(b => service.analyzeReference(b)));
router.post('/generate', wrap(b => service.generate(b)));
router.post('/search', wrap(b => service.searchCovers(b)));

/**
 * 图片代理:绕开源站 CORS + Referer 限制,让前端能复制/下载搜索结果
 * 白名单:仅允许 http/https + content-type 是 image/*
 * 超时 12s,防止服务端被拖住
 */
router.get('/proxy-image', async (req, res) => {
  const url = req.query.url;
  if (!url || typeof url !== 'string') {
    return res.status(400).send('url required');
  }
  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).send('invalid url');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
        'Accept': 'image/*,*/*'
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    if (!r.ok) return res.status(r.status).send(`upstream ${r.status}`);
    const ct = r.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return res.status(400).send('not an image');
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(buf);
  } catch (e) {
    res.status(502).send(`proxy error: ${e.message}`);
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
