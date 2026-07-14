import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { uid } from './card';

/** Cac truong chuan cua card visit. */
/* Dung dung cac truong ma template in ra.
 *
 * Chuc danh va dia chi thuong viet 2 ngon ngu (JP + EN, hoac EN + VI): dong 1 la
 * ngon ngu chinh, dong 2 la ban dich. Ai chi co 1 dong thi de trong dong 2 —
 * app se tu dung mat sau ban 1 dong. */
export const FIELD_KEYS = [
  { key: 'name', label: 'Họ và tên' },
  { key: 'title', label: 'Chức danh — dòng 1' },
  { key: 'title2', label: 'Chức danh — dòng 2 (để trống nếu chỉ có 1 dòng)' },
  { key: 'phone', label: 'Điện thoại' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Địa chỉ — dòng 1' },
  { key: 'address2', label: 'Địa chỉ — dòng 2 (để trống nếu chỉ có 1 dòng)' },
  { key: 'company', label: 'Tên công ty — dòng 1' },
  { key: 'companySub', label: 'Tên công ty — dòng 2 (bản dịch / chi nhánh)' },
  { key: 'website', label: 'Website' },
];

/* Doan cot Excel -> truong card, khong phan biet dau/hoa thuong.
 *
 * Khoa "dong 2" phai dung TRUOC khoa "dong 1": cot "ADDRESS_EN" khong duoc nuot
 * mat vao 'address'. Dong 2 co the la bat ky ngon ngu nao (EN, JP, VI) nen goi y
 * phu ca ba. */
const HINTS = {
  companySub: [
    'company name_jp', 'company_jp', 'company jp', 'company 2', 'company_en', 'company en',
    'cong ty 2', 'cong ty jp', 'cong ty en', 'ten cong ty nhanh', 'cong ty nhanh',
    'chi nhanh', 'branch',
  ],
  address2: [
    'address_en', 'address en', 'address_jp', 'address jp', 'address 2', 'address2',
    'dia chi en', 'dia chi jp', 'dia chi 2', 'dia chi dong 2',
  ],
  title2: [
    'position_en', 'position en', 'position_jp', 'position jp', 'position 2', 'position2',
    'title en', 'title jp', 'title 2', 'chuc danh en', 'chuc danh jp', 'chuc danh 2',
    'chuc danh dong 2', 'chuc vu 2',
  ],
  name: ['full name', 'full_name', 'ho va ten', 'ho ten', 'hoten', 'ten', 'name', 'fullname'],
  title: ['chuc danh', 'chuc vu', 'title', 'position'],
  phone: ['dien thoai', 'sdt', 'so dien thoai', 'phone', 'mobile', 'tel'],
  email: ['email', 'e-mail', 'mail'],
  company: ['company name', 'ten cong ty', 'cong ty', 'company', 'to chuc', 'organization'],
  website: ['website', 'web', 'url', 'trang web'],
  address: ['dia chi', 'address', 'addr'],
};

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();

export function guessMapping(headers) {
  const map = {};
  for (const h of headers) {
    const n = norm(h);
    for (const [key, hints] of Object.entries(HINTS)) {
      if (map[key]) continue;
      if (hints.some((x) => n === x) || hints.some((x) => n.includes(x))) {
        map[key] = h;
        break;
      }
    }
  }
  return map;
}

/** file: { ext, data: ArrayBuffer } -> { headers, rows } */
export function parseFile(file) {
  if (file.ext === 'csv') {
    const text = new TextDecoder('utf-8').decode(file.data);
    const res = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
    const rows = res.data;
    const headers = res.meta.fields || [];
    return { headers, rows };
  }

  const wb = XLSX.read(file.data, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

/** Ap column-mapping -> danh sach nhan vien chuan hoa. */
export function applyMapping(rows, mapping) {
  return rows
    .map((row) => {
      const emp = { id: uid() };
      for (const { key } of FIELD_KEYS) {
        const col = mapping[key];
        emp[key] = col ? String(row[col] ?? '').trim() : '';
      }
      return emp;
    })
    .filter((e) => FIELD_KEYS.some(({ key }) => e[key]));
}
