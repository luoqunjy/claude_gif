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

router.post('/fill', wrap(b => service.fillTemplate(b)));
router.post('/generate', wrap(b => service.generateBatch(b)));
router.post('/reverse', wrap(b => service.reverse(b)));
router.get('/presets', (req, res) => res.json(service.presetTemplates()));

export default router;
