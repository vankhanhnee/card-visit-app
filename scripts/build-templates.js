/* ---------------------------------------------------------------
 * Doc template TU CHINH FILE SVG trong design/ — khong hardcode toa do.
 *
 * Voi moi mat sau:
 *   1. Tim khung card (rect nen co ty le 91:55) => goc toa do
 *   2. Tim cac path CHU (Figma da outline chu thanh path) va gan vai tro cho
 *      tung path theo vi tri: khoi phai = ten cong ty, cot trai = ten/chuc danh,
 *      cot lien he = phone/email/dia chi/website
 *   3. Suy CO CHU tu be rong bbox (voi weight da biet cua tung vai tro), suy
 *      MAU CHU tu thuoc tinh fill, suy VI TRI tu bbox + font metrics
 *   4. Go cac path chu ra khoi SVG => con lai anh nen sach
 *
 * Ket qua: src/templates/*.svg (anh nen) + src/templates/layout.json (toa do).
 * Doi thiet ke chi can chay lai: npm run templates
 * ------------------------------------------------------------- */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'src', 'templates');
const FONT_DIR = path.join(OUT, 'fonts');

const CARD_MM = { w: 91, h: 55 };
const CARD_RATIO = CARD_MM.w / CARD_MM.h;
const LINE_HEIGHT = 1.2;
const PT_PER_MM = 1 / 0.352778;

/* Weight cua tung vai tro (doc tu Figma, xem README).
 * Khong suy tu file duoc: chu da outline nen khong con thong tin font. */
const WEIGHT = {
  company: 600,
  companySub: 600,
  name: 800,
  title: 600,
  title2: 400,
  phone: 400,
  email: 400,
  address: 400,
  address2: 400,
  website: 400,
};

/* Chuoi placeholder cua tung vai tro. Chu trong SVG da bi outline thanh path nen
 * khong doc nguoc ra chu duoc — ma muon suy CO CHU tu be rong bbox thi phai biet
 * chuoi. Neu ban doi chuoi trong Figma, sua o day (script se bao loi neu lech).
 * ('Posiotion' la loi chinh ta co trong file thiet ke — giu nguyen.) */
const TEXTS = {
  twoLine: {
    company: '{{Company Name}}', companySub: '{{Company Name_jp}}',
    name: '{{Name}}', title: '{{Posiotion_JP}}', title2: '{{Position_EN}}',
    phone: '{{phone}}', email: '{{email}}',
    address: '{{address_jp}}', address2: '{{address_en}}',
    website: '{{company\u2019s website}}',
  },
  oneLine: {
    company: '{{Company Name}}', companySub: '{{Company Name_2}}',
    name: '{{Name}}', title: '{{Position}}',
    phone: '{{phone}}', email: '{{email}}',
    address: '{{ADDRESS_JP}}',
    website: '{{company\u2019s website}}',
  },
};

/* Ho ten: chu Nhat/Trung dac hon Latin nen ban thiet ke cho co chu lon hon.
 * Placeholder trong SVG la chu Latin nen size do duoc la size cho CHU NHAT;
 * ten viet bang chu Latin dung nho hon theo ty le nay (32px -> 28px). */
const NAME_LATIN_RATIO = 28 / 32;

const BACKS = [
  { id: 'twoLine', color: 'white', src: 'design/Ver 01/Back-01_White.svg', out: 'back-2line-white.svg' },
  { id: 'twoLine', color: 'navy', src: 'design/Ver 01/Back-01_Navy.svg', out: 'back-2line-navy.svg' },
  { id: 'oneLine', color: 'white', src: 'design/Ver 01/Back-02_White.svg', out: 'back-1line-white.svg' },
  { id: 'oneLine', color: 'navy', src: 'design/Ver 01/Back-02_Navy.svg', out: 'back-1line-navy.svg' },
];

const FRONTS = [
  { color: 'white', src: 'design/Ver 01/Font-Ver01_White.png', out: 'front-white.png' },
  { color: 'navy', src: 'design/Ver 01/Font-Ver01_Navy.png', out: 'front-navy.png' },
];

app.whenReady().then(async () => {
  const fonts = [];
  for (const f of await fs.readdir(FONT_DIR)) {
    if (!f.endsWith('.ttf')) continue;
    const weight = { Regular: 400, Medium: 500, SemiBold: 600, ExtraBold: 800 }[
      f.replace('SourceSans3-', '').replace('.ttf', '')
    ];
    if (!weight) continue;
    fonts.push({
      weight,
      dataUrl: `data:font/ttf;base64,${(await fs.readFile(path.join(FONT_DIR, f))).toString('base64')}`,
    });
  }

  const win = new BrowserWindow({ show: false });
  await win.loadURL('data:text/html,<body></body>');
  await win.webContents.executeJavaScript(`(async () => {
    for (const f of ${JSON.stringify(fonts)}) {
      const face = new FontFace('SS3', 'url(' + f.dataUrl + ')', { weight: String(f.weight) });
      await face.load();
      document.fonts.add(face);
    }
    await document.fonts.ready;
  })()`);

  const layout = { backs: {} };

  for (const b of BACKS) {
    const raw = await fs.readFile(path.join(ROOT, b.src), 'utf8');
    const r = await win.webContents.executeJavaScript(
      derive(raw, b.id, JSON.stringify(WEIGHT), LINE_HEIGHT, CARD_RATIO, CARD_MM.w, JSON.stringify(TEXTS[b.id]))
    );

    if (r.__error) throw new Error(b.src + ' -> ' + r.__error);
    await fs.writeFile(path.join(OUT, b.out), r.svg + '\n', 'utf8');
    layout.backs[b.id] ??= {};
    layout.backs[b.id][b.color] = { image: b.out, fields: r.fields };

    console.log(`\n${b.out}  (khung card: ${r.box.join(', ')} | gian chu ${r.letterSpacing}px)`);
    for (const f of r.fields) {
      console.log(
        '  ' + f.id.padEnd(11),
        'x', String(f.x).padStart(6),
        (f.baseline != null ? 'baseline ' + String(f.baseline).padStart(6) : 'y        ' + String(f.y).padStart(6)),
        String(f.sizePx).padStart(2) + 'px =', String(f.fontSize).padStart(5) + 'pt',
        'w' + f.weight,
        f.color,
        f.align === 'right' ? 'canh phai' : '',
        '| tracking ' + f.errW + '%'
      );
    }
  }

  /* Mat truoc: khong co chu, chi can cat vien shadow. */
  for (const f of FRONTS) {
    const isPng = f.src.toLowerCase().endsWith('.png');
    if (isPng) {
      const b64 = (await fs.readFile(path.join(ROOT, f.src))).toString('base64');
      const r = await win.webContents.executeJavaScript(cropPng(b64));
      await fs.writeFile(path.join(OUT, f.out), Buffer.from(r.url.split(',')[1], 'base64'));
      const dpi = Math.round(r.w / (CARD_MM.w / 25.4));
      console.log(`\n${f.out}  ${r.w}x${r.h}px  ${dpi} dpi ${dpi < 250 ? ' <-- QUA THAP CHO IN AN' : ''}`);
    } else {
      const raw = await fs.readFile(path.join(ROOT, f.src), 'utf8');
      const r = await win.webContents.executeJavaScript(
        derive(raw, null, JSON.stringify(WEIGHT), LINE_HEIGHT, CARD_RATIO, CARD_MM.w, '{}')
      );
      await fs.writeFile(path.join(OUT, f.out), r.svg + '\n', 'utf8');
      console.log(`\n${f.out}  (khung card: ${r.box.join(', ')})`);
    }
  }

  await fs.writeFile(path.join(OUT, 'layout.json'), JSON.stringify(layout, null, 2) + '\n', 'utf8');
  console.log('\nlayout.json — da ghi toa do cua', Object.keys(layout.backs).length, 'ban mat sau');
  app.quit();
});

/* ---------- Doan chay trong renderer ---------- */
function derive(raw, backId, weightJson, lineHeight, cardRatio, cardMmW, textsJson) {
  return `(() => { try {
  const WEIGHT = ${weightJson};
  const TEXTS = ${textsJson};
  const LH = ${lineHeight};
  const BACK_ID = ${JSON.stringify(backId)};
  const CARD_MM_W = ${cardMmW};

  const host = document.createElement('div');
  host.innerHTML = ${JSON.stringify(raw)};
  document.body.appendChild(host);
  const svg = host.querySelector('svg');

  /* --- 1. Khung card: hinh chu nhat lon nhat co ty le 91:55.
   * Khong suy tu viewBox duoc vi shadow lech xuong duoi (padding khong doi xung). */
  const rootCTM = svg.getScreenCTM().inverse();
  const toRoot = (el, b) => {
    const m = rootCTM.multiply(el.getScreenCTM());
    const p = (x, y) => { const pt = svg.createSVGPoint(); pt.x = x; pt.y = y; return pt.matrixTransform(m); };
    const a = p(b.x, b.y), c = p(b.x + b.width, b.y + b.height);
    return { x: a.x, y: a.y, w: c.x - a.x, h: c.y - a.y };
  };
  const card = [...svg.querySelectorAll('rect')]
    .map((el) => toRoot(el, el.getBBox()))
    .filter((r) => r.w > 10 && Math.abs(r.w / r.h - ${cardRatio}) < 0.02)
    .sort((a, b) => b.w * b.h - a.w * a.h)[0];
  if (!card) throw new Error('Khong tim thay khung card');

  const U_PER_MM = card.w / CARD_MM_W;                 // don vi viewBox / mm
  const mm = (u) => +(u / U_PER_MM).toFixed(2);

  /* --- 2. Path chu: Figma outline chu thanh path co dLen rat lon. Hoa van/icon
   * deu duoi 3000 ky tu. */
  const texts = [...svg.querySelectorAll('path')]
    .map((el) => ({ el, b: toRoot(el, el.getBBox()), d: (el.getAttribute('d') || '').length }))
    .filter((p) => p.d > 3000);

  const result = { svg: '', fields: [], box: [card.x, card.y, card.w, card.h].map((n) => +n.toFixed(2)) };

  if (BACK_ID) {
    /* --- 3. Gan vai tro theo VI TRI. Bo cuc co 3 cot, phan biet bang mep trai:
     *   cot ten/chuc danh  ~ 6.6% chieu rong card
     *   cot lien he        ~ 11.9% (thut vao vi co icon dung truoc)
     *   khoi ten cong ty   > 50% (canh phai)
     * Nguong 9% nam giua hai cot trai — khong the nham. */
    const rel = (p) => (p.b.x - card.x) / card.w;
    const byY = (a, b) => a.b.y - b.b.y;

    const right = texts.filter((p) => rel(p) > 0.5).sort(byY);
    const left = texts.filter((p) => rel(p) <= 0.09).sort(byY);
    const contact = texts.filter((p) => rel(p) > 0.09 && rel(p) <= 0.5).sort(byY);

    const roles = [];
    roles.push(['company', right[0]], ['companySub', right[1]]);
    // cot trai: ten (cao nhat) roi chuc danh
    roles.push(['name', left[0]], ['title', left[1]]);
    if (BACK_ID === 'twoLine') roles.push(['title2', left[2]]);
    // cot lien he theo thu tu doc
    const cOrder = BACK_ID === 'twoLine'
      ? ['phone', 'email', 'address', 'address2', 'website']
      : ['phone', 'email', 'address', 'website'];
    cOrder.forEach((k, i) => roles.push([k, contact[i]]));

    /* --- 3b. Uoc luong LETTER-SPACING cua ban thiet ke.
     *
     * Figma co dat gian chu nhe, nen be rong chu trong file lon hon be rong ta
     * dung lai => suy nguoc ra co chu se bi doi len (vd website ra 16.6px). Do
     * lech nay cang lon khi chuoi cang dai, nen khong the tru bang mot ty le %.
     *
     * Mo hinh: rong = size * rong_don_vi + ls * (so_ky_tu - 1).
     * Nha thiet ke go co chu SO NGUYEN, nen ta quet ls va chon gia tri lam cho
     * moi truong deu ra gan so nguyen nhat. */
    const ctxLS = document.createElement('canvas').getContext('2d');
    const unitW = (id) => {
      ctxLS.font = WEIGHT[id] + ' 100px SS3';
      const m = ctxLS.measureText(TEXTS[id]);
      return (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) / 100;
    };
    let bestLS = 0, bestErr = Infinity;
    for (let ls = 0; ls <= 0.4; ls += 0.005) {   // gian chu thuc te rat nho
      let err = 0;
      for (const [id, p] of roles) {
        if (!p) continue;
        const n = TEXTS[id].length;
        const size = (p.b.w - ls * (n - 1)) / unitW(id);
        // Chuan hoa theo size: lech 0.3px o chu 32px it nghiem trong hon o chu 11px
        err += Math.abs(size - Math.round(size)) / size;
      }
      if (err < bestErr) { bestErr = err; bestLS = ls; }
    }
    result.letterSpacing = +bestLS.toFixed(3);

    for (const [id, p] of roles) {
      if (!p) throw new Error('Thieu path chu cho truong: ' + id);

      const weight = WEIGHT[id];
      const str = TEXTS[id];
      const ctx = document.createElement('canvas').getContext('2d');
      const measure = (size) => {
        ctx.font = weight + ' ' + size + 'px SS3';
        const m = ctx.measureText(str);
        return {
          inkW: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
          inkH: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
          inkAscent: m.actualBoundingBoxAscent,
          inkLeft: m.actualBoundingBoxLeft,
          advance: m.width,
          fbAscent: m.fontBoundingBoxAscent,
          fbDescent: m.fontBoundingBoxDescent,
        };
      };

      /* CO CHU suy tu BE RONG (chinh xac hon chieu cao: chieu cao ink phu thuoc
       * ky tu cu the, be rong thi ty le thuan voi size). Kiem tra cheo bang chieu
       * cao — lech nhieu nghia la chuoi placeholder trong TEXTS da khac file. */
      const unit = measure(100);
      // Tru phan be rong do gian chu gay ra roi moi suy co chu, sau do lam tron
      // ve px nguyen (nha thiet ke go so nguyen).
      const raw = ((p.b.w - bestLS * (str.length - 1)) / unit.inkW) * 100;
      const size = Math.round(raw);
      const m = measure(size);
      const errW = (raw - size) / size;
      const errH = (m.inkH - p.b.h) / p.b.h;
      if (Math.abs(errW) > 0.06 || Math.abs(errH) > 0.08) {
        throw new Error(
          'Truong "' + id + '": chuoi placeholder co ve khong con dung. Chieu cao lech ' +
          (errH * 100).toFixed(0) + '% (dang gia dinh la "' + str + '").'
        );
      }

      const baseline = p.b.y + m.inkAscent;
      const originX = p.b.x + m.inkLeft;
      const halfLeading = (LH * size - (m.fbAscent + m.fbDescent)) / 2;
      const top = baseline - halfLeading - m.fbAscent;

      const isRight = rel(p) > 0.5;
      const field = {
        id,
        color: p.el.getAttribute('fill') === 'white' ? '#ffffff' : p.el.getAttribute('fill'),
        weight,
        fontSize: +(mm(size) * ${PT_PER_MM}).toFixed(2),
        sizePx: size,
        align: isRight ? 'right' : 'left',
        letterSpacing: mm(bestLS),   // gian chu do duoc tu ban thiet ke
        x: mm(originX - card.x),
        y: mm(top - card.y),
        errW: +(errW * 100).toFixed(1),
      };
      if (isRight) field.right = mm(originX + m.advance - card.x);
      if (id === 'name') { field.baseline = mm(baseline - card.y); delete field.y; }
      result.fields.push(field);
    }
  }

  /* --- 4. Go path chu, bo shadow, cat viewBox ve dung mat card */
  for (const p of texts) p.el.remove();
  svg.querySelectorAll('[filter]').forEach((el) => el.removeAttribute('filter'));
  svg.setAttribute('viewBox', [card.x, card.y, card.w, card.h].map((n) => +n.toFixed(2)).join(' '));
  svg.setAttribute('width', '91mm');
  svg.setAttribute('height', '55mm');
  svg.setAttribute('preserveAspectRatio', 'none');
  result.svg = svg.outerHTML;
  return result;
  } catch (e) { return { __error: String(e) + '\\n' + (e.stack || '') }; }
})()`;
}

function cropPng(b64) {
  return `(async () => {
    const img = new Image();
    img.src = 'data:image/png;base64,${b64}';
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const { data } = g.getImageData(0, 0, c.width, c.height);
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (data[(y * c.width + x) * 4 + 3] > 250) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const o = document.createElement('canvas');
    o.width = w; o.height = h;
    o.getContext('2d').drawImage(img, x0, y0, w, h, 0, 0, w, h);
    return { url: o.toDataURL('image/png'), w, h };
  })()`;
}
