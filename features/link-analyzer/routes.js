import express from 'express';
import * as service from './service.js';

const router = express.Router();

router.post('/parse', async (req, res, next) => {
  try {
    const out = await service.parseUrl(req.body?.url);
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/analyze', async (req, res, next) => {
  try {
    const out = await service.analyze(req.body?.input, {
      provider: req.body?.provider,
      credentials: req.body?.credentials
    });
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/template', async (req, res, next) => {
  try {
    const out = await service.generateTemplate(
      req.body?.analysis,
      req.body?.topic,
      {
        provider: req.body?.provider,
        credentials: req.body?.credentials
      }
    );
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
