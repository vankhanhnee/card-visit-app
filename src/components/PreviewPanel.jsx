import React, { useEffect, useMemo, useRef, useState } from 'react';
import CardCanvas from './CardCanvas';
import { buildQrMap } from '../lib/card';
import { backFor, normalizeEmp, COLORS } from '../templates';

/* Template co dinh => panel nay chi de XEM, khong sua duoc gi.
 * Khong co du lieu mau: preview luon lay tu danh sach nhan vien da nhap. */

const MM_PER_PX = 25.4 / 96;
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 6;

export default function PreviewPanel({ template, color, onPickColor, employees }) {
  // Chua chon gi => lay nhan vien dau danh sach.
  const [pickedId, setPickedId] = useState(null);
  // scale = null => tu tinh de CA HAI MAT vua khung. Nguoi dung zoom thi chot so.
  const [zoom, setZoom] = useState(null);
  const [fitScale, setFitScale] = useState(2);
  const stageRef = useRef(null);
  const [qrMap, setQrMap] = useState({});

  /* Do khung stage roi tinh muc zoom vua du xep hai mat canh nhau. Phai do lai
   * khi cua so doi kich thuoc, khong thi doi mau/nguoi la khung lech. */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const measure = () => {
      // padding hai ben (40) + khoang giua hai mat (24) + BIEN AN TOAN (24):
      // thieu bien nay thi phep tinh vua khit den tung pixel, chi can bong do
      // hoac thanh cuon la hai mat bi day xuong hai dong.
      const PAD = 40 * 2 + 24 + 24;
      const cardW = template.cardW / MM_PER_PX;
      const cardH = template.cardH / MM_PER_PX;
      const byWidth = (el.clientWidth - PAD) / (cardW * 2);
      const byHeight = (el.clientHeight - 90) / cardH; // chua cho caption
      const fit = Math.max(MIN_ZOOM, Math.min(byWidth, byHeight, MAX_ZOOM));
      setFitScale(Math.floor(fit * 100) / 100);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [template]);

  const scale = zoom ?? fitScale;

  const previewId = pickedId ?? employees[0]?.id;

  // Chuan hoa giong het luc render card: chi 1 chuc danh => nam o dong 1.
  const emp = useMemo(() => {
    const found = employees.find((e) => e.id === previewId) || employees[0];
    return found ? normalizeEmp(found) : null;
  }, [previewId, employees]);

  const back = emp ? backFor(template, emp) : null;

  useEffect(() => {
    if (emp) buildQrMap(template, [emp]).then(setQrMap);
  }, [template, emp]);

  if (!emp) {
    return (
      <div className="panel">
        <div className="empty-state">
          <p>Chưa có nhân viên để xem trước.</p>
          <p className="muted">Quay lại bước 1 để import hoặc nhập danh sách.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel preview-panel">
      <div className="canvas-col">
        <div className="canvas-toolbar">
          <div className="seg">
            {COLORS.map((c) => (
              <button
                key={c.id}
                className={c.id === color ? 'on' : ''}
                onClick={() => onPickColor(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>

          <select value={previewId} onChange={(e) => setPickedId(e.target.value)}>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name || '(chưa có tên)'}
              </option>
            ))}
          </select>

          <div className="zoom">
            <button
              className="btn ghost icon"
              onClick={() => setZoom(Math.max(MIN_ZOOM, +(scale - 0.25).toFixed(2)))}
              disabled={scale <= MIN_ZOOM}
              title="Thu nhỏ"
            >
              −
            </button>
            <span className="zoom-val">{Math.round(scale * 100)}%</span>
            <button
              className="btn ghost icon"
              onClick={() => setZoom(Math.min(MAX_ZOOM, +(scale + 0.25).toFixed(2)))}
              disabled={scale >= MAX_ZOOM}
              title="Phóng to"
            >
              +
            </button>
            <button className="btn ghost" onClick={() => setZoom(null)} disabled={zoom === null}>
              Vừa khung
            </button>
          </div>
        </div>

        <div className="canvas-stage both-sides" ref={stageRef}>
          <figure>
            <CardCanvas template={template} side="back" emp={emp} qrMap={qrMap} scale={scale} />
            <figcaption>Mặt thông tin</figcaption>
          </figure>
          <figure>
            <CardCanvas template={template} side="front" emp={emp} qrMap={qrMap} scale={scale} />
            <figcaption>Mặt logo</figcaption>
          </figure>
        </div>
      </div>

      <aside className="inspector">
        <section>
          <h3>Card visit · {COLORS.find((c) => c.id === color)?.name}</h3>
          <p className="muted small">
            Hai phiên bản màu đều được khoá sẵn trong app đúng theo bản thiết kế ({template.cardW} ×{' '}
            {template.cardH} mm, font Source Sans 3) — không nạp được mẫu khác. Màu bạn chọn ở đây
            cũng chính là màu dùng khi <b>xuất PDF</b>.
          </p>
        </section>

        <section>
          <h3>Mặt sau: {back.label}</h3>
          <p className="muted small">
            {Object.keys(template.backs).length > 1 ? (
              <>
                Mẫu này có 2 bản mặt sau, app tự chọn theo dữ liệu: chức danh <b>hoặc</b> địa chỉ có{' '}
                <b>dòng 2</b> (bản dịch sang ngôn ngữ khác) thì dùng bản 2 dòng; chỉ 1 ngôn ngữ thì
                dùng bản 1 dòng.
              </>
            ) : (
              <>
                Mẫu này chỉ có 1 bản mặt sau. Nhân viên không có <b>dòng 2</b> (bản dịch chức danh /
                địa chỉ) thì dòng đó bỏ trống, bố cục giữ nguyên.
              </>
            )}
          </p>
        </section>

        <section>
          <h3>Dữ liệu điền vào card</h3>
          <ul className="field-list">
            {back.fields.map((f) => {
              const v = emp?.[f.key];
              return (
                <li key={f.id} className="plain">
                  <span className="flabel">{f.label}</span>
                  <span className={v ? 'pick-sub' : 'pick-sub warn'}>{v || '— trống —'}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </aside>
    </div>
  );
}
