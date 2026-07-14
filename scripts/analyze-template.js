/* Cong cu: do bbox tung <path> trong mot file SVG thiet ke (de biet path nao la
 * chu placeholder can go bo, path nao la logo/icon/hoa van can giu).
 *
 * Chay: ./node_modules/.bin/electron scripts/analyze-template.js design/back-card-jp.svg
 */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const file = process.argv[2] || 'design/back-card.svg';

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL('data:text/html,<body></body>');

  const svg = await fs.readFile(path.join(__dirname, '..', file), 'utf8');

  const boxes = await win.webContents.executeJavaScript(`(() => {
    const host = document.createElement('div');
    host.innerHTML = ${JSON.stringify(svg)};
    document.body.appendChild(host);
    return [...host.querySelectorAll('path')].map((p, i) => {
      const b = p.getBBox();
      return {
        i, fill: p.getAttribute('fill'),
        x: +b.x.toFixed(1), y: +b.y.toFixed(1),
        w: +b.width.toFixed(1), h: +b.height.toFixed(1),
        d: (p.getAttribute('d') || '').length,
      };
    });
  })()`);

  console.log(file, '— viewBox 0 0 551 357, card = 30,20 -> 491.4x297 (91x55mm)\n');
  for (const b of boxes) {
    console.log(
      String(b.i).padStart(2),
      'x', String(b.x).padStart(7), 'y', String(b.y).padStart(6),
      'w', String(b.w).padStart(7), 'h', String(b.h).padStart(6),
      'fill', String(b.fill).padEnd(9),
      'dLen', String(b.d).padStart(6),
      b.d > 3000 ? '  <-- chu (outline)' : ''
    );
  }
  app.quit();
});
