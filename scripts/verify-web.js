/* Kiem chung BAN WEB: mo dist/ nhu mot trang web THUAN (khong co window.api),
 * gieo du lieu vao localStorage, bam nut xuat roi kiem file tai ve.
 *
 * Chay: ./node_modules/.bin/electron scripts/verify-web.js
 */
const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');
const JSZip = require('jszip');

const DIST = path.join(__dirname, '..', 'dist');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cardvisit-web-'));

const EMPLOYEES = [
  {
    id: 'jp',
    name: '田中 太郎',
    title: '営業部長',
    title2: 'Sales Manager',
    phone: '+81 90-1234-5678',
    email: 'tanaka@example.com',
    company: 'TIXIMAX CO., LTD.',
    companySub: '株式会社ティキマックス',
    address: '東京都新宿区西新宿1-1-1',
    address2: '1-1-1 Nishi-Shinjuku, Shinjuku-ku, Tokyo',
    website: 'tiximax.jp',
  },
  {
    id: 'vn',
    name: 'Nguyen Van A',
    title: 'Sales Executive',
    phone: '+84 900 000 000',
    email: 'a@example.com',
    company: 'TIXIMAX CO., LTD.',
    companySub: 'Chi nhanh Viet Nam',
    address: '123 Nguyen Hue, Quan 1, TP.HCM',
    website: 'tiximax.jp',
  },
];

/* Phai phuc vu qua http: file:// khong co localStorage va chan dynamic import. */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.join(DIST, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

app.whenReady().then(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  session.defaultSession.on('will-download', (_e, item) => {
    item.setSavePath(path.join(out, item.getFilename()));
  });

  const win = new BrowserWindow({ show: false, width: 1500, height: 950 });
  win.webContents.on('console-message', (_e, _l, m) => {
    if (!/Autofill|DevTools/.test(m)) console.log('[web]', m);
  });

  // Gieo du lieu truoc khi app khoi dong
  await win.webContents.session.clearStorageData();
  await win.loadURL(`http://localhost:${port}/`);
  await win.webContents.executeJavaScript(`
    localStorage.setItem('card-visit-store', ${JSON.stringify(
      JSON.stringify({ employees: EMPLOYEES, color: 'white' })
    )});
  `);
  await win.reload();

  const r = await win.webContents.executeJavaScript(`(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 200 && !document.querySelector('.tab'); i++) await wait(100);

    // window.api khong ton tai => app phai tu nhan ra minh dang chay tren web
    const isWeb = typeof window.api === 'undefined';
    const fontsLoaded = {
      ss3_400: document.fonts.check('16px "Source Sans 3"'),
      ss3_800: document.fonts.check('800 16px "Source Sans 3"'),
      noto: document.fonts.check('16px "Noto Sans JP"'),
    };

    [...document.querySelectorAll('.tab')].find((b) => b.textContent.includes('Xuất PDF')).click();
    await wait(600);
    const btn = document.querySelector('.inspector .btn.primary');
    const label = btn.textContent;
    btn.click();

    for (let i = 0; i < 600 && btn.disabled; i++) await wait(200);
    await wait(1500);
    const alert = document.querySelector('.alert');
    return { isWeb, fontsLoaded, button: label, alert: alert ? alert.textContent : '(khong co thong bao)' };
  })()`);

  console.log('\\nwindow.api ton tai?', r.isWeb ? 'KHONG (dung ban web)' : 'CO (dang chay Electron API)');
  console.log('font da nap?', JSON.stringify(r.fontsLoaded));
  console.log('nut:', r.button.trim());
  console.log('ket qua:', r.alert.trim());

  await new Promise((r) => setTimeout(r, 1500));
  const files = fs.readdirSync(out);
  console.log('\\nFile tai ve:');
  for (const f of files) {
    const buf = fs.readFileSync(path.join(out, f));
    console.log(' ', f, `(${(buf.length / 1024).toFixed(0)} KB)`);
    if (f.endsWith('.zip')) {
      const zip = await JSZip.loadAsync(buf);
      for (const name of Object.keys(zip.files)) {
        const b = await zip.files[name].async('nodebuffer');
        const ok = b.subarray(0, 4).toString() === '%PDF';
        console.log(`    - ${name} (${(b.length / 1024).toFixed(0)} KB)`, ok ? 'PDF hop le' : '!!! HONG');
      }
    }
  }
  if (!files.length) console.log('  !!! KHONG CO FILE NAO');

  server.close();
  app.quit();
});
