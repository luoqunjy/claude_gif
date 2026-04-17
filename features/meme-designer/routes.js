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

router.post('/reverse', wrap(body => service.reverse(body)));
router.post('/generate', wrap(body => service.generate(body)));
router.post('/captions', wrap(body => service.captions(body)));
router.post('/gallery', wrap(body => service.gallery(body)));
router.post('/search', wrap(body => service.search(body)));

export default router;
