import express from 'express';
import * as service from './service.js';

const router = express.Router();

router.post('/ai-animation', async (req, res) => {
  try {
    const out = await service.generateAnimation(req.body || {});
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
