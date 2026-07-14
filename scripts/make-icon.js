/* Cong cu: dung icon app tu chinh logo VECTOR trong file thiet ke.
 *
 * Lay cac path cua logo TIXIMAX trong back-2line-white.svg (chu + hoa sen), do
 * bbox chung roi ve lai vao khung vuong 1024x1024 nen trang.
 * electron-builder tu sinh .ico (Windows) va .icns (mac) tu file nay.
 *
 * Chay: ./node_modules/.bin/electron scripts/make-icon.js
 */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const SRC = path.join(__dirname, '..', 'src', 'templates', 'back-2line-white.svg');
const OUT_DIR = path.join(__dirname, '..', 'build');

/* Chi so path cua logo trong file goc (do bang analyze-template.js):
 * 5-13 = chu TIXIMAX (navy), 14-18 = bong sen (vang).
 *
 * Logo day du rat DEP NGANG: nhet vao khung vuong thi o co 32px (taskbar) chu
 * chi con vai pixel, khong doc noi. Nen dung ca hai phuong an de chon. */
const VARIANTS = [
  { out: 'icon.png', paths: [14, 15, 16, 17, 18], bg: '#ffffff', margin: 0.16 },
];

const SIZE = 1024;

app.whenReady().then(async () => {
  const svg = await fs.readFile(SRC, 'utf8');

  const win = new BrowserWindow({ show: false });
  await win.loadURL('data:text/html,<body></body>');

  await fs.mkdir(OUT_DIR, { recursive: true });
  for (const v of VARIANTS) {
  const dataUrl = await win.webContents.executeJavaScript(`(async () => {
    const host = document.createElement('div');
    host.innerHTML = ${JSON.stringify(svg)};
    document.body.appendChild(host);
    const svgEl = host.querySelector('svg');
    const all = [...svgEl.querySelectorAll('path')];
    const logo = ${JSON.stringify(v.paths)}.map((i) => all[i]);

    // bbox chung cua logo (toa do viewBox)
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of logo) {
      const b = p.getBBox();
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
    }
    const w = x1 - x0, h = y1 - y0;

    const S = ${SIZE};
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = ${JSON.stringify(v.bg)};
    g.fillRect(0, 0, S, S);

    // Ve logo vao giua, chua vien
    const usable = S * (1 - ${v.margin} * 2);
    const k = Math.min(usable / w, usable / h);
    g.setTransform(k, 0, 0, k, (S - w * k) / 2 - x0 * k, (S - h * k) / 2 - y0 * k);
    for (const p of logo) {
      g.fillStyle = p.getAttribute('fill') || '#000';
      g.fill(new Path2D(p.getAttribute('d')));
    }
    return c.toDataURL('image/png');
  })()`);

  await fs.writeFile(path.join(OUT_DIR, v.out), Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('build/' + v.out, '—', SIZE + 'x' + SIZE);
  }
  app.quit();
});
