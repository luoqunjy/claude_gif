import express from 'express';
import * as service from './service.js';

const router = express.Router();

function wrap(handler) {
  return async (req, res) => {
    try {
      const out = await handler(req.body || {});
      res.json(out);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  };
}

router.post('/pipeline', wrap(body => service.fullPipeline(body)));
router.post('/benchmark', wrap(body => service.benchmark(body)));
router.post('/analyze', wrap(body => service.analyze(body)));
router.post('/write', wrap(body => service.writeNote(body)));
router.post('/regenerate', wrap(body => service.regenerate(body)));

export default router;
