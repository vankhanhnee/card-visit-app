# Card Visit Maker

Import danh sách nhân viên → xuất PDF danh thiếp, theo đúng bản thiết kế đã khoá sẵn trong app.
Chạy được ở **hai dạng**: app desktop (Electron) và **web** (chạy thẳng trong trình duyệt).

Template được đọc **trực tiếp từ các file SVG thiết kế** — không có toạ độ nào hardcode trong code.

---

## Chạy

```bash
npm install
npm run fonts       # tải font Nhật/Trung (~40MB) — chỉ cần chạy 1 lần
npm run templates   # đọc design/*.svg → sinh ảnh nền + layout.json

npm run dev         # desktop (Electron + hot reload)
npm run web         # web (http://localhost:5173)
```

Đóng gói:

```bash
npm run dist:win    # -> release/*.exe (bộ cài + bản portable)
npm run dist:mac    # -> release/*.dmg
npm run build:web   # -> dist/  (deploy lên bất kỳ static host nào)
```

## Quy trình 3 bước

1. **Nhân viên** — import Excel/CSV (app tự đoán cột) hoặc nhập tay.
2. **Xem trước** — chọn màu **White / Navy**, xem cả hai mặt, zoom.
3. **Xuất PDF** — mỗi nhân viên **một file PDF riêng**; từ 2 người trở lên tự đóng gói thành **.zip**.

Bố cục trang: *1 card/trang* (đúng khổ thật, gửi nhà in) hoặc *xếp lưới A4/A3* kèm crop marks.
Khi in 2 mặt, các trang mặt sau được lật gương theo cột để khớp lúc lật giấy cạnh dài.

### Trường dữ liệu

`name`, `title` / `title2`, `phone`, `email`, `address` / `address2`, `company` / `companySub`,
`website`.

Chức danh và địa chỉ thường viết **hai ngôn ngữ** (Nhật + Anh, hoặc Anh + Việt): dòng 1 là ngôn ngữ
chính, dòng 2 là bản dịch. Ai chỉ có một dòng thì để trống dòng 2 — app tự dồn lên dòng 1.

---

## Desktop vs Web

|  | Desktop (Electron) | Web |
|---|---|---|
| Chữ trong PDF | **Vector** (`printToPDF` của Chromium) | **Ảnh 600 dpi** (canvas → `pdf-lib`) |
| Lưu dữ liệu | `store.json` trong userData | `localStorage` |
| Xuất file | Hộp thoại lưu file | Tải xuống của trình duyệt |

Trình duyệt không có API in ra PDF vector, nên bản web phải tự dựng PDF: mỗi mặt card được vẽ ra
canvas ở 600 dpi rồi nhúng vào PDF. In danh thiếp ở 600 dpi thì mắt thường không phân biệt được,
**nhưng nếu nhà in yêu cầu chữ vector thì dùng bản desktop.**

Vị trí / cỡ chữ / giãn chữ ở cả hai bản đều lấy từ **cùng một hàm** (`fitFontSize`, `topOf` trong
`src/lib/card.js`), nên preview và PDF không thể lệch nhau.

---

## Template — đọc từ file thiết kế

Bản thiết kế gốc nằm trong `design/`. Chạy `npm run templates` là xong; script
`scripts/build-templates.js` làm 4 việc trên mỗi file SVG:

1. **Tìm khung card** — hình chữ nhật nền có đúng tỉ lệ 91:55. (Không suy từ `viewBox` được: shadow
   lệch xuống dưới nên phần padding không đối xứng.)
2. **Nhận diện path chữ** — Figma outline chữ thành path có `d` rất dài (>3000 ký tự); hoa văn và
   icon đều ngắn hơn nhiều.
3. **Gán vai trò theo vị trí** — 3 cột, phân biệt bằng mép trái: cột tên/chức danh ~6.6% chiều rộng
   card, cột liên hệ ~11.9% (thụt vào vì có icon), khối tên công ty >50% (canh phải).
4. **Suy vị trí, cỡ chữ, màu chữ, giãn chữ** → `src/templates/layout.json`; các path chữ bị gỡ khỏi
   SVG để còn lại ảnh nền sạch.

**Cỡ chữ suy từ bề rộng, không phải chiều cao** — chiều cao vệt mực phụ thuộc chữ cụ thể (ba dòng
liên hệ cùng 16px lại ra 8.19 / 7.77 / 8.28pt). Nhưng bề rộng lại bị **letter-spacing** làm nhiễu,
và sai lệch càng lớn khi chuỗi càng dài. Nên script **ước lượng luôn letter-spacing** từ chính file:
quét giá trị nào khiến mọi trường ra gần số nguyên px nhất (nhà thiết kế luôn gõ số nguyên) → ra
0.1px. Trừ nó ra thì mọi cỡ chữ về đúng số nguyên: 14, 11, 32, 16, 12, 16, 16, 16, 13, 16.

**Hai thứ không đọc được từ file** (chữ đã outline nên mất hết metadata): **font weight** và **chuỗi
placeholder**. Cả hai khai báo ở đầu `build-templates.js`. Đổi chuỗi trong Figma mà quên sửa ở đây
thì script **báo lỗi** chứ không âm thầm ra layout sai (nó kiểm tra chéo bằng chiều cao).

### Mặt sau có hai bản

| Bản | Dùng khi |
|---|---|
| 2 dòng | Chức danh **hoặc** địa chỉ có dòng 2 |
| 1 dòng | Cả hai đều chỉ 1 dòng |

Chỉ cần **một** trong hai có dòng 2 là phải dùng bản 2 dòng — bản 1 dòng không có chỗ cho dòng thứ
hai, chọn nhầm sẽ **mất dữ liệu**. Hệ quả: người có 2 địa chỉ nhưng 1 chức danh sẽ để trống ô chức
danh dòng 2, nên dòng chức danh được **tự dồn xuống giữa khối** cho khỏi hụt (`soloY`). Chỉ dồn chức
danh — dòng địa chỉ có icon định vị neo sẵn trong ảnh nền, dịch xuống là lệch khỏi icon.

## Chữ Nhật / Trung

Source Sans 3 chỉ có Latin → font stack là `Source Sans 3 → Noto Sans JP → Noto Sans SC`, cả hai font
Noto **bundle sẵn** (`npm run fonts`) nên chữ in ra giống nhau trên mọi máy.

`cjk.css` chứa ~675 `@font-face` woff2 nhúng data-URL, chia theo `unicode-range` (~40MB). File này
**không nằm trong bundle chính** — nó được nạp động và chỉ khi dữ liệu thật sự có chữ Nhật/Trung; khi
render cũng chỉ chèn đúng subset chứa ký tự xuất hiện trên card (thường vài chục KB).

Phải có **đủ cả 3 weight** (400/600/800): thiếu weight nào Chromium sẽ *bôi đậm giả*, nét chữ Nhật bè
ra không giống thiết kế.

## Script

| Lệnh | Việc |
|---|---|
| `npm run templates` | Đọc `design/*.svg` → ảnh nền + `layout.json` |
| `npm run fonts` | Tải Noto Sans JP/SC → `src/templates/fonts/cjk.css` |
| `npm run icon` | Dựng icon app từ logo vector trong file thiết kế |
| `node_modules/.bin/electron scripts/verify-app.js` | Mở app thật, chụp màn hình tab Xem trước |
| `node_modules/.bin/electron scripts/verify-export.js` | Xuất PDF/ZIP từ app desktop rồi mở file ra kiểm |
| `node_modules/.bin/electron scripts/verify-web.js` | Mở bản web (không có `window.api`), xuất PDF rồi kiểm |
| `node_modules/.bin/electron scripts/analyze-template.js <file.svg>` | Đo bbox từng path trong một file thiết kế |

## Ghi chú kỹ thuật

- **Mỗi trường chỉ được một dòng** — địa chỉ dài cũng không xuống dòng (sẽ vỡ bố cục). Vượt bề ngang
  cho phép thì cỡ chữ tự thu nhỏ (tối đa 65%).
- **Họ tên đổi cỡ theo ngôn ngữ** (32px cho chữ Nhật/Trung, 28px cho Latin) nên dòng này neo bằng
  **baseline** chứ không phải mép trên — neo mép trên thì tên Latin sẽ bị treo lên.
- **Font phải nạp xong trước khi đo chữ**, không thì đo nhầm bằng font hệ thống. Bản web còn phải
  *ép nạp* bằng FontFace API: `@font-face` chỉ được tải khi có chữ thật dùng đến, mà ô xem trước ở
  tab Xuất PDF chỉ hiện mặt logo (không có chữ) → canvas sẽ vẽ bằng Arial.
- Print window của Electron được **dùng lại** giữa các lần xuất. Tạo/`destroy()` window mới mỗi lần
  thì từ lần thứ hai Electron không spawn được renderer (`ERR_FAILED -2`) và PDF sẽ hỏng.
