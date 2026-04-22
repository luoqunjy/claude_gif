/**
 * GIF 压缩模块(独立自包含)—— 从 archived/gif-maker 恢复
 *
 * 导出 mountCompressModal():在页面上挂载一个模态弹窗,点击入口按钮后打开。
 * 核心能力:上传 GIF → 目标大小/最大边设置 → 多策略阶梯压缩 → 单文件/打包下载 → 对比预览。
 *
 * 依赖:
 *   - window.GIF(gif.js) —— 由调用方在页面上先加载好(/features/emoji-studio/ui/gif.js)
 *   - JSZip —— 模块内动态 CDN 加载,仅批量打包下载时才需要
 */

// ══════════════════════════════════════════════════════════════
//  GIF 解码器(无外部依赖,完整实现 GIF89a 规范)
// ══════════════════════════════════════════════════════════════

class SimpleGifDecoder {
  constructor(buf) {
    this.data = new Uint8Array(buf);
    this.pos = 0; this.width = 0; this.height = 0;
    this.gct = null; this.frames = [];
    this._parse();
  }
  _u8() { return this.data[this.pos++]; }
  _u16() { const v = this.data[this.pos] | (this.data[this.pos + 1] << 8); this.pos += 2; return v; }
  _bytes(n) { const r = this.data.subarray(this.pos, this.pos + n); this.pos += n; return r; }
  _skipSub() { while (true) { const s = this._u8(); if (s === 0) break; this.pos += s; } }
  _readSub() {
    const chunks = []; let total = 0;
    while (true) {
      const s = this._u8(); if (s === 0) break;
      chunks.push(this.data.subarray(this.pos, this.pos + s));
      this.pos += s; total += s;
    }
    const r = new Uint8Array(total); let off = 0;
    for (const c of chunks) { r.set(c, off); off += c.length; }
    return r;
  }
  _parse() {
    const sig = String.fromCharCode(this._u8(), this._u8(), this._u8());
    this._u8(); this._u8(); this._u8();
    if (sig !== 'GIF') throw new Error('不是有效的 GIF 文件');
    this.width = this._u16(); this.height = this._u16();
    const packed = this._u8();
    const hasGCT = !!(packed & 0x80), gctSize = packed & 0x07;
    this._u8(); this._u8();
    if (hasGCT) {
      const n = 3 * (1 << (gctSize + 1));
      this.gct = this._bytes(n).slice();
    }
    let gce = null;
    while (this.pos < this.data.length) {
      const t = this._u8();
      if (t === 0x3B) break;
      if (t === 0x21) {
        const label = this._u8();
        if (label === 0xF9) {
          this._u8();
          const pk = this._u8();
          const delay = this._u16() * 10;
          const ti = this._u8();
          this._u8();
          gce = { disposal: (pk >> 2) & 7, transparent: !!(pk & 1), transparentIndex: ti, delay: delay || 100 };
        } else { this._skipSub(); }
      } else if (t === 0x2C) {
        const left = this._u16(), top = this._u16(), fw = this._u16(), fh = this._u16();
        const pk = this._u8();
        const hasLCT = !!(pk & 0x80), interlaced = !!(pk & 0x40), lctSize = pk & 0x07;
        let palette = this.gct;
        if (hasLCT) { const n = 3 * (1 << (lctSize + 1)); palette = this._bytes(n).slice(); }
        const minCodeSize = this._u8();
        const lzw = this._readSub();
        let indices = this._lzwDecode(lzw, minCodeSize, fw * fh);
        if (interlaced) indices = this._deinterlace(indices, fw, fh);
        this.frames.push({
          left, top, width: fw, height: fh, indices, palette,
          disposal: gce?.disposal || 0, delay: gce?.delay || 100,
          transparent: gce?.transparent || false,
          transparentIndex: gce?.transparentIndex || 0
        });
        gce = null;
      } else if (t === 0) { continue; } else { break; }
    }
  }
  _lzwDecode(data, minCodeSize, pixelCount) {
    const out = new Uint8Array(pixelCount); let outPos = 0;
    const clearCode = 1 << minCodeSize, endCode = clearCode + 1;
    let codeSize = minCodeSize + 1, nextCode = endCode + 1;
    const prefix = new Int16Array(4096), suffix = new Uint8Array(4096), lens = new Uint16Array(4096);
    for (let i = 0; i < clearCode; i++) { prefix[i] = -1; suffix[i] = i; lens[i] = 1; }
    let bitPos = 0; const dataLen = data.length;
    const readCode = () => {
      let c = 0, bits = 0;
      while (bits < codeSize) {
        const bp = bitPos >> 3;
        if (bp >= dataLen) return endCode;
        const bib = bitPos & 7;
        const avail = Math.min(codeSize - bits, 8 - bib);
        const mask = (1 << avail) - 1;
        c |= ((data[bp] >> bib) & mask) << bits;
        bits += avail; bitPos += avail;
      }
      return c;
    };
    const writeCode = (code) => {
      const len = lens[code];
      const tmp = new Uint8Array(len);
      let cur = code;
      for (let i = len - 1; i >= 0; i--) { tmp[i] = suffix[cur]; cur = prefix[cur]; }
      for (let i = 0; i < len && outPos < pixelCount; i++) out[outPos++] = tmp[i];
    };
    const firstOf = (code) => { let c = code; while (prefix[c] !== -1) c = prefix[c]; return suffix[c]; };
    let prevCode = -1;
    while (outPos < pixelCount) {
      const code = readCode();
      if (code === endCode) break;
      if (code === clearCode) {
        codeSize = minCodeSize + 1; nextCode = endCode + 1; prevCode = -1; continue;
      }
      let fb;
      if (prevCode === -1) {
        writeCode(code); fb = suffix[code]; prevCode = code; continue;
      }
      if (code < nextCode) {
        writeCode(code); fb = firstOf(code);
      } else {
        fb = firstOf(prevCode);
        writeCode(prevCode);
        if (outPos < pixelCount) out[outPos++] = fb;
      }
      if (nextCode < 4096) {
        prefix[nextCode] = prevCode; suffix[nextCode] = fb; lens[nextCode] = lens[prevCode] + 1;
        nextCode++;
        if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++;
      }
      prevCode = code;
    }
    return out;
  }
  _deinterlace(indices, w, h) {
    const out = new Uint8Array(indices.length); let src = 0;
    const passes = [[0, 8], [4, 8], [2, 4], [1, 2]];
    for (const [start, step] of passes) {
      for (let y = start; y < h; y += step) {
        for (let x = 0; x < w; x++) out[y * w + x] = indices[src * w + x];
        src++;
      }
    }
    return out;
  }
}

// ══════════════════════════════════════════════════════════════
//  辅助:解码 → ImageBitmap 帧序列 / 透明检测 / 策略阶梯
// ══════════════════════════════════════════════════════════════

async function decodeGif(file, onProgress) {
  const buf = await file.arrayBuffer();
  if (buf.byteLength < 10) throw new Error('文件太小,不是有效 GIF');
  const dec = new SimpleGifDecoder(buf);
  if (!dec.frames.length) throw new Error('GIF 没有帧数据');

  const w = dec.width, h = dec.height;
  if (w <= 0 || h <= 0) throw new Error('GIF 尺寸异常');

  const fullCvs = document.createElement('canvas');
  fullCvs.width = w; fullCvs.height = h;
  const fullCtx = fullCvs.getContext('2d');
  const tempCvs = document.createElement('canvas');
  const tempCtx = tempCvs.getContext('2d');

  const result = [];
  let prevSnapshot = null;

  for (let i = 0; i < dec.frames.length; i++) {
    const f = dec.frames[i];
    if (i < dec.frames.length - 1 && dec.frames[i].disposal === 3) {
      prevSnapshot = fullCtx.getImageData(0, 0, w, h);
    }
    if (!f.palette || f.palette.length < 3) continue;
    const rgba = new Uint8ClampedArray(f.width * f.height * 4);
    for (let j = 0; j < f.indices.length; j++) {
      const idx = f.indices[j];
      const p = idx * 3;
      if (f.transparent && idx === f.transparentIndex) {
        rgba[j * 4 + 3] = 0;
      } else if (p + 2 < f.palette.length) {
        rgba[j * 4] = f.palette[p];
        rgba[j * 4 + 1] = f.palette[p + 1];
        rgba[j * 4 + 2] = f.palette[p + 2];
        rgba[j * 4 + 3] = 255;
      }
    }
    tempCvs.width = f.width; tempCvs.height = f.height;
    tempCtx.putImageData(new ImageData(rgba, f.width, f.height), 0, 0);
    fullCtx.drawImage(tempCvs, f.left, f.top);

    const bitmap = await createImageBitmap(fullCvs);
    result.push({ frame: bitmap, delay: f.delay });

    if (f.disposal === 2) {
      fullCtx.clearRect(f.left, f.top, f.width, f.height);
    } else if (f.disposal === 3 && prevSnapshot) {
      fullCtx.putImageData(prevSnapshot, 0, 0);
      prevSnapshot = null;
    }
    if (onProgress) onProgress((i + 1) / dec.frames.length);
  }
  if (!result.length) throw new Error('解码后无可用帧');
  return { frames: result, width: w, height: h };
}

function disposeFrames(frames) {
  for (const f of frames) { if (f.frame && typeof f.frame.close === 'function') f.frame.close(); }
}

function hasTransparency(frames) {
  const f = frames[0];
  if (!f || !f.frame) return false;
  const cvs = document.createElement('canvas');
  cvs.width = Math.min(64, f.frame.width); cvs.height = Math.min(64, f.frame.height);
  const ctx = cvs.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(f.frame, 0, 0, cvs.width, cvs.height);
  const d = ctx.getImageData(0, 0, cvs.width, cvs.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  return false;
}

function buildCompressStrategies(targetKB) {
  if (targetKB === 0) return [{ q: 1, scaleMul: 1, skip: 1 }];
  return [
    { q: 1, scaleMul: 1.00, skip: 1 },
    { q: 1, scaleMul: 0.92, skip: 1 },
    { q: 1, scaleMul: 0.85, skip: 1 },
    { q: 1, scaleMul: 0.78, skip: 1 },
    { q: 1, scaleMul: 0.70, skip: 1 },
    { q: 1, scaleMul: 0.62, skip: 1 },
    { q: 1, scaleMul: 0.55, skip: 1 },
    { q: 1, scaleMul: 0.70, skip: 2 },
    { q: 1, scaleMul: 0.55, skip: 2 },
    { q: 1, scaleMul: 0.45, skip: 2 },
    { q: 1, scaleMul: 0.50, skip: 3 },
    { q: 1, scaleMul: 0.40, skip: 3 },
    { q: 3, scaleMul: 0.40, skip: 3 }
  ];
}

// ══════════════════════════════════════════════════════════════
//  单文件压缩核心
// ══════════════════════════════════════════════════════════════

async function compressOne(entry, opts) {
  const { onProgress } = opts;
  entry.status = 'processing';
  onProgress(entry, 0, '解码中...');

  if (entry.file.size > 80 * 1024 * 1024) {
    entry.status = 'error';
    entry.errorMsg = '文件过大(>80MB)';
    onProgress(entry, 100, '失败:文件过大');
    return;
  }

  let decodedFrames = null;
  try {
    const { frames, width: ow, height: oh } = await decodeGif(entry.file, p => {
      onProgress(entry, 3 + Math.round(p * 22), `解码 ${Math.round(p * 100)}%`);
    });
    decodedFrames = frames;
    if (!frames.length) throw new Error('没有可用帧');

    const isTransparent = hasTransparency(frames);
    const { targetKB, maxSize } = opts;

    // Fast-path:原图已达标,直接保留
    const sizeOK = targetKB === 0 || entry.originalSize <= targetKB * 1024;
    const dimOK = maxSize === 0 || (ow <= maxSize && oh <= maxSize);
    if (sizeOK && dimOK) {
      entry.blob = entry.file;
      entry.compressedSize = entry.originalSize;
      entry.compUrl = entry.origUrl;
      entry.status = 'done';
      onProgress(entry, 100, '原图已达标 ✓');
      return;
    }

    let baseScale = 1;
    if (maxSize > 0 && (ow > maxSize || oh > maxSize)) baseScale = Math.min(maxSize / ow, maxSize / oh);

    const strategies = buildCompressStrategies(targetKB);
    const outCvs = document.createElement('canvas');
    const outCtx = outCvs.getContext('2d');

    let finalBlob = null;
    for (let attempt = 0; attempt < strategies.length; attempt++) {
      const st = strategies[attempt];
      const effectiveScale = baseScale * st.scaleMul;
      const nw = Math.max(16, Math.round(ow * effectiveScale));
      const nh = Math.max(16, Math.round(oh * effectiveScale));
      const selected = frames.filter((_, i) => i % st.skip === 0);
      if (selected.length < 3 && st.skip > 1) continue;

      const label = st.skip > 1 ? `丢帧 ${st.skip}x · 尺寸 ${Math.round(st.scaleMul * 100)}%` : `尺寸 ${Math.round(st.scaleMul * 100)}%`;
      onProgress(entry, 25, `编码:${label}...`);

      outCvs.width = nw; outCvs.height = nh;
      outCtx.imageSmoothingEnabled = true;
      outCtx.imageSmoothingQuality = 'high';

      const gifOpts = {
        workers: 2,
        quality: st.q,
        workerScript: '/features/emoji-studio/ui/gif.worker.js',
        width: nw, height: nh,
        repeat: 0,
        globalPalette: true,
        dither: false
      };
      if (isTransparent) gifOpts.transparent = 0x00B955;
      const gif = new window.GIF(gifOpts);

      for (const f of selected) {
        outCtx.clearRect(0, 0, nw, nh);
        if (!isTransparent) {
          outCtx.fillStyle = '#ffffff';
          outCtx.fillRect(0, 0, nw, nh);
        }
        outCtx.drawImage(f.frame, 0, 0, nw, nh);

        if (isTransparent) {
          const imgData = outCtx.getImageData(0, 0, nw, nh);
          const d = imgData.data;
          for (let p = 0; p < d.length; p += 4) {
            const a = d[p + 3];
            if (a < 8) {
              d[p] = 0; d[p + 1] = 185; d[p + 2] = 85; d[p + 3] = 255;
            } else {
              if (a < 255) {
                const r = a / 255, ir = 1 - r;
                d[p] = Math.round(d[p] * r + 255 * ir);
                d[p + 1] = Math.round(d[p + 1] * r + 255 * ir);
                d[p + 2] = Math.round(d[p + 2] * r + 255 * ir);
              }
              if (d[p] === 0 && d[p + 1] === 185 && d[p + 2] === 85) d[p + 2] = 86;
              d[p + 3] = 255;
            }
          }
          outCtx.putImageData(imgData, 0, 0);
        }
        gif.addFrame(outCtx, { copy: true, delay: f.delay * st.skip });
      }

      const blob = await new Promise((resolve, reject) => {
        gif.on('progress', p => {
          onProgress(entry, 25 + Math.round(p * 70), `编码 ${label} ${Math.round(p * 100)}%`);
        });
        gif.on('finished', resolve);
        gif.on('abort', () => reject(new Error('编码中断')));
        gif.on('error', reject);
        gif.render();
      });

      const ok = targetKB === 0 || blob.size <= targetKB * 1024;
      const smallerThanOrig = blob.size < entry.originalSize * 0.95;
      if (ok || attempt === strategies.length - 1 || (attempt >= 5 && smallerThanOrig)) {
        finalBlob = blob;
        break;
      }
    }

    if (!finalBlob) throw new Error('压缩失败');

    entry.blob = finalBlob;
    entry.compressedSize = finalBlob.size;
    entry.compUrl = URL.createObjectURL(finalBlob);
    entry.status = 'done';
    onProgress(entry, 100, '完成 ✓');
  } catch (err) {
    entry.status = 'error';
    entry.errorMsg = err.message || '未知错误';
    onProgress(entry, 100, '失败:' + entry.errorMsg);
  } finally {
    if (decodedFrames) disposeFrames(decodedFrames);
  }
}

// ══════════════════════════════════════════════════════════════
//  JSZip 动态加载(批量打包用)
// ══════════════════════════════════════════════════════════════

let jszipLoaded = false;
async function ensureJSZip() {
  if (jszipLoaded || window.JSZip) return;
  const urls = [
    'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
    'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js'
  ];
  for (const u of urls) {
    try {
      await new Promise((ok, bad) => {
        const s = document.createElement('script');
        s.src = u;
        s.onload = ok;
        s.onerror = () => bad(new Error('加载失败: ' + u));
        document.head.appendChild(s);
      });
      jszipLoaded = true;
      return;
    } catch {}
  }
  throw new Error('JSZip 加载失败,请检查网络');
}

// ══════════════════════════════════════════════════════════════
//  UI:模态弹窗
// ══════════════════════════════════════════════════════════════

function formatSize(b) { return b >= 1048576 ? (b / 1048576).toFixed(2) + ' MB' : (b / 1024).toFixed(1) + ' KB'; }

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

export function mountCompressModal(root) {
  // 样式只注入一次
  if (!document.getElementById('gif-compress-styles')) {
    const style = document.createElement('style');
    style.id = 'gif-compress-styles';
    style.textContent = `
      .gifc-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.55);display:none;align-items:center;justify-content:center;z-index:1000;padding:20px }
      .gifc-overlay.on { display:flex }
      .gifc-box { background:#fff;border-radius:14px;width:min(800px,96vw);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3) }
      .gifc-head { padding:14px 20px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between }
      .gifc-head h2 { margin:0;font-size:16px }
      .gifc-close { background:none;border:0;font-size:20px;cursor:pointer;color:#888 }
      .gifc-body { padding:16px 20px;overflow:auto;flex:1 }
      .gifc-drop { border:2px dashed #e5b3cd;border-radius:10px;padding:28px;text-align:center;color:#777;cursor:pointer;transition:all .2s }
      .gifc-drop:hover,.gifc-drop.dragover { border-color:#ec4899;background:#fff0f6 }
      .gifc-opts { display:flex;gap:16px;margin-top:14px;flex-wrap:wrap;align-items:center;font-size:13px }
      .gifc-opts label { display:flex;flex-direction:column;gap:4px;color:#555 }
      .gifc-opts select { padding:5px 8px;border:1px solid #ddd;border-radius:6px;font-size:13px }
      .gifc-list { margin-top:14px;display:flex;flex-direction:column;gap:10px;max-height:320px;overflow:auto }
      .gifc-item { display:flex;gap:12px;padding:10px;border:1px solid #eee;border-radius:8px;align-items:center }
      .gifc-item.processing { border-color:#fbbf24;background:#fffbeb }
      .gifc-item.done { border-color:#86efac;background:#f0fdf4 }
      .gifc-item.error { border-color:#fca5a5;background:#fef2f2 }
      .gifc-thumb { width:56px;height:56px;object-fit:cover;border-radius:6px;background:#eee;flex-shrink:0 }
      .gifc-info { flex:1;min-width:0 }
      .gifc-name { font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap }
      .gifc-sizes { font-size:12px;color:#666;margin-top:2px }
      .gifc-sizes .arrow { margin:0 6px;color:#999 }
      .gifc-sizes .after { color:#16a34a;font-weight:600 }
      .gifc-sizes .after.over { color:#dc2626 }
      .gifc-sizes .saved { margin-left:8px;color:#16a34a }
      .gifc-progress { display:flex;align-items:center;gap:8px;margin-top:4px }
      .gifc-bar { flex:1;height:4px;background:#f3f4f6;border-radius:2px;overflow:hidden }
      .gifc-fill { height:100%;background:#ec4899;transition:width .2s }
      .gifc-prog-text { font-size:11px;color:#888;flex-shrink:0 }
      .gifc-actions { display:flex;gap:6px;flex-shrink:0 }
      .gifc-action { background:none;border:1px solid #e5e7eb;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:13px }
      .gifc-action.primary { background:#ec4899;color:#fff;border-color:#ec4899 }
      .gifc-action.danger { color:#dc2626 }
      .gifc-action:disabled { opacity:0.4;cursor:not-allowed }
      .gifc-foot { padding:12px 20px;border-top:1px solid #eee;display:flex;gap:10px;justify-content:flex-end;align-items:center }
      .gifc-btn { padding:8px 14px;border:1px solid #ec4899;border-radius:7px;background:#ec4899;color:#fff;cursor:pointer;font-size:13px }
      .gifc-btn:disabled { background:#ddd;border-color:#ddd;cursor:not-allowed }
      .gifc-btn.ghost { background:#fff;color:#ec4899 }
      .gifc-hint { color:#888;font-size:12px;margin-right:auto }
      .gifc-preview-modal { position:fixed;inset:0;background:rgba(0,0,0,0.85);display:none;align-items:center;justify-content:center;z-index:1001;padding:20px }
      .gifc-preview-modal.on { display:flex }
      .gifc-preview-box { background:#fff;border-radius:12px;padding:16px;max-width:96vw;max-height:92vh;overflow:auto }
      .gifc-preview-box h3 { margin:0 0 10px;font-size:15px }
      .gifc-preview-grid { display:grid;grid-template-columns:1fr 1fr;gap:14px }
      .gifc-preview-col { text-align:center }
      .gifc-preview-col img { max-width:100%;max-height:50vh;background:
        linear-gradient(45deg, #ddd 25%, transparent 25%),
        linear-gradient(-45deg, #ddd 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #ddd 75%),
        linear-gradient(-45deg, transparent 75%, #ddd 75%);
        background-size:20px 20px;
        background-position:0 0,0 10px,10px -10px,-10px 0px;border-radius:6px }
      .gifc-preview-stats { margin-top:12px;font-size:13px;color:#555;text-align:center }
    `;
    document.head.appendChild(style);
  }

  const overlay = document.createElement('div');
  overlay.className = 'gifc-overlay';
  overlay.innerHTML = `
    <div class="gifc-box">
      <div class="gifc-head">
        <h2>🗜️ GIF 压缩 —— 拖入/选择 .gif 文件,批量压缩到目标大小</h2>
        <button class="gifc-close" data-close>✕</button>
      </div>
      <div class="gifc-body">
        <div class="gifc-drop" data-drop>
          <div style="font-size:36px">📥</div>
          <div style="margin-top:8px;color:#555">拖拽 GIF 文件到这里 / 点击选择</div>
          <div style="font-size:11px;color:#aaa;margin-top:4px">支持批量,单文件 &lt;80MB</div>
          <input type="file" accept="image/gif" multiple hidden data-input>
        </div>
        <div class="gifc-opts">
          <label>
            <span>目标大小</span>
            <select data-target>
              <option value="0">不限(仅优化)</option>
              <option value="100">≤ 100 KB</option>
              <option value="200">≤ 200 KB</option>
              <option value="500" selected>≤ 500 KB</option>
              <option value="1024">≤ 1 MB</option>
              <option value="2048">≤ 2 MB</option>
              <option value="5120">≤ 5 MB</option>
            </select>
          </label>
          <label>
            <span>最大边长</span>
            <select data-maxsize>
              <option value="0">保持原尺寸</option>
              <option value="200">200 px</option>
              <option value="400" selected>400 px</option>
              <option value="600">600 px</option>
              <option value="800">800 px</option>
              <option value="1200">1200 px</option>
            </select>
          </label>
          <span style="color:#888;font-size:11px;max-width:280px">
            策略:先缩尺寸保全部帧,实在不行再丢帧;色彩质量永远最优(q=1,无抖动)。
          </span>
        </div>
        <div class="gifc-list" data-list></div>
      </div>
      <div class="gifc-foot">
        <span class="gifc-hint" data-hint></span>
        <button class="gifc-btn ghost" data-clear>清空</button>
        <button class="gifc-btn" data-compress-all disabled>▶ 开始压缩</button>
        <button class="gifc-btn" data-download-all disabled>📦 下载全部</button>
      </div>
    </div>
    <div class="gifc-preview-modal" data-preview>
      <div class="gifc-preview-box">
        <h3 data-preview-title></h3>
        <div class="gifc-preview-grid">
          <div class="gifc-preview-col">
            <div style="font-size:12px;color:#888;margin-bottom:4px">原图 · <span data-preview-orig-size></span></div>
            <img data-preview-orig>
          </div>
          <div class="gifc-preview-col">
            <div style="font-size:12px;color:#888;margin-bottom:4px">压缩后 · <span data-preview-comp-size></span></div>
            <img data-preview-comp>
          </div>
        </div>
        <div class="gifc-preview-stats" data-preview-stats></div>
        <div style="text-align:right;margin-top:10px"><button class="gifc-btn ghost" data-preview-close>关闭</button></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const $ = (s) => overlay.querySelector(s);
  const listEl = $('[data-list]');
  const dropEl = $('[data-drop]');
  const inputEl = $('[data-input]');
  const targetEl = $('[data-target]');
  const maxsizeEl = $('[data-maxsize]');
  const btnCompressAll = $('[data-compress-all]');
  const btnDownloadAll = $('[data-download-all]');
  const btnClear = $('[data-clear]');
  const hintEl = $('[data-hint]');
  const previewEl = $('[data-preview]');

  let files = [];
  let running = false;

  function addFiles(fileList) {
    let added = 0;
    for (const f of fileList) {
      if (!/\.gif$/i.test(f.name) && f.type !== 'image/gif') continue;
      files.push({
        id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        file: f, name: f.name, originalSize: f.size,
        origUrl: URL.createObjectURL(f), compUrl: null,
        status: 'pending', progress: 0, progressText: '等待压缩',
        blob: null, compressedSize: 0, errorMsg: ''
      });
      added++;
    }
    if (added) render();
  }

  function render() {
    const targetKB = parseInt(targetEl.value);
    if (!files.length) {
      listEl.innerHTML = '';
      btnCompressAll.disabled = true;
      btnDownloadAll.disabled = true;
      hintEl.textContent = '';
      return;
    }
    listEl.innerHTML = files.map(f => {
      const over = f.compressedSize > 0 && targetKB > 0 && f.compressedSize > targetKB * 1024;
      const savedPct = f.compressedSize > 0 ? Math.round((1 - f.compressedSize / f.originalSize) * 100) : 0;
      return `
        <div class="gifc-item ${f.status}" data-id="${f.id}">
          <img class="gifc-thumb" src="${f.origUrl}" alt="">
          <div class="gifc-info">
            <div class="gifc-name">${f.name}</div>
            <div class="gifc-sizes">
              <span>${formatSize(f.originalSize)}</span>
              ${f.compressedSize ? `<span class="arrow">→</span><span class="after${over ? ' over' : ''}">${formatSize(f.compressedSize)}</span><span class="saved">${savedPct > 0 ? '↓' + savedPct + '%' : ''}</span>` : ''}
            </div>
            <div class="gifc-progress">
              <div class="gifc-bar"><div class="gifc-fill" style="width:${f.progress}%"></div></div>
              <span class="gifc-prog-text">${f.progressText}</span>
            </div>
          </div>
          <div class="gifc-actions">
            <button class="gifc-action" data-preview-id="${f.id}" ${f.status === 'done' ? '' : 'disabled'}>👁</button>
            <button class="gifc-action primary" data-download-id="${f.id}" ${f.status === 'done' ? '' : 'disabled'}>⬇</button>
            <button class="gifc-action danger" data-del-id="${f.id}">✕</button>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-preview-id]').forEach(b => b.onclick = () => showCompare(b.dataset.previewId));
    listEl.querySelectorAll('[data-download-id]').forEach(b => b.onclick = () => {
      const f = files.find(x => x.id === b.dataset.downloadId);
      if (f?.blob) downloadBlob(f.blob, f.name.replace(/\.gif$/i, '_compressed.gif'));
    });
    listEl.querySelectorAll('[data-del-id]').forEach(b => b.onclick = () => {
      files = files.filter(x => x.id !== b.dataset.delId);
      render();
    });

    btnCompressAll.disabled = running || files.every(f => f.status === 'done');
    btnDownloadAll.disabled = !files.some(f => f.status === 'done');
    const doneCount = files.filter(f => f.status === 'done').length;
    hintEl.textContent = `${files.length} 个文件,${doneCount} 个已完成`;
  }

  function showCompare(id) {
    const f = files.find(x => x.id === id);
    if (!f || !f.compUrl) return;
    $('[data-preview-title]').textContent = f.name;
    $('[data-preview-orig]').src = f.origUrl;
    $('[data-preview-comp]').src = f.compUrl;
    $('[data-preview-orig-size]').textContent = formatSize(f.originalSize);
    $('[data-preview-comp-size]').textContent = formatSize(f.compressedSize);
    const savedPct = Math.round((1 - f.compressedSize / f.originalSize) * 100);
    const savedSize = formatSize(f.originalSize - f.compressedSize);
    $('[data-preview-stats]').innerHTML = savedPct > 0
      ? `压缩率 <strong>↓ ${savedPct}%</strong> · 节省 <strong>${savedSize}</strong>`
      : '原图已是最优,压缩后未减少';
    previewEl.classList.add('on');
  }

  // 事件绑定
  $('[data-close]').onclick = () => overlay.classList.remove('on');
  overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.remove('on'); };
  $('[data-preview-close]').onclick = () => previewEl.classList.remove('on');
  previewEl.onclick = (e) => { if (e.target === previewEl) previewEl.classList.remove('on'); };
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (previewEl.classList.contains('on')) { previewEl.classList.remove('on'); return; }
    if (overlay.classList.contains('on')) overlay.classList.remove('on');
  });

  dropEl.onclick = () => inputEl.click();
  inputEl.onchange = (e) => { addFiles(e.target.files); inputEl.value = ''; };
  dropEl.addEventListener('dragover', (e) => { e.preventDefault(); dropEl.classList.add('dragover'); });
  dropEl.addEventListener('dragleave', () => dropEl.classList.remove('dragover'));
  dropEl.addEventListener('drop', (e) => {
    e.preventDefault(); dropEl.classList.remove('dragover');
    addFiles(e.dataTransfer.files);
  });

  btnClear.onclick = () => { files.forEach(f => URL.revokeObjectURL(f.origUrl)); files = []; render(); };
  targetEl.onchange = render;

  btnCompressAll.onclick = async () => {
    const pending = files.filter(f => f.status !== 'done');
    if (!pending.length) return;
    running = true;
    btnCompressAll.disabled = true;
    const targetKB = parseInt(targetEl.value);
    const maxSize = parseInt(maxsizeEl.value);
    const onItemProgress = (entry, pct, text) => {
      entry.progress = pct; entry.progressText = text;
      const el = listEl.querySelector(`[data-id="${entry.id}"]`);
      if (el) {
        const fill = el.querySelector('.gifc-fill');
        const txt = el.querySelector('.gifc-prog-text');
        if (fill) fill.style.width = pct + '%';
        if (txt) txt.textContent = text;
      }
    };
    for (const f of pending) {
      await compressOne(f, { targetKB, maxSize, onProgress: onItemProgress });
      render();
    }
    running = false;
    render();
  };

  btnDownloadAll.onclick = async () => {
    const done = files.filter(f => f.status === 'done' && f.blob);
    if (!done.length) return;
    if (done.length === 1) {
      downloadBlob(done[0].blob, done[0].name.replace(/\.gif$/i, '_compressed.gif'));
      return;
    }
    btnDownloadAll.disabled = true;
    const originalText = btnDownloadAll.textContent;
    btnDownloadAll.textContent = '加载打包库...';
    try {
      await ensureJSZip();
      btnDownloadAll.textContent = '打包中...';
      const zip = new window.JSZip();
      done.forEach(f => { zip.file(f.name.replace(/\.gif$/i, '_compressed.gif'), f.blob); });
      const content = await zip.generateAsync({ type: 'blob' });
      downloadBlob(content, 'compressed_gifs_' + Date.now() + '.zip');
    } catch (err) {
      alert('打包失败:' + err.message);
    } finally {
      btnDownloadAll.disabled = false;
      btnDownloadAll.textContent = originalText;
    }
  };

  // 返回 open 函数让外部入口按钮调用
  return {
    open() { overlay.classList.add('on'); },
    close() { overlay.classList.remove('on'); }
  };
}
