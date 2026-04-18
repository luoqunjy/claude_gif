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

export default router;
