/* ---------------------------------------------------------------
 * Noto Sans JP + Noto Sans SC cho chu Nhat / Trung.
 *
 * cjk.css chua ~675 @font-face (woff2 nhung data-URL), moi cai phu mot
 * unicode-range. File nay ~40MB nen KHONG duoc nam trong bundle chinh: ban web
 * se phai tai 40MB truoc khi hien duoc gi. No duoc nap DONG (dynamic import) va
 * chi khi du lieu that su co chu Nhat/Trung.
 *
 * Khi da nap, chi chen dung subset chua ky tu co tren card — thuong vai chuc KB.
 * ------------------------------------------------------------- */

const CJK_START = 0x2e80; // tu day tro len moi can font CJK; Latin da co Source Sans 3

/** Chuoi co chua ky tu ngoai he Latin (kanji, kana, hangul...)? */
export const hasCjkText = (texts) =>
  texts.some((t) => [...String(t ?? '')].some((ch) => ch.codePointAt(0) >= CJK_START));

/** "u+4e00-9fff, u+30??" -> [[0x4e00,0x9fff],[0x3000,0x30ff]] */
function parseRanges(raw) {
  const out = [];
  for (const part of raw.split(',')) {
    const t = part.trim().replace(/^u\+/i, '');
    if (!t) continue;
    if (t.includes('?')) {
      out.push([parseInt(t.replace(/\?/g, '0'), 16), parseInt(t.replace(/\?/g, 'f'), 16)]);
    } else if (t.includes('-')) {
      const [a, b] = t.split('-');
      out.push([parseInt(a, 16), parseInt(b, 16)]);
    } else {
      const v = parseInt(t, 16);
      out.push([v, v]);
    }
  }
  return out;
}

let BLOCKS = null;
let loading = null;

/** Nap cjk.css (mot lan) neu du lieu co chu Nhat/Trung. */
export async function ensureCjk(texts) {
  if (BLOCKS || !hasCjkText(texts)) return;
  loading ??= import('../templates/fonts/cjk.css?raw').then((m) => {
    BLOCKS = m.default
      .split('@font-face')
      .slice(1)
      .map((body) => {
        const range = /unicode-range:([^;]+);/.exec(body)?.[1];
        return range ? { css: `@font-face${body}`, ranges: parseRanges(range) } : null;
      })
      .filter(Boolean);
  });
  await loading;
}

/** @font-face cho dung nhung subset ma `texts` cham toi. */
export function cjkFontCss(texts) {
  if (!BLOCKS) return ''; // chua nap xong => chua can (hoac dang tai)

  const cps = new Set();
  for (const t of texts) {
    if (!t) continue;
    for (const ch of String(t)) {
      const cp = ch.codePointAt(0);
      if (cp >= CJK_START) cps.add(cp);
    }
  }
  if (!cps.size) return '';

  const need = [...cps];
  return BLOCKS.filter((b) => need.some((cp) => b.ranges.some(([lo, hi]) => cp >= lo && cp <= hi)))
    .map((b) => b.css)
    .join('\n');
}
