import express from 'express';
import * as service from './service.js';

const router = express.Router();
const wrap = (h) => async (req, res) => {
  try { res.json(await h(req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
};

// 一键模式:读图+风格 → 返回 6 维度 + 全部模型的 prompt
router.post('/one-shot', wrap(b => service.oneShot(b)));

// 分步 1:仅读图拆解成 6 维度
router.post('/extract', wrap(b => service.extractDimensions(b)));

// 分步 2:基于已有 6 维度生成指定模型 prompt
router.post('/render', wrap(b => service.renderPrompt(b)));

// 风格库反向提取(M3.5):Q版 图 → qStylePack
router.post('/extract-style', wrap(b => service.extractStyle(b)));

// 列出支持的目标图像模型
router.get('/models', (req, res) => res.json({ models: service.SUPPORTED_MODELS }));

export default router;
