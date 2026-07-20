import { useEffect, useRef, useState } from "react";
import { getActiveRecord, getRecordsByYear } from "../db/index.js";
import EditModal from "./EditModal.jsx";

const MONTH_INITIALS = ["E","F","M","A","M","J","J","A","S","O","N","D"];
const LABEL_W = 18; // px — columna de números de día (fija)

function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }

function toLocalStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayStr() { return toLocalStr(new Date()); }

function cellClasses(record, dateStr, today) {
  const r = "rounded-sm";
  if (dateStr > today)         return `${r} bg-neutral-900/40 cursor-default`;
  if (!record)                 return `${r} bg-neutral-800 hover:bg-neutral-700 cursor-pointer`;
  if (record.status === "vacation") return `${r} bg-violet-700 hover:bg-violet-600 cursor-pointer`;
  if (record.status === "rest")     return `${r} bg-amber-500 hover:bg-amber-400 cursor-pointer`;
  if (record.status === "zero")     return `${r} bg-red-600 hover:bg-red-500 cursor-pointer`;
  if (!record.closedAt && dateStr === today)
    return `${r} bg-green-900/60 ring-1 ring-green-600/50 animate-pulse cursor-pointer`;
  const h = record.hours ?? 0;
  if (h >= 5) return `${r} bg-green-400 hover:bg-green-300 cursor-pointer`;
  if (h >= 3) return `${r} bg-green-600 hover:bg-green-500 cursor-pointer`;
  if (h >= 1) return `${r} bg-green-900 hover:bg-green-800 cursor-pointer`;
  return `${r} bg-neutral-800 hover:bg-neutral-700 cursor-pointer`;
}

// Calcula el tamaño de celda máximo que hace entrar el año completo en pantalla
function computeCell() {
  if (typeof window === "undefined") return { cell: 18, gap: 2 };
  // 32 filas (cabecera + días 1-31), 13 columnas (label + 12 meses)
  // alto label del año ≈ 32px, nav ≈ 80px, respiración ≈ 12px
  const availW = window.innerWidth  - 16;
  const availH = window.innerHeight - 80 - 32 - 12;
  for (let c = 28; c >= 8; c--) {
    const g = Math.max(1, Math.round(c * 0.12));
    const w = LABEL_W + 12 * c + 11 * g;
    const h = 32 * c + 31 * g;
    if (w <= availW && h <= availH) return { cell: c, gap: g };
  }
  return { cell: 8, gap: 1 };
}

export default function Heatmap({ year = new Date().getFullYear(), refreshKey, onRecordChange }) {
  const [recordMap, setRecordMap] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [zoom, setZoom] = useState({ phase: "idle", ox: 0, oy: 0 });
  const [dims, setDims] = useState(() => computeCell());
  const gridRef = useRef(null);
  const today = todayStr();

  const cellPx  = dims.cell;
  const gapPx   = dims.gap;
  const fontSize = Math.max(7, Math.min(10, Math.floor(cellPx * 0.52)));

  useEffect(() => {
    function onResize() { setDims(computeCell()); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    async function load() {
      const [records, active] = await Promise.all([
        getRecordsByYear(year),
        getActiveRecord(),
      ]);
      const map = {};
      for (const r of records) map[r.date] = r;
      if (active && active.date.startsWith(String(year))) map[active.date] = active;
      setRecordMap(map);
    }
    load();
  }, [year, refreshKey]);

  function handleCellClick(dateStr, e) {
    if (dateStr > today) return;
    if (gridRef.current) {
      const gr = gridRef.current.getBoundingClientRect();
      const cr = e.currentTarget.getBoundingClientRect();
      const ox = cr.left + cr.width  / 2 - gr.left;
      const oy = cr.top  + cr.height / 2 - gr.top;
      setZoom({ phase: "in", ox, oy });
      setTimeout(() => {
        setSelectedDate(dateStr);
        setZoom(prev => ({ ...prev, phase: "open" }));
      }, 340);
    } else {
      setSelectedDate(dateStr);
    }
  }

  function zoomOut() {
    setZoom(prev => ({ ...prev, phase: "out" }));
    setTimeout(() => setZoom({ phase: "idle", ox: 0, oy: 0 }), 560);
  }
  function handleSaved() { setSelectedDate(null); onRecordChange?.(); zoomOut(); }
  function handleClose() { setSelectedDate(null); zoomOut(); }

  const zoomed = zoom.phase === "in" || zoom.phase === "open";
  const gridZoomStyle = {
    transformOrigin: `${zoom.ox}px ${zoom.oy}px`,
    transform: zoomed ? "scale(2.5)" : "scale(1)",
    transition: zoom.phase === "idle" ? "none" : "transform 0.52s cubic-bezier(0.34, 1.56, 0.64, 1)",
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `${LABEL_W}px repeat(12, ${cellPx}px)`,
    gap: `${gapPx}px`,
  };

  // ── Construir filas ────────────────────────────────────────────────────────
  const rows = [];

  // Cabecera: hueco + iniciales de mes
  rows.push(<div key="corner" style={{ width: LABEL_W }} />);
  MONTH_INITIALS.forEach((initial, mi) => {
    rows.push(
      <div
        key={`mh-${mi}`}
        className="text-center text-neutral-600 select-none"
        style={{ lineHeight: `${cellPx}px`, fontSize }}
      >
        {initial}
      </div>
    );
  });

  // Días 1–31
  for (let day = 1; day <= 31; day++) {
    rows.push(
      <div
        key={`dl-${day}`}
        className="text-right text-neutral-700 select-none pr-px"
        style={{ lineHeight: `${cellPx}px`, width: LABEL_W, fontSize }}
      >
        {day}
      </div>
    );

    for (let month = 1; month <= 12; month++) {
      const valid   = day <= daysInMonth(year, month);
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isToday = dateStr === today;

      if (!valid) {
        rows.push(
          <div
            key={`${month}-${day}`}
            className="rounded-sm bg-neutral-900/50"
            style={{ width: cellPx, height: cellPx }}
          />
        );
        continue;
      }

      const record = recordMap[dateStr];
      rows.push(
        <button
          key={`${month}-${day}`}
          onClick={(e) => handleCellClick(dateStr, e)}
          className={[cellClasses(record, dateStr, today), isToday ? "ring-1 ring-white/30" : ""].join(" ")}
          style={{ width: cellPx, height: cellPx }}
          aria-label={dateStr}
          title={dateStr}
        />
      );
    }
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      {/* Año — solo el número, centrado, sin "registro" */}
      <div className="mb-3 select-none">
        <span className="text-neutral-600 font-mono text-sm tracking-[0.3em]">{year}</span>
      </div>

      {/* Grid — zoom sobre el contenedor; overflow-hidden en wrapper para clipear */}
      <div style={zoomed ? { overflow: "hidden" } : {}}>
        <div ref={gridRef} style={gridZoomStyle}>
          <div style={gridStyle}>{rows}</div>
        </div>
      </div>

      {/* Modal — fuera del elemento transformado, position:fixed no se rompe */}
      {selectedDate && (
        <EditModal
          date={selectedDate}
          record={recordMap[selectedDate]}
          onSave={handleSaved}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
