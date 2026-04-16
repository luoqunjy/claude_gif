const PATTERNS = {
  douyin: [/douyin\.com/i, /iesdouyin\.com/i, /v\.douyin\.com/i, /dy\.com/i],
  xiaohongshu: [/xiaohongshu\.com/i, /xhslink\.com/i, /xhs\.cn/i]
};

export function detectPlatform(url) {
  if (!url) return 'unknown';
  for (const [name, patterns] of Object.entries(PATTERNS)) {
    if (patterns.some(p => p.test(url))) return name;
  }
  return 'unknown';
}

export function extractUrl(text) {
  if (!text) return null;
  const m = text.match(/https?:\/\/[^\s"'<>]+/i);
  return m ? m[0] : null;
}
