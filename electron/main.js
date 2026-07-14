const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const JSZip = require('jszip');

const isDev = process.env.NODE_ENV === 'development';
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Card Visit Maker',
    backgroundColor: '#11131a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Cua so in an van tinh la mot window: neu khong don, 'window-all-closed'
  // khong bao gio ban va app se treo ngam sau khi dong cua so chinh.
  mainWindow.on('closed', () => {
    if (printWin && !printWin.isDestroyed()) printWin.destroy();
    printWin = null;
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/* ---------- Store: config + employees persisted in userData ---------- */

const storePath = () => path.join(app.getPath('userData'), 'store.json');

ipcMain.handle('store:load', async () => {
  try {
    return JSON.parse(await fs.readFile(storePath(), 'utf8'));
  } catch {
    return null;
  }
});

ipcMain.handle('store:save', async (_e, data) => {
  await fs.writeFile(storePath(), JSON.stringify(data, null, 2), 'utf8');
  return true;
});

/* ---------- File pickers ---------- */

ipcMain.handle('dialog:openData', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Chon file danh sach nhan vien',
    properties: ['openFile'],
    filters: [{ name: 'Excel / CSV', extensions: ['xlsx', 'xls', 'csv'] }],
  });
  if (canceled || !filePaths[0]) return null;
  const buf = await fs.readFile(filePaths[0]);
  return {
    name: path.basename(filePaths[0]),
    ext: path.extname(filePaths[0]).toLowerCase().replace('.', ''),
    data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
});

/* Khong co picker cho anh/font: template TIXIMAX duoc bundle cung app
 * (src/templates/) va khong the thay tu phia nguoi dung. */

/* ---------- PDF export ---------- */
// The renderer builds the exact HTML it previews, we print that same HTML
// offscreen. One source of truth => WYSIWYG.

// Mot cua so in duy nhat, dung lai qua nhieu lan xuat.
// Tao/huy cua so moi cho tung lan xuat lam lan thu 2 tro di khong spawn duoc
// renderer process (ERR_FAILED -2) => PDF thu 2 luon hong.
let printWin = null;
function getPrintWindow() {
  if (!printWin || printWin.isDestroyed()) {
    printWin = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
  }
  return printWin;
}

/** In mot doan HTML ra buffer PDF. */
async function htmlToPdf(html) {
  const tmpHtml = path.join(os.tmpdir(), `cardvisit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`);
  await fs.writeFile(tmpHtml, html, 'utf8');
  const win = getPrintWindow();
  try {
    await win.loadFile(tmpHtml);
    // Cho font + anh nap xong, khong thi chu se in bang font du phong.
    await win.webContents.executeJavaScript(`
      (async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map(img =>
          img.complete ? Promise.resolve() : new Promise(r => {
            img.onload = r; img.onerror = r;
          })
        ));
      })()
    `);
    return await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true, // ton trong @page size (mm) tu renderer
      margins: { marginType: 'none' },
    });
  } finally {
    fs.unlink(tmpHtml).catch(() => {});
  }
}

/**
 * Moi nhan vien mot file PDF rieng.
 *   1 nhan vien   -> luu thang file .pdf
 *   >= 2 nhan vien -> nen tat ca vao mot file .zip
 *
 * items: [{ fileName: 'card-visit-tanaka.pdf', html }]
 */
ipcMain.handle('pdf:exportBatch', async (_e, { items, suggestedName }) => {
  if (!items?.length) return { ok: false, error: 'Khong co nhan vien nao duoc chon' };

  const single = items.length === 1;
  const ext = single ? 'pdf' : 'zip';

  // CARDVISIT_SAVE_TO: bo qua hop thoai luu file, dung cho script kiem chung tu
  // dong (scripts/verify-export.js). Nguoi dung binh thuong khong dat bien nay.
  const saved = process.env.CARDVISIT_SAVE_TO
    ? { canceled: false, filePath: path.join(process.env.CARDVISIT_SAVE_TO, suggestedName || `card-visit.${ext}`) }
    : await dialog.showSaveDialog(mainWindow, {
        title: single ? 'Luu file PDF' : 'Luu file ZIP',
        defaultPath: path.join(app.getPath('desktop'), suggestedName || `card-visit.${ext}`),
        filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
      });
  const { canceled, filePath } = saved;
  if (canceled || !filePath) return { ok: false, canceled: true };

  try {
    if (single) {
      await fs.writeFile(filePath, await htmlToPdf(items[0].html));
      return { ok: true, filePath, count: 1 };
    }

    const zip = new JSZip();
    // In tuan tu: chi co MOT print window, in song song se de chong len nhau.
    for (const it of items) {
      zip.file(it.fileName, await htmlToPdf(it.html));
    }
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    await fs.writeFile(filePath, buf);
    return { ok: true, filePath, count: items.length };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('shell:showItem', async (_e, filePath) => {
  shell.showItemInFolder(filePath);
});
