import QRCode from 'qrcode';
import { TEMPLATE, layerFor, normalizeEmp } from '../templates';
import { cjkFontCss } from './cjk';

/* ---------------------------------------------------------------
 * Mot nguon su that duy nhat cho ca preview lan PDF.
 * Toa do / kich thuoc deu tinh bang mm, dung dung don vi cua ban thiet ke.
 *
 * Template la CO DINH (src/templates/index.js) — app chi nhan du lieu nhan
 * vien roi xuat PDF, khong cho nap template khac. Mat sau co hai ban va duoc
 * chon theo du lieu tung nhan vien (xem layerFor).
 * ------------------------------------------------------------- */

export const uid = () => Math.random().toString(36).slice(2, 10);

export const defaultTemplate = () => TEMPLATE;

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function vcard(emp, keys) {
  const g = (k) => emp?.[k] || '';
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  if (keys.includes('name') && g('name')) {
    lines.push(`N:${g('name')};;;;`, `FN:${g('name')}`);
  }
  if (keys.includes('company') && g('company')) lines.push(`ORG:${g('company')}`);
  if (keys.includes('title') && g('title')) lines.push(`TITLE:${g('title')}`);
  if (keys.includes('phone') && g('phone')) lines.push(`TEL;TYPE=WORK,VOICE:${g('phone')}`);
  if (keys.includes('email') && g('email')) lines.push(`EMAIL;TYPE=WORK:${g('email')}`);
  if (keys.includes('website') && g('website')) lines.push(`URL:${g('website')}`);
  if (keys.includes('address') && g('address')) lines.push(`ADR;TYPE=WORK:;;${g('address')};;;;`);
  lines.push('END:VCARD');
  return lines.join('\n');
}

/** Sinh san QR (dataURL) cho tung nhan vien truoc khi render. */
export async function buildQrMap(template, employees) {
  const map = {};

  for (const emp of employees) {
    const qrFields = ['front', 'back']
      .flatMap((side) => layerFor(template, side, emp).fields)
      .filter((f) => f.type === 'qr');
    if (!qrFields.length) continue;

    map[emp.id] = {};
    for (const f of qrFields) {
      map[emp.id][f.id] = await QRCode.toDataURL(vcard(emp, f.qrFields || []), {
        margin: 0,
        errorCorrectionLevel: 'M',
        color: { dark: f.color || '#000000', light: '#0000' },
        width: 512,
      });
    }
  }
  return map;
}

const MM_PER_PX = 25.4 / 96;
const CJK_START = 0x2e80; // tu day tro len la kanji/kana/hangul...

/** Chuoi co chua chu khong thuoc he Latin (Nhat, Trung...) hay khong. */
const hasCjk = (s) => [...String(s)].some((ch) => ch.codePointAt(0) >= CJK_START);

/* Do chu bang canvas: preview va PDF deu chay trong renderer voi cung bo font da
 * nap, nen hai ben ra ket qua giong het nhau. */
let measureCtx = null;
const ctx = () => (measureCtx ||= document.createElement('canvas').getContext('2d'));
const setFont = (f, sizePt) => {
  ctx().font = `${f.italic ? 'italic ' : ''}${f.weight} ${sizePt}pt ${f.family}`;
};

/**
 * Co chu goc cua mot gia tri.
 * Chu Nhat/Trung dac hon chu Latin nen ban thiet ke cho no co chu lon hon
 * (vd ho ten: 32px cho tieng Nhat, 28px cho ten viet bang chu Latin).
 */
const baseFontSize = (f, value) =>
  !hasCjk(value) && f.fontSizeLatin ? f.fontSizeLatin : f.fontSize;

/* Moi truong chi duoc MOT dong: dia chi dai cung khong duoc xuong dong (se de
 * layout cua ban thiet ke). Neu chu dai hon cho trong (f.maxW), thu nho co chu
 * vua du de nam gon — giong cach nha thiet ke tu chinh tay. */
export function fitFontSize(value, f) {
  const size = baseFontSize(f, value);
  const maxW = f.maxW || f.w;
  if (!maxW) return size;

  setFont(f, size);
  const widthMm = ctx().measureText(value).width * MM_PER_PX;
  if (widthMm <= maxW) return size;

  // Khong thu nho qua 65% — duoi nguong do thi chu qua be, nen sua du lieu.
  return +(size * Math.max(maxW / widthMm, 0.65)).toFixed(2);
}

/**
 * Mep tren cua <div> (mm).
 *
 * Truong nao co `baseline` thi phai tinh nguoc tu baseline: co chu cua no thay
 * doi theo du lieu (xem baseFontSize / fitFontSize), ma neo bang `top` co dinh
 * thi doi co chu se lam dong chu troi len xuong — phai giu chan chu dung cho ban
 * thiet ke dat.
 */
/**
 * Vi tri doc cua truong, tinh ca truong hop "mo coi".
 *
 * Chuc danh co hai dong cho hai ngon ngu. Nhung nhan vien co dia chi 2 dong ma
 * chuc danh chi 1 dong van phai dung mat sau ban 2 dong (khong thi mat mot dong
 * dia chi) => o chuc danh dong 2 bo trong, de lai MOT DONG TRANG giua chuc danh
 * va vach ke vang. Luc do keo dong 1 xuong giua khoi cho can doi.
 *
 * Chi ap dung cho chuc danh: dong dia chi co icon dinh vi neo san trong anh nen,
 * dich no xuong se lech khoi icon.
 */
const yOf = (f, emp) =>
  f.soloY != null && !String(emp?.[f.soloWhenEmpty] ?? '').trim() ? f.soloY : f.y;

export function topOf(f, sizePt, emp) {
  if (f.baseline == null) return yOf(f, emp);

  setFont(f, sizePt);
  const m = ctx().measureText('Hg');
  const ascent = m.fontBoundingBoxAscent;
  const lineBoxPx = (f.lineHeight * sizePt * 4) / 3; // pt -> px
  const halfLeading = (lineBoxPx - (ascent + m.fontBoundingBoxDescent)) / 2;
  const baselinePx = f.baseline / MM_PER_PX;
  return +((baselinePx - halfLeading - ascent) * MM_PER_PX).toFixed(3);
}

function fieldHtml(f, emp, qrMap, cardW) {
  const pos = `position:absolute;left:${f.x}mm;top:${f.y}mm;`;

  if (f.type === 'qr') {
    const src = qrMap?.[emp?.id]?.[f.id];
    if (!src) return '';
    return `<img src="${src}" style="${pos}width:${f.h}mm;height:${f.h}mm;" />`;
  }

  if (f.type === 'image') {
    const src = emp?.[f.key];
    if (!src) return '';
    return `<img src="${esc(src)}" style="${pos}width:${f.w}mm;height:${f.h}mm;object-fit:${
      f.fit
    };border-radius:${f.radius}mm;" />`;
  }

  const raw = f.key ? emp?.[f.key] : f.staticText;
  const value = String(raw ?? '');
  if (!value.trim()) return '';

  const fontSize = fitFontSize(value, f);
  const top = topOf(f, fontSize, emp);

  /* Khoi text co dai bang dung noi dung (width:auto) chu khong phai f.w:
   * - canh trai  -> neo mep trai, chu keo dai sang phai
   * - canh phai  -> neo mep PHAI, chu keo dai sang trai
   * Neu van dat width:f.w thi voi white-space:nowrap chu se tran sang phai va
   * chay ra khoi card. */
  const anchor =
    f.align === 'right'
      ? `right:${+(cardW - f.x - f.w).toFixed(2)}mm;top:${top}mm;`
      : `left:${f.x}mm;top:${top}mm;`;

  const style = [
    'position:absolute',
    anchor,
    `font-family:${f.family}`,
    `font-size:${fontSize}pt`,
    `font-weight:${f.weight}`,
    f.italic ? 'font-style:italic' : '',
    `line-height:${f.lineHeight}`,
    `color:${f.color}`,
    `text-align:${f.align}`,
    `letter-spacing:${f.letterSpacing}mm`,
    f.uppercase ? 'text-transform:uppercase' : '',
    'white-space:nowrap', // mot dong, dia chi dai cung khong duoc xuong dong
  ]
    .filter(Boolean)
    .join(';');

  return `<div style="${style}">${esc(value)}</div>`;
}

/** Noi dung ben trong 1 mat card. Dung cho ca preview lan PDF. */
export function cardInnerHtml(template, side, rawEmp, qrMap) {
  // Nhan vien chi co 1 chuc danh / 1 dia chi thi phai nam o dong 1 (xem
  // normalizeEmp trong templates/index.js).
  const emp = normalizeEmp(rawEmp);
  const layer = layerFor(template, side, emp);
  const bg = layer?.image
    ? `<img src="${layer.image}" style="position:absolute;inset:0;width:${template.cardW}mm;height:${template.cardH}mm;object-fit:fill;" />`
    : '';
  const fields = (layer?.fields || [])
    .map((f) => fieldHtml(f, emp, qrMap, template.cardW))
    .join('');
  return bg + fields;
}

/** Moi chuoi se duoc in ra card — dung de chon subset font CJK can nhung. */
function textsOf(template, employees) {
  const out = [];
  for (const raw of employees) {
    const emp = normalizeEmp(raw);
    for (const side of ['front', 'back']) {
      for (const f of layerFor(template, side, emp).fields) {
        if (f.type !== 'text') continue;
        if (f.staticText) out.push(f.staticText);
        if (f.key) out.push(emp?.[f.key]);
      }
    }
  }
  return out;
}

/**
 * @font-face cho template. Truyen `employees` de font Nhat/Trung chi nhung dung
 * subset chua ky tu that su xuat hien (xem lib/cjk.js).
 */
export function fontFaceCss(template, employees = []) {
  const base = (template.fonts || [])
    .map(
      (f) =>
        `@font-face{font-family:'${f.family}';src:url('${f.dataUrl}');font-weight:${
          f.weight || 400
        };font-style:${f.italic ? 'italic' : 'normal'};font-display:block;}`
    )
    .join('\n');

  return `${base}\n${cjkFontCss(textsOf(template, employees))}`;
}

export const MM_PER_PAGE = { a4: { w: 210, h: 297 }, a3: { w: 297, h: 420 } };

/**
 * Tao HTML hoan chinh de main-process printToPDF.
 * layout: 'single' = 1 card / trang (dung kich thuoc that, cho nha in)
 *         'a4'     = xep luoi tren A4 kem crop marks
 * sides:  'front' | 'back' | 'both'
 */
export function buildPdfHtml(template, employees, qrMap, opts) {
  const { layout = 'single', sides = 'both', cropMarks = true, gap = 4 } = opts || {};
  const { cardW, cardH, bleed, radius, background } = template;
  const outW = cardW + bleed * 2;
  const outH = cardH + bleed * 2;

  const sideList = sides === 'both' ? ['front', 'back'] : [sides];

  const cardBox = (side, emp) => `
    <div class="card">
      <div class="art">${cardInnerHtml(template, side, emp, qrMap)}</div>
    </div>`;

  let pagesHtml = '';
  let pageCss = '';

  if (layout === 'single') {
    pageCss = `@page{size:${outW}mm ${outH}mm;margin:0;}`;
    for (const emp of employees) {
      for (const side of sideList) {
        pagesHtml += `<div class="page single">${cardBox(side, emp)}</div>`;
      }
    }
  } else {
    const sheet = MM_PER_PAGE[layout] || MM_PER_PAGE.a4;
    const margin = 10;
    const cols = Math.max(1, Math.floor((sheet.w - margin * 2 + gap) / (outW + gap)));
    const rows = Math.max(1, Math.floor((sheet.h - margin * 2 + gap) / (outH + gap)));
    const perPage = cols * rows;

    pageCss = `@page{size:${sheet.w}mm ${sheet.h}mm;margin:0;}`;

    // In duplex: in het cac trang mat truoc, roi den mat sau.
    // Luoi mat sau duoc lat nguoc theo cot de khop khi lat giay canh dai.
    for (const side of sideList) {
      for (let i = 0; i < employees.length; i += perPage) {
        const chunk = employees.slice(i, i + perPage);
        const cells = [];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const srcCol = side === 'back' && sides === 'both' ? cols - 1 - c : c;
            const emp = chunk[r * cols + srcCol];
            cells.push(
              emp
                ? `<div class="cell">${cardBox(side, emp)}${
                    cropMarks ? '<span class="cm tl"></span><span class="cm tr"></span><span class="cm bl"></span><span class="cm br"></span>' : ''
                  }</div>`
                : '<div class="cell empty"></div>'
            );
          }
        }
        pagesHtml += `<div class="page grid">${cells.join('')}</div>`;
      }
    }

    pageCss += `
      .page.grid{
        display:grid;
        grid-template-columns:repeat(${cols}, ${outW}mm);
        grid-auto-rows:${outH}mm;
        gap:${gap}mm;
        justify-content:center;
        align-content:start;
        padding:${margin}mm;
        box-sizing:border-box;
      }`;
  }

  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
${fontFaceCss(template, employees)}
${pageCss}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.page{page-break-after:always;break-after:page;position:relative;overflow:hidden;}
.page:last-child{page-break-after:auto;break-after:auto;}
.page.single{width:${outW}mm;height:${outH}mm;display:flex;align-items:center;justify-content:center;}
.cell{position:relative;width:${outW}mm;height:${outH}mm;}
.card{
  position:relative;
  width:${cardW}mm;height:${cardH}mm;
  margin:${bleed}mm;
  background:${background};
  border-radius:${radius}mm;
  overflow:hidden;
}
.art{position:absolute;inset:0;}
.cm{position:absolute;width:3mm;height:3mm;pointer-events:none;}
.cm.tl{left:-3.5mm;top:-3.5mm;border-left:.2mm solid #000;border-top:.2mm solid #000;}
.cm.tr{right:-3.5mm;top:-3.5mm;border-right:.2mm solid #000;border-top:.2mm solid #000;}
.cm.bl{left:-3.5mm;bottom:-3.5mm;border-left:.2mm solid #000;border-bottom:.2mm solid #000;}
.cm.br{right:-3.5mm;bottom:-3.5mm;border-right:.2mm solid #000;border-bottom:.2mm solid #000;}
img{display:block;}
</style></head>
<body>${pagesHtml}</body></html>`;
}
