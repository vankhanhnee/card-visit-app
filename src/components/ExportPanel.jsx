import React, { useEffect, useMemo, useState } from 'react';
import CardCanvas from './CardCanvas';
import { buildQrMap } from '../lib/card';
import { backIdFor } from '../templates';
import { exportCards, isDesktop } from '../platform';
import { ensureCjk } from '../lib/cjk';

/**
 * Ten file PDF cua mot nhan vien.
 *
 * Bo dau tieng Viet cho de doc, nhung GIU NGUYEN chu Nhat/Trung — neu loc chi
 * con [a-z0-9] thi ten '田中 太郎' se bien thanh chuoi rong.
 * Chi thay cac ky tu he dieu hanh cam dat trong ten file.
 *
 * Hai nguoi trung ten => them hau to -2, -3...: trong mot file zip, hai entry
 * cung ten thi cai sau DE MAT cai truoc.
 */
function pdfName(emp, index, used) {
  const slug =
    String(emp.name || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // dau tieng Viet
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[\\/:*?"<>|\s.]+/g, '-') // ky tu cam trong ten file
      .replace(/^-+/, '')
      .replace(/-+$/, '')
      .trim() || `nhan-vien-${index + 1}`;

  const n = (used.get(slug) || 0) + 1;
  used.set(slug, n);
  const suffix = n > 1 ? `-${n}` : '';
  return `card-visit-${slug}${suffix}.pdf`;
}

export default function ExportPanel({ template, employees }) {
  const [selected, setSelected] = useState(() => new Set(employees.map((e) => e.id)));
  const [layout, setLayout] = useState('single');
  const [sides, setSides] = useState('both');
  const [cropMarks, setCropMarks] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [qrMap, setQrMap] = useState({});

  // Nhan vien moi import mac dinh duoc chon.
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => employees.some((e) => e.id === id)));
      employees.forEach((e) => !prev.size && next.add(e.id));
      return next.size ? next : new Set(employees.map((e) => e.id));
    });
  }, [employees]);

  const chosen = useMemo(
    () => employees.filter((e) => selected.has(e.id)),
    [employees, selected]
  );

  useEffect(() => {
    if (chosen[0]) buildQrMap(template, [chosen[0]]).then(setQrMap);
  }, [template, chosen]);

  // Moi nhan vien duoc xep vao ban mat sau phu hop voi du lieu cua ho.
  const backCount = useMemo(
    () =>
      chosen.reduce(
        (acc, e) => ({ ...acc, [backIdFor(template, e)]: acc[backIdFor(template, e)] + 1 }),
        { twoLine: 0, oneLine: 0 }
      ),
    [chosen, template]
  );

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  async function doExport() {
    if (!chosen.length) return;
    setBusy(true);
    setResult(null);
    try {
      const qr = await buildQrMap(template, chosen);

      // Co chu duoc thu nho theo be rong chu => font phai nap xong truoc, khong
      // thi do nham bang font he thong. Chu Nhat/Trung can nap them font Noto.
      await ensureCjk(chosen.flatMap((e) => Object.values(e)));
      await document.fonts.ready;

      // Moi nhan vien mot file PDF rieng (ten file gan kem vao emp).
      const used = new Map();
      const items = chosen.map((emp, i) => ({ ...emp, __fileName: pdfName(emp, i, used) }));

      const res = await exportCards({
        template,
        employees: items,
        qrMap: qr,
        opts: { layout, sides, cropMarks },
        suggestedName:
          items.length === 1 ? items[0].__fileName : `card-visit-${items.length}-nhan-vien.zip`,
      });

      if (res.ok) setResult({ ok: true, path: res.filePath, count: res.count, web: res.web });
      else if (!res.canceled) setResult({ ok: false, error: res.error });
    } catch (e) {
      setResult({ ok: false, error: String(e) });
    } finally {
      setBusy(false);
    }
  }

  if (!employees.length) {
    return (
      <div className="panel">
        <div className="empty-state">
          <p>Chưa có nhân viên để xuất.</p>
          <p className="muted">Quay lại bước 1 để import hoặc nhập danh sách.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel export-panel">
      <div className="export-left">
        <div className="panel-head">
          <h2>Chọn nhân viên ({chosen.length}/{employees.length})</h2>
          <div className="actions">
            <button
              className="link"
              onClick={() => setSelected(new Set(employees.map((e) => e.id)))}
            >
              Chọn tất cả
            </button>
            <button className="link" onClick={() => setSelected(new Set())}>
              Bỏ chọn
            </button>
          </div>
        </div>

        <ul className="pick-list">
          {employees.map((e) => (
            <li key={e.id} className={selected.has(e.id) ? 'on' : ''}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(e.id)}
                  onChange={() => toggle(e.id)}
                />
                <span className="pick-name">{e.name || '(chưa có tên)'}</span>
                <span className="pick-sub">{e.title}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <aside className="inspector">
        <section>
          <h3>Kiểu file PDF</h3>
          <label className="stack">
            <span>Bố cục trang</span>
            <select value={layout} onChange={(e) => setLayout(e.target.value)}>
              <option value="single">1 card / trang — đúng khổ thật (gửi nhà in)</option>
              <option value="a4">Xếp lưới trên A4 — tự in, có crop marks</option>
              <option value="a3">Xếp lưới trên A3</option>
            </select>
          </label>

          <label className="stack">
            <span>Mặt in</span>
            <select value={sides} onChange={(e) => setSides(e.target.value)}>
              <option value="both">Cả 2 mặt</option>
              <option value="front">Chỉ mặt trước</option>
              <option value="back">Chỉ mặt sau</option>
            </select>
          </label>

          {layout !== 'single' && (
            <label className="check">
              <input
                type="checkbox"
                checked={cropMarks}
                onChange={(e) => setCropMarks(e.target.checked)}
              />
              Thêm crop marks
            </label>
          )}

          {layout !== 'single' && sides === 'both' && (
            <p className="muted small">
              Trang mặt sau được lật gương theo cột để khớp khi in 2 mặt lật cạnh dài.
            </p>
          )}

          {template.bleed > 0 && layout === 'single' && (
            <p className="muted small">
              Trang PDF = {template.cardW + template.bleed * 2} × {template.cardH + template.bleed * 2} mm
              (đã gồm bleed {template.bleed} mm mỗi cạnh).
            </p>
          )}

          {sides !== 'front' && chosen.length > 0 && (
            <p className="muted small">
              Mặt sau tự chọn theo dữ liệu: {backCount.twoLine} card bản 2 dòng (chức danh / địa chỉ
              song ngữ), {backCount.oneLine} card bản 1 dòng.
            </p>
          )}
        </section>

        <section>
          <h3>Xem trước</h3>
          {chosen[0] ? (
            <div className="mini-preview">
              <CardCanvas
                template={template}
                side="front"
                emp={chosen[0]}
                qrMap={qrMap}
                /* cot inspector rong ~308px; 90mm ~ 340px o scale 1 => phai thu nho */
                scale={0.85}
              />
            </div>
          ) : (
            <p className="muted small">Chọn ít nhất 1 nhân viên.</p>
          )}
        </section>

        <p className="muted small">
          Mỗi nhân viên một file PDF riêng
          {chosen.length > 1 && <> — {chosen.length} file được đóng gói vào một file <b>.zip</b></>}.
        </p>

        {!isDesktop && (
          <p className="muted small">
            Bản web dựng PDF ngay trong trình duyệt: chữ được kết xuất ở <b>600 dpi</b> (dạng ảnh).
            In danh thiếp thì mắt thường không phân biệt được, nhưng nếu nhà in yêu cầu <b>chữ
            vector</b> thì hãy dùng bản desktop.
          </p>
        )}

        <button
          className="btn primary full big"
          disabled={!chosen.length || busy}
          onClick={doExport}
        >
          {busy && `Đang tạo ${chosen.length} PDF…`}
          {!busy && chosen.length > 1 && `Xuất ZIP (${chosen.length} PDF)`}
          {!busy && chosen.length <= 1 && 'Xuất PDF'}
        </button>

        {result?.ok && (
          <div className="alert ok">
            {result.count > 1 ? `Đã lưu ZIP (${result.count} file PDF).` : 'Đã lưu PDF.'}
            {result.path && (
              <button className="link" onClick={() => window.api.showItem(result.path)}>
                Mở thư mục
              </button>
            )}
            {result.web && <span>Kiểm tra thư mục Tải xuống của trình duyệt.</span>}
          </div>
        )}
        {result && !result.ok && <div className="alert error">Lỗi: {result.error}</div>}
      </aside>
    </div>
  );
}
