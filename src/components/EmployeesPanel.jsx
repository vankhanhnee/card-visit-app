import React, { useState } from 'react';
import { pickDataFile } from '../platform';
import { FIELD_KEYS, applyMapping, guessMapping, parseFile } from '../lib/importData';
import { uid } from '../lib/card';

const emptyEmp = () => {
  const e = { id: uid() };
  FIELD_KEYS.forEach(({ key }) => (e[key] = ''));
  return e;
};

export default function EmployeesPanel({ employees, setEmployees }) {
  const [parsed, setParsed] = useState(null); // { headers, rows, fileName }
  const [mapping, setMapping] = useState({});
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState('');

  async function handleImport() {
    setErr('');
    try {
      const file = await pickDataFile();
      if (!file) return;
      const { headers, rows } = parseFile(file);
      if (!rows.length) {
        setErr('File không có dòng dữ liệu nào.');
        return;
      }
      setParsed({ headers, rows, fileName: file.name });
      setMapping(guessMapping(headers));
    } catch (e) {
      setErr('Không đọc được file: ' + e.message);
    }
  }

  function confirmImport(mode) {
    const imported = applyMapping(parsed.rows, mapping);
    setEmployees(mode === 'replace' ? imported : [...employees, ...imported]);
    setParsed(null);
    setMapping({});
  }

  function saveEdit(emp) {
    setEmployees((prev) => {
      const i = prev.findIndex((e) => e.id === emp.id);
      if (i === -1) return [...prev, emp];
      const next = [...prev];
      next[i] = emp;
      return next;
    });
    setEditing(null);
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Danh sách nhân viên</h2>
        <div className="actions">
          <button className="btn" onClick={handleImport}>
            Import Excel / CSV
          </button>
          <button className="btn primary" onClick={() => setEditing(emptyEmp())}>
            + Thêm nhân viên
          </button>
          {employees.length > 0 && (
            <button
              className="btn ghost danger"
              onClick={() => confirm('Xoá toàn bộ danh sách?') && setEmployees([])}
            >
              Xoá tất cả
            </button>
          )}
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}

      {employees.length === 0 && !parsed && (
        <div className="empty-state">
          <p>Chưa có nhân viên nào.</p>
          <p className="muted">
            Import file Excel/CSV (app tự đoán cột), hoặc thêm thủ công từng người.
          </p>
        </div>
      )}

      {employees.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Họ và tên</th>
                <th>Chức danh</th>
                <th>Điện thoại</th>
                <th>Email</th>
                <th>Công ty</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e, i) => (
                <tr key={e.id}>
                  <td className="idx">{i + 1}</td>
                  <td className="strong">{e.name || <em className="muted">—</em>}</td>
                  <td>{e.title}</td>
                  <td>{e.phone}</td>
                  <td>{e.email}</td>
                  <td>{e.company}</td>
                  <td className="row-actions">
                    <button className="link" onClick={() => setEditing({ ...e })}>
                      Sửa
                    </button>
                    <button
                      className="link danger"
                      onClick={() => setEmployees(employees.filter((x) => x.id !== e.id))}
                    >
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- Modal: map cot Excel ---- */}
      {parsed && (
        <div className="modal-backdrop" onClick={() => setParsed(null)}>
          <div className="modal wide" onClick={(ev) => ev.stopPropagation()}>
            <h3>Ghép cột — {parsed.fileName}</h3>
            <p className="muted">
              Tìm thấy <b>{parsed.rows.length}</b> dòng. Chọn cột trong file tương ứng với từng
              trường trên card visit.
            </p>

            <div className="map-grid">
              {FIELD_KEYS.map(({ key, label }) => (
                <label key={key} className="map-row">
                  <span>{label}</span>
                  <select
                    value={mapping[key] || ''}
                    onChange={(ev) => setMapping({ ...mapping, [key]: ev.target.value })}
                  >
                    <option value="">— bỏ qua —</option>
                    {parsed.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setParsed(null)}>
                Huỷ
              </button>
              {employees.length > 0 && (
                <button className="btn" onClick={() => confirmImport('append')}>
                  Thêm vào danh sách
                </button>
              )}
              <button className="btn primary" onClick={() => confirmImport('replace')}>
                {employees.length > 0 ? 'Thay thế danh sách' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Modal: nhap / sua nhan vien ---- */}
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(ev) => ev.stopPropagation()}>
            <h3>{employees.some((e) => e.id === editing.id) ? 'Sửa' : 'Thêm'} nhân viên</h3>

            <div className="form-grid">
              {FIELD_KEYS.map(({ key, label }) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    value={editing[key] || ''}
                    onChange={(ev) => setEditing({ ...editing, [key]: ev.target.value })}
                  />
                </label>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setEditing(null)}>
                Huỷ
              </button>
              <button className="btn primary" onClick={() => saveEdit(editing)}>
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
