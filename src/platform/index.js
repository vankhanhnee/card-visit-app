/* ---------------------------------------------------------------
 * Lop nen tang: cung mot app chay duoc tren Electron (desktop) lan trinh duyet.
 *
 * Ba viec phu thuoc nen tang:
 *   1. Luu du lieu   — Electron: file store.json | Web: localStorage
 *   2. Chon file     — Electron: hop thoai he thong | Web: <input type=file>
 *   3. Xuat PDF      — Electron: printToPDF cua Chromium (chu VECTOR, chuan in)
 *                      Web: dung PDF ngay trong trinh duyet (xem lib/pdfWeb.js)
 *
 * window.api chi ton tai khi chay trong Electron (preload.js bom vao).
 * ------------------------------------------------------------- */

import { buildPdfHtml } from '../lib/card';
import { exportCardsWeb } from '../lib/pdfWeb';

export const isDesktop = typeof window !== 'undefined' && !!window.api;

const STORE_KEY = 'card-visit-store';

/* ---------- 1. Luu du lieu ---------- */

export async function loadStore() {
  if (isDesktop) return window.api.loadStore();
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
  } catch {
    return null;
  }
}

export async function saveStore(data) {
  if (isDesktop) return window.api.saveStore(data);
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
  return true;
}

/* ---------- 2. Chon file Excel/CSV ---------- */

export async function pickDataFile() {
  if (isDesktop) return window.api.pickDataFile();

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve({
        name: file.name,
        ext: file.name.split('.').pop().toLowerCase(),
        data: await file.arrayBuffer(),
      });
    };
    // Nguoi dung bam Cancel: khong co su kien nao ban ra => de promise treo,
    // khong sao (component khong doi ket qua nay de tiep tuc).
    input.click();
  });
}

/* ---------- 3. Xuat PDF ---------- */

/**
 * items: [{ fileName, emp }]  — moi nhan vien mot file PDF.
 * >= 2 nhan vien => dong goi thanh mot file .zip.
 *
 * Desktop: dung lai dung doan HTML ma preview dang hien, roi nho Chromium in ra
 * PDF => chu la VECTOR, dung chuan nha in.
 * Web: khong co printToPDF, phai tu dung PDF (chu thanh anh 600dpi).
 */
export async function exportCards({ template, employees, qrMap, opts, suggestedName }) {
  if (isDesktop) {
    const items = employees.map((emp) => ({
      fileName: emp.__fileName,
      html: buildPdfHtml(template, [emp], qrMap, opts),
    }));
    return window.api.exportPdf({ items, suggestedName });
  }

  return exportCardsWeb({ template, employees, qrMap, opts, suggestedName });
}
