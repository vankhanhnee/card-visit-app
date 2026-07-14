/* Cong cu 1 lan: tai Noto Sans JP + SC (woff2, chia subset theo unicode-range)
 * va sinh src/templates/fonts/cjk.css — moi @font-face nhung san data-URL.
 *
 * Vi sao subset: ban day du cua font CJK nang ~6MB/weight. Google Fonts cat
 * thanh ~120 mieng theo unicode-range; Chromium chi decode mieng nao chua ky tu
 * that su xuat hien tren card.
 *
 * Chay: node scripts/fetch-cjk-fonts.js
 */
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');

const OUT = path.join(__dirname, '..', 'src', 'templates', 'fonts', 'cjk.css');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const FAMILIES = [
  { name: 'Noto Sans JP', q: 'Noto+Sans+JP' },
  { name: 'Noto Sans SC', q: 'Noto+Sans+SC' },
];
/* App dung 3 weight: Regular (lien he, chuc danh dong 2), SemiBold (chuc danh
 * dong 1 + ten cong ty), ExtraBold (ho va ten).
 *
 * Font Nhat/Trung phai co DU CA BA: thieu weight nao thi Chromium lay weight gan
 * nhat, va neu chi con weight nhe hon thi no BOI DAM GIA (synthetic bold) — net
 * chu Nhat be ra, khong giong ban thiet ke. */
const WEIGHTS = [400, 600, 800];

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);

/* Uu tien fetch cua Node (co san tren moi may CI, vd Vercel). Mot so may local
 * khong phan giai duoc DNS trong Node nhung curl thi duoc => co duong lui. */
const get = async (url, asBuffer = false) => {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return asBuffer ? Buffer.from(await res.arrayBuffer()) : res.text();
  } catch {
    const { stdout } = await run('curl', ['-sSfL', '-A', UA, url], {
      encoding: asBuffer ? 'buffer' : 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    return stdout;
  }
};

(async () => {
  if (process.argv.includes('--if-missing') && fsSync.existsSync(OUT)) {
    console.log('cjk.css da co, bo qua tai font.');
    return;
  }

  let out = '/* Sinh boi scripts/fetch-cjk-fonts.js — dung sua tay. */\n';
  let files = 0;
  let bytes = 0;

  for (const fam of FAMILIES) {
    const css = await get(
      `https://fonts.googleapis.com/css2?family=${fam.q}:wght@${WEIGHTS.join(';')}&display=block`
    );

    // Moi block @font-face: 1 weight + 1 unicode-range + 1 url woff2
    const blocks = css.split('@font-face').slice(1);
    const parts = await Promise.all(
      blocks.map(async (b) => {
        const url = b.match(/url\((https:[^)]+)\)/)?.[1];
        const weight = b.match(/font-weight:\s*(\d+)/)?.[1];
        const range = b.match(/unicode-range:\s*([^;]+);/)?.[1];
        if (!url || !weight || !range) return '';
        const buf = await get(url, true);
        files++;
        bytes += buf.length;
        return (
          `@font-face{font-family:'${fam.name}';font-style:normal;font-weight:${weight};` +
          `font-display:block;` +
          `src:url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2');` +
          `unicode-range:${range};}\n`
        );
      })
    );
    out += parts.join('');
    console.log(fam.name, '—', blocks.length, 'subset');
  }

  await fs.writeFile(OUT, out, 'utf8');
  console.log(
    `\n${files} file woff2, ${(bytes / 1e6).toFixed(1)} MB font -> ${(
      (await fs.stat(OUT)).size / 1e6
    ).toFixed(1)} MB cjk.css`
  );
})();
