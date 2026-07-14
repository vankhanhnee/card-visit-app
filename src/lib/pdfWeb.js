/* ---------------------------------------------------------------
 * Dung PDF NGAY TRONG TRINH DUYET (ban web).
 *
 * Ban desktop nho Chromium in HTML ra PDF (printToPDF) => chu la VECTOR. Tren
 * web khong co API do, nen o day ta ve tung mat card ra canvas o 600 dpi roi
 * nhung anh do vao PDF.
 *
 * Danh doi: chu tren PDF ban web la ANH 600dpi chu khong phai vector. In danh
 * thiep o 600dpi thi mat thuong khong phan biet duoc, nhung neu nha in doi file
 * chu vector thi hay dung ban desktop.
 *
 * Vi tri / co chu / gian chu deu lay tu chinh cac ham ma preview dang dung
 * (fitFontSize, topOf) => canvas va preview khong the lech nhau.
 * ------------------------------------------------------------- */

import { PDFDocument, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import { fitFontSize, topOf, MM_PER_PAGE } from './card';
import { layerFor, normalizeEmp } from '../templates';
import { cjkFontCss } from './cjk';

const DPI = 600;
const PX_PER_MM = DPI / 25.4;
const PT_PER_MM = 72 / 25.4; // don vi cua PDF la point

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Khong tai duoc anh nen cua card'));
    img.src = src;
  });

/**
 * EP NAP FONT truoc khi ve canvas.
 *
 * @font-face trong CSS chi duoc trinh duyet tai KHI CO CHU THAT SU DUNG DEN NO.
 * O tab Xuat PDF, o xem truoc chi hien mat logo — khong co chu nao — nen font
 * khong bao gio duoc nap, va canvas se roi ve font he thong (chu in ra la Arial
 * chu khong phai Source Sans 3).
 *
 * (Dung tin document.fonts.check: voi mot family chua ton tai no cung tra ve true,
 * vi "khong co font nao can tai".)
 */
async function ensureFontsForCanvas(template, employees) {
  // 1. Source Sans 3: nap thang tu data-URL da bundle
  await Promise.all(
    (template.fonts || []).map(async (f) => {
      const face = new FontFace(f.family, `url(${f.dataUrl})`, {
        weight: String(f.weight || 400),
        style: f.italic ? 'italic' : 'normal',
      });
      await face.load();
      document.fonts.add(face);
    })
  );

  // 2. Font Nhat/Trung: chen @font-face (co unicode-range) roi ep nap dung subset
  //    chua ky tu that su xuat hien.
  const texts = employees.flatMap((e) => Object.values(e).map(String));
  const css = cjkFontCss(texts);
  if (css) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    await Promise.all(
      employees.flatMap((emp) =>
        ['front', 'back'].flatMap((side) =>
          layerFor(template, side, emp)
            .fields.filter((f) => f.type === 'text' && emp[f.key])
            .map((f) =>
              document.fonts
                .load(`${f.weight} ${f.fontSize}pt ${f.family}`, String(emp[f.key]))
                .catch(() => {})
            )
        )
      )
    );
  }

  await document.fonts.ready;
}

/** Ve mot mat card ra canvas 600dpi. */
async function renderSide(template, side, rawEmp, qrMap) {
  const emp = normalizeEmp(rawEmp);
  const layer = layerFor(template, side, emp);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(template.cardW * PX_PER_MM);
  canvas.height = Math.round(template.cardH * PX_PER_MM);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = template.background || '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (layer.image) {
    const img = await loadImage(layer.image);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  for (const f of layer.fields) {
    if (f.type === 'qr') {
      const src = qrMap?.[emp.id]?.[f.id];
      if (src) {
        const img = await loadImage(src);
        ctx.drawImage(img, f.x * PX_PER_MM, f.y * PX_PER_MM, f.h * PX_PER_MM, f.h * PX_PER_MM);
      }
      continue;
    }
    if (f.type !== 'text') continue;

    const value = String((f.key ? emp[f.key] : f.staticText) ?? '');
    if (!value.trim()) continue;

    const sizePt = fitFontSize(value, f);          // cung ham voi preview
    const topMm = topOf(f, sizePt, emp);           // mep tren cua dong chu (mm)
    const sizePx = sizePt * (DPI / 72);

    ctx.font = `${f.italic ? 'italic ' : ''}${f.weight} ${sizePx}px ${f.family}`;
    ctx.letterSpacing = `${f.letterSpacing * PX_PER_MM}px`;
    ctx.fillStyle = f.color;

    /* Canvas ve theo BASELINE, con f.y la mep tren cua hop dong (giong CSS).
     * Quy doi giong het lib/card.js: baseline = top + halfLeading + fontAscent. */
    const m = ctx.measureText('Hg');
    const lineBoxPx = f.lineHeight * sizePx;
    const halfLeading = (lineBoxPx - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2;
    const baseline = topMm * PX_PER_MM + halfLeading + m.fontBoundingBoxAscent;

    if (f.align === 'right') {
      ctx.textAlign = 'right';
      ctx.fillText(value, (f.x + f.w) * PX_PER_MM, baseline);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(value, f.x * PX_PER_MM, baseline);
    }
  }

  return canvas.toDataURL('image/png');
}

/** Mot file PDF cho mot nhan vien. */
async function buildPdf(template, emp, qrMap, opts) {
  const { layout = 'single', sides = 'both', cropMarks = true, gap = 4 } = opts || {};
  const { cardW, cardH, bleed } = template;
  const outW = cardW + bleed * 2;
  const outH = cardH + bleed * 2;

  const sideList = sides === 'both' ? ['front', 'back'] : [sides];

  const doc = await PDFDocument.create();
  const images = {};
  for (const side of sideList) {
    images[side] = await doc.embedPng(await renderSide(template, side, emp, qrMap));
  }

  if (layout === 'single') {
    for (const side of sideList) {
      const page = doc.addPage([outW * PT_PER_MM, outH * PT_PER_MM]);
      page.drawImage(images[side], {
        x: bleed * PT_PER_MM,
        y: bleed * PT_PER_MM,
        width: cardW * PT_PER_MM,
        height: cardH * PT_PER_MM,
      });
    }
  } else {
    const sheet = MM_PER_PAGE[layout] || MM_PER_PAGE.a4;
    const margin = 10;
    const cols = Math.max(1, Math.floor((sheet.w - margin * 2 + gap) / (outW + gap)));
    const rows = Math.max(1, Math.floor((sheet.h - margin * 2 + gap) / (outH + gap)));

    for (const side of sideList) {
      const page = doc.addPage([sheet.w * PT_PER_MM, sheet.h * PT_PER_MM]);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const xMm = margin + c * (outW + gap) + bleed;
          const yMm = margin + r * (outH + gap) + bleed;
          // PDF lay goc o duoi-trai, con ta tinh tu tren xuong => lat truc y
          const y = (sheet.h - yMm - cardH) * PT_PER_MM;
          const x = xMm * PT_PER_MM;

          page.drawImage(images[side], {
            x, y,
            width: cardW * PT_PER_MM,
            height: cardH * PT_PER_MM,
          });

          if (cropMarks) drawCropMarks(page, x, y, cardW * PT_PER_MM, cardH * PT_PER_MM);
        }
      }
    }
  }

  return doc.save();
}

/** Dau cat goc: 4 goc, moi goc hai vach ngan nam NGOAI mep card. */
function drawCropMarks(page, x, y, w, h) {
  const len = 3 * PT_PER_MM;
  const off = 1 * PT_PER_MM;
  const style = { thickness: 0.5, color: rgb(0, 0, 0) };
  const line = (x1, y1, x2, y2) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, ...style });

  for (const [cx, sx] of [[x, -1], [x + w, 1]]) {
    for (const [cy, sy] of [[y, -1], [y + h, 1]]) {
      line(cx + sx * off, cy, cx + sx * (off + len), cy); // vach ngang
      line(cx, cy + sy * off, cx, cy + sy * (off + len)); // vach doc
    }
  }
}

const download = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Moi nhan vien mot file PDF; tu 2 nguoi tro len thi dong goi thanh .zip.
 * Tra ve cung dang ket qua nhu ban desktop de ExportPanel khong phai biet minh
 * dang chay o dau.
 */
export async function exportCardsWeb({ template, employees, qrMap, opts, suggestedName }) {
  try {
    await ensureFontsForCanvas(template, employees);

    if (employees.length === 1) {
      const pdf = await buildPdf(template, employees[0], qrMap, opts);
      download(new Blob([pdf], { type: 'application/pdf' }), employees[0].__fileName);
      return { ok: true, count: 1, web: true };
    }

    const zip = new JSZip();
    for (const emp of employees) {
      zip.file(emp.__fileName, await buildPdf(template, emp, qrMap, opts));
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    download(blob, suggestedName);
    return { ok: true, count: employees.length, web: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
