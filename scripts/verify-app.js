/* Kiem chung end-to-end: mo app that (dist), vao tab Xem truoc, chup man hinh.
 * Dung de xac nhan chu Nhat/Trung ra dung font Noto bundle san.
 * Chay: ./node_modules/.bin/electron scripts/verify-app.js
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

// Gia lap store: 1 nhan vien tieng Nhat, 1 tieng Trung.
ipcMain.handle('store:load', async () => ({
  employees: [
    // Du lieu that cua nguoi dung: 1 CHUC DANH nhung 2 DONG DIA CHI => phai dung
    // mat sau ban 2 dong, o chuc danh dong 2 bo trong (truong hop bi 'be layout')
    {
      id: 'vk',
      name: 'Nguyen Van A',
      title: 'Designer',
      phone: '+84 900 000 000',
      email: 'a@example.com',
      company: 'Tiximax Japan JSC',
      companySub: '株式会社Tiximax',
      address: '〒104-0045 東京都中央区築地4-3-12-1007',
      address2: '4-3-12-1007 Tsukiji, Chuo-ku, Tokyo 104-0045',
      website: 'tiximax.jp',
    },
    // Du 2 dong chuc danh (de doi chieu)
    {
      id: 'jp',
      name: '田中 太郎',
      title: '営業部長',
      title2: 'Sales Manager',
      phone: '+81 90-1234-5678',
      email: 'tanaka@tiximax.jp',
      company: 'TIXIMAX CO., LTD.',
      companySub: '株式会社ティキマックス',
      address: '東京都新宿区西新宿一丁目26番2号',
      address2: '1-26-2 Nishi-Shinjuku, Shinjuku-ku, Tokyo',
      website: 'tiximax.jp',
    },
  ],
}));
ipcMain.handle('store:save', async () => true);

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: true,
    width: 1500,
    height: 950,
    webPreferences: { preload: path.join(__dirname, '..', 'electron', 'preload.js') },
  });
  win.webContents.on('console-message', (_e, _l, msg) => console.log('[renderer]', msg));
  win.webContents.on('render-process-gone', (_e, d) => console.log('[gone]', JSON.stringify(d)));
  await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  console.log('loaded');

  await fs.mkdir(path.join(__dirname, 'out'), { recursive: true });

  // Cho React nap store xong (man hinh "Dang tai...")
  await win.webContents.executeJavaScript(`(async () => {
    for (let i = 0; i < 100 && !document.querySelector('.tab'); i++) await new Promise(r => setTimeout(r, 100));
    if (!document.querySelector('.tab')) throw new Error('App khong khoi dong duoc');
  })()`);

  // index 0..1 = 2 mau co san, 2..3 = 2 nhan vien gia lap o tren
  // idx -1 = khong dong vao dropdown => kiem tra lua chon MAC DINH
  for (const [who, col] of [['white', 0], ['navy', 1]]) {
    const t0 = Date.now();
    await win.webContents.executeJavaScript(`(async () => {
      if (!document.querySelector('.tab')) throw new Error('UI chua render: ' + document.body.innerHTML.slice(0, 200));
      [...document.querySelectorAll('.tab')].find(b => b.textContent.includes('Xem trước')).click();
      await new Promise(r => setTimeout(r, 200));
      // Chi con mot nhom nut: [White, Navy]
      const seg = document.querySelector('.canvas-toolbar .seg');
      seg.querySelectorAll('button')[${col}].click();
      await new Promise(r => setTimeout(r, 400));
      await document.fonts.ready;
      return { activeTab: document.querySelector('.tab.active')?.textContent };
    })()`);
    await new Promise((r) => setTimeout(r, 600));
    const img = await win.webContents.capturePage();
    await fs.writeFile(path.join(__dirname, 'out', `app-${who}.png`), img.toPNG());
    console.log(`app-${who}.png (${Date.now() - t0}ms)`);
  }

  app.quit();
});
