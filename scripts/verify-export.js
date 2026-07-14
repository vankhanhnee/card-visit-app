/* Kiem chung xuat file: chay APP THAT (electron/main.js) tren mot thu muc userData
 * rieng da gieo san danh sach nhan vien, roi bam nut Xuat o tab 3.
 *
 * Kiem tra:
 *   - 1 nhan vien  => ra 1 file .pdf
 *   - >= 2 nhan vien => ra 1 file .zip chua dung so file PDF, ten file khong trung
 *
 * Chay: ./node_modules/.bin/electron scripts/verify-export.js
 */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const JSZip = require('jszip');

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
];

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cardvisit-out-'));
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'cardvisit-ud-'));

process.env.CARDVISIT_SAVE_TO = out;
app.setPath('userData', userData);

async function run(employees, label) {
  fs.writeFileSync(
    path.join(userData, 'store.json'),
    JSON.stringify({ employees, color: 'white' })
  );

  const win = new BrowserWindow({
    show: false,
    width: 1400,
    height: 900,
    webPreferences: { preload: path.join(__dirname, '..', 'electron', 'preload.js') },
  });
  await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  const res = await win.webContents.executeJavaScript(`(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 100 && !document.querySelector('.tab'); i++) await wait(100);

    [...document.querySelectorAll('.tab')].find((b) => b.textContent.includes('Xuất PDF')).click();
    await wait(500);
    await document.fonts.ready;

    // Nut xuat that su, khong phai tab '3 · Xuất PDF' (trung chu)
    const btn = document.querySelector('.inspector .btn.primary');
    const label = btn.textContent;
    btn.click();

    for (let i = 0; i < 300 && btn.disabled; i++) await wait(200);
    await wait(500);
    const alert = document.querySelector('.alert');
    return { button: label, alert: alert ? alert.textContent : '(khong co thong bao)' };
  })()`);

  win.destroy();
  console.log(`\n--- ${label} (${employees.length} nhan vien) ---`);
  console.log('nut:', res.button.trim(), '| ket qua:', res.alert.trim());

  const files = fs.readdirSync(out);
  for (const f of files) {
    const size = fs.statSync(path.join(out, f)).size;
    console.log('  file:', f, `(${(size / 1024).toFixed(0)} KB)`);
    if (f.endsWith('.zip')) {
      const zip = await JSZip.loadAsync(fs.readFileSync(path.join(out, f)));
      for (const name of Object.keys(zip.files)) {
        const buf = await zip.files[name].async('nodebuffer');
        const isPdf = buf.subarray(0, 4).toString() === '%PDF';
        console.log(`    - ${name} (${(buf.length / 1024).toFixed(0)} KB)`, isPdf ? 'PDF hop le' : '!!! KHONG PHAI PDF');
      }
    } else if (f.endsWith('.pdf')) {
      const buf = fs.readFileSync(path.join(out, f));
      console.log('    ', buf.subarray(0, 4).toString() === '%PDF' ? 'PDF hop le' : '!!! KHONG PHAI PDF');
    }

  }
  if (!files.length) console.log('  !!! KHONG CO FILE NAO duoc tao');
}

// Nap dung main.js cua app that (dang ky IPC store/pdf, mo cua so chinh).
require(path.join(__dirname, '..', 'electron', 'main.js'));

app.whenReady().then(async () => {
  await new Promise((r) => setTimeout(r, 1500));
  BrowserWindow.getAllWindows().forEach((w) => w.hide());

  await run([EMPLOYEES[0]], '1 nhan vien (de so voi ban web)');

  console.log('\nThu muc xuat:', out);
  app.quit();
});
