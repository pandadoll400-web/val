import { viteSingleFile } from 'vite-plugin-singlefile';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const now = new Date();
const BUILD = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

/** After each build, also copy the playable file to the Desktop (always the latest version). */
function copyToDesktop() {
  return {
    name: 'copy-to-desktop',
    apply: 'build',
    closeBundle() {
      const src = path.join(here, 'index.html');
      // web version: Vercel / Firebase Hosting serve this folder (works on any OS)
      try {
        fs.mkdirSync(path.join(here, 'dist'), { recursive: true });
        fs.copyFileSync(src, path.join(here, 'dist', 'index.html'));
        fs.mkdirSync(path.join(here, 'hosting'), { recursive: true });
        fs.copyFileSync(src, path.join(here, 'hosting', 'index.html'));
      } catch (e) { console.warn('  (dist 복사 실패)', e.message); }
      // local convenience: latest playable file on the Desktop (skipped on build servers)
      const desk = path.join(os.homedir(), 'Desktop');
      if (!fs.existsSync(desk)) return;
      try {
        const dest = path.join(desk, '얼음협곡.html');
        fs.copyFileSync(src, dest);
        console.log(`\n  ✔ 바탕화면에 최신본 복사: ${dest}`);
      } catch (e) {
        console.warn('  (바탕화면 복사 실패 — val\\index.html 을 직접 여세요)', e.message);
      }
    },
  };
}

// Source lives in src/. `npm run build` writes ONE self-contained file to ../index.html
// (the project folder) and copies it to Desktop\얼음협곡.html.
export default {
  root: 'src',
  base: './',
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [viteSingleFile(), copyToDesktop()],
  server: { host: true, port: 5173, open: true },
  build: { outDir: '..', emptyOutDir: false, chunkSizeWarningLimit: 3000 },
};
