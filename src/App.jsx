import React, { useEffect, useMemo, useState } from 'react';
import EmployeesPanel from './components/EmployeesPanel';
import PreviewPanel from './components/PreviewPanel';
import ExportPanel from './components/ExportPanel';
import { COLORS, templateFor } from './templates';
import { loadStore, saveStore } from './platform';
import { ensureCjk } from './lib/cjk';

/* Template co dinh: doc thang tu code, KHONG luu vao store va khong sua duoc.
 * Nho vay moi lan cap nhat app la template moi nhat duoc dung ngay. */

const TABS = [
  { id: 'employees', label: '1 · Nhân viên' },
  { id: 'preview', label: '2 · Xem trước' },
  { id: 'export', label: '3 · Xuất PDF' },
];

export default function App() {
  const [tab, setTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  // Mau sac dang chon — dung chung cho ca Xem truoc lan Xuat PDF.
  const [color, setColor] = useState(COLORS[0].id);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await loadStore();
      if (saved?.employees) setEmployees(saved.employees);
      if (saved?.color) setColor(saved.color);
      setReady(true);
    })();
  }, []);

  /* Font Nhat/Trung (~40MB) duoc nap DONG va chi khi du lieu that su co chu
   * Nhat/Trung — ban web khong the bat nguoi dung tai 40MB truoc khi thay gi. */
  const [cjkReady, setCjkReady] = useState(0);
  useEffect(() => {
    (async () => {
      const texts = employees.flatMap((e) => Object.values(e));
      await ensureCjk(texts);
      setCjkReady((n) => n + 1); // ve lai card sau khi font san sang
    })();
  }, [employees]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => saveStore({ employees, color }), 400);
    return () => clearTimeout(t);
  }, [employees, color, ready]);

  const template = templateFor(color);

  const filled = useMemo(
    () => employees.filter((e) => e.name?.trim()).length,
    [employees]
  );

  if (!ready) return <div className="boot">Đang tải…</div>;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" />
          <div>
            <h1>Card Visit Maker</h1>
            <p>Import nhân viên · Xuất PDF danh thiếp TIXIMAX</p>
          </div>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'tab active' : 'tab'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="stats">
          <span>{employees.length} nhân viên</span>
          <span className={filled ? 'ok' : 'warn'}>{filled} sẵn sàng in</span>
          <span className="ok">
            {COLORS.find((c) => c.id === color)?.name} · {template.cardW}×{template.cardH}mm
          </span>
        </div>
      </header>

      <main>
        {tab === 'employees' && (
          <EmployeesPanel employees={employees} setEmployees={setEmployees} />
        )}
        {tab === 'preview' && (
          <PreviewPanel
            key={`preview-${cjkReady}`}
            template={template}
            color={color}
            onPickColor={setColor}
            employees={employees}
          />
        )}
        {tab === 'export' && <ExportPanel template={template} employees={employees} />}
      </main>
    </div>
  );
}
