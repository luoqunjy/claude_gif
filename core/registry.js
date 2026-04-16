import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FEATURES_DIR = path.join(__dirname, '..', 'features');

export async function loadFeatures() {
  if (!fs.existsSync(FEATURES_DIR)) return [];
  const features = [];
  const dirs = fs.readdirSync(FEATURES_DIR).filter(d => {
    const full = path.join(FEATURES_DIR, d);
    return fs.statSync(full).isDirectory();
  });

  for (const dir of dirs) {
    const manifestPath = path.join(FEATURES_DIR, dir, 'manifest.js');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const mod = await import(pathToFileURL(manifestPath).href);
      const manifest = mod.default;
      if (!manifest?.id) {
        console.warn(`! feature ${dir}: missing manifest.id`);
        continue;
      }
      features.push({ dir, ...manifest });
    } catch (err) {
      console.error(`✗ feature ${dir} failed to load:`, err.message);
    }
  }
  return features;
}
