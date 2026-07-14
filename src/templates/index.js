/* ---------------------------------------------------------------
 * Template TIXIMAX — DOC TU FILE THIET KE, khong hardcode toa do.
 *
 * layout.json do scripts/build-templates.js sinh ra bang cach doc thang cac file
 * SVG trong design/: vi tri, co chu, mau chu, gian chu deu suy tu chinh cac path
 * chu (placeholder) trong file. Doi thiet ke => chay `npm run templates`.
 *
 * Cau truc: mot mau card, hai mau sac (White / Navy).
 *   Mat sau co hai ban, app tu chon theo du lieu tung nhan vien:
 *     'twoLine' : chuc danh & dia chi viet 2 ngon ngu
 *     'oneLine' : chi 1 ngon ngu (khoi lien he day len)
 *
 * Card: 91 x 55 mm (chuan danh thiep Nhat).
 * ------------------------------------------------------------- */

import layout from './layout.json';

import frontWhite from './front-white.png?inline';
import frontNavy from './front-navy.png?inline';
import back2LineWhite from './back-2line-white.svg?raw';
import back2LineNavy from './back-2line-navy.svg?raw';
import back1LineWhite from './back-1line-white.svg?raw';
import back1LineNavy from './back-1line-navy.svg?raw';
import fontRegular from './fonts/SourceSans3-Regular.ttf?inline';
import fontSemiBold from './fonts/SourceSans3-SemiBold.ttf?inline';
import fontExtraBold from './fonts/SourceSans3-ExtraBold.ttf?inline';

const BACK_SVG = {
  twoLine: { white: back2LineWhite, navy: back2LineNavy },
  oneLine: { white: back1LineWhite, navy: back1LineNavy },
};

// Source Sans 3 chi co Latin; chu Nhat/Trung roi xuong Noto (xem lib/cjk.js).
const FAMILY = "'Source Sans 3','Noto Sans JP','Noto Sans SC',sans-serif";

const svgUrl = (raw) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`;

/** Nhan hien thi cua tung truong (layout.json chi luu id). */
const LABEL = {
  company: 'Tên công ty',
  companySub: 'Tên công ty (dòng 2)',
  name: 'Họ và tên',
  title: 'Chức danh — dòng 1',
  title2: 'Chức danh — dòng 2',
  phone: 'Điện thoại',
  email: 'Email',
  address: 'Địa chỉ — dòng 1',
  address2: 'Địa chỉ — dòng 2',
  website: 'Website',
};

/* Ban 1 dong khong co dong 2 => nhan gon lai. */
const LABEL_ONE_LINE = { ...LABEL, title: 'Chức danh', address: 'Địa chỉ' };

/* Be ngang toi da mot dong duoc chiem. Moi truong luon in TREN MOT DONG (dia chi
 * dai cung khong xuong dong); vuot maxW thi co chu tu thu nho (xem lib/card.js).
 * Khoi lien he bat dau o x~10.7mm, mep phai card la 91mm => con ~74mm. */
const MAX_W = {
  company: 45,
  companySub: 45,
  name: 62,
  title: 62,
  title2: 62,
  phone: 74,
  email: 74,
  address: 74,
  address2: 74,
  website: 74,
};

/* Ho ten: chu Nhat/Trung dac hon Latin nen ban thiet ke cho co chu lon hon.
 * Placeholder trong file la chu Latin, nhung o do danh cho TEN NHAT (32px); ten
 * viet bang chu Latin dung 28px => ty le 28/32. */
const NAME_LATIN_RATIO = 28 / 32;

/** Mot truong trong layout.json -> truong render cua lib/card.js. */
function toField(f, backId) {
  const labels = backId === 'oneLine' ? LABEL_ONE_LINE : LABEL;
  const field = {
    type: 'text',
    side: 'back',
    id: f.id,
    key: f.id,
    label: labels[f.id],
    staticText: '',
    family: FAMILY,
    lineHeight: 1.2,
    letterSpacing: f.letterSpacing, // gian chu do duoc tu ban thiet ke
    uppercase: false,
    italic: false,
    align: f.align,
    weight: f.weight,
    color: f.color,
    fontSize: f.fontSize,
    x: f.x,
    y: f.y,
    // Khoi ten cong ty canh phai: neo theo mep phai do duoc trong file
    w: f.align === 'right' ? +(f.right - f.x).toFixed(2) : 50,
    maxW: MAX_W[f.id],
    h: 0,
  };

  /* Ho ten doi co chu theo ngon ngu => phai neo bang BASELINE (chan chu). Neo
   * mep tren thi ten Latin (chu nho hon) se bi treo len, lech khoi bo cuc. */
  if (f.id === 'name') {
    field.baseline = f.baseline;
    field.fontSizeLatin = +(f.fontSize * NAME_LATIN_RATIO).toFixed(2);
    delete field.y;
  }
  return field;
}

/**
 * Mat sau cua mot ban + mot mau sac.
 *
 * soloY cho chuc danh: nhan vien co dia chi 2 dong nhung chi 1 chuc danh van phai
 * dung ban 2 dong (khong thi mat mot dong dia chi) => o chuc danh dong 2 bo trong,
 * de lai mot dong trang truoc vach ke vang. Luc do keo dong 1 xuong giua khoi.
 * Chi lam voi chuc danh: dong dia chi co icon dinh vi neo san trong anh nen.
 */
function buildBack(backId, colorId) {
  const fields = layout.backs[backId][colorId].fields.map((f) => toField(f, backId));

  const title = fields.find((f) => f.id === 'title');
  const title2 = fields.find((f) => f.id === 'title2');
  if (title && title2) {
    title.soloY = +((title.y + title2.y) / 2).toFixed(2);
    title.soloWhenEmpty = 'title2';
  }

  return {
    id: backId,
    label:
      backId === 'twoLine'
        ? '2 dòng (chức danh & địa chỉ song ngữ)'
        : '1 dòng (chức danh & địa chỉ một ngôn ngữ)',
    image: svgUrl(BACK_SVG[backId][colorId]),
    fields,
  };
}

const backsFor = (colorId) => ({
  twoLine: buildBack('twoLine', colorId),
  oneLine: buildBack('oneLine', colorId),
});

const FONTS = [
  { id: 'ss3-400', family: 'Source Sans 3', dataUrl: fontRegular, weight: 400 },
  { id: 'ss3-600', family: 'Source Sans 3', dataUrl: fontSemiBold, weight: 600 },
  { id: 'ss3-800', family: 'Source Sans 3', dataUrl: fontExtraBold, weight: 800 },
];

const CARD = { cardW: 91, cardH: 55, bleed: 0, radius: 0, fonts: FONTS };

export const COLORS = [
  { id: 'white', name: 'White' },
  { id: 'navy', name: 'Navy' },
];

/** Mot mau card, hai mau sac. */
export const TEMPLATES = [
  {
    ...CARD,
    id: 'white',
    color: 'white',
    name: 'Card visit',
    background: '#ffffff',
    front: { image: frontWhite, fields: [] },
    backs: backsFor('white'),
  },
  {
    ...CARD,
    id: 'navy',
    color: 'navy',
    name: 'Card visit',
    background: '#0C1A31',
    front: { image: frontNavy, fields: [] },
    backs: backsFor('navy'),
  },
];

export const TEMPLATE = TEMPLATES[0];

export const templateFor = (color) =>
  TEMPLATES.find((t) => t.color === color) || TEMPLATES[0];

/**
 * Chuan hoa du lieu truoc khi render: chuc danh (va dia chi) co hai dong cho hai
 * ngon ngu. Ai chi co MOT dong thi no phai nam o DONG 1 — cho danh cho ngon ngu
 * chinh, chu to hon. Nguoi nhap co the lo chi dien dong 2.
 */
const collapse = (emp, main, sub) => {
  const a = emp?.[main]?.trim();
  const b = emp?.[sub]?.trim();
  if (a || !b) return null;
  return { [main]: b, [sub]: '' };
};

export const normalizeEmp = (emp) => ({
  ...emp,
  ...collapse(emp, 'title', 'title2'),
  ...collapse(emp, 'address', 'address2'),
});

/**
 * Chon mat sau: chi can chuc danh HOAC dia chi co dong 2 la phai dung ban 2 dong
 * — ban 1 dong khong co cho cho dong thu hai nen dung nham se lam mat du lieu.
 */
export function backIdFor(template, emp) {
  const e = normalizeEmp(emp);
  const id = e.title2?.trim() || e.address2?.trim() ? 'twoLine' : 'oneLine';
  return template.backs[id] ? id : 'twoLine';
}

export const backFor = (template, emp) => template.backs[backIdFor(template, emp)];

/** Lop (anh nen + truong) cua mot mat, ung voi nhan vien dang render. */
export const layerFor = (template, side, emp) =>
  side === 'front' ? template.front : backFor(template, emp);
