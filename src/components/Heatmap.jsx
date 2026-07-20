import { useEffect, useRef, useState } from "react";
import { getActiveRecord, getRecordsByYear } from "../db/index.js";
import EditModal from "./EditModal.jsx";

// ── Constantes de layout ───────────────────────────────────────────────────
const CELL = 24; // px — tamaño de cada casilla
const GAP  = 3;  // px — espacio entre casillas

const MONTH_INITIALS = ["E","F","M","A","M","J","J","A","S","O","N","D"];

// ── Helpers ────────────────────────────────────────────────────────────────

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate(); // month es 1-based
}

function toLocalStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayStr() {
  return toLocalStr(new Date());
}

// ── Color de cada casilla ──────────────────────────────────────────────────

function cellClasses(record, dateStr, today) {
  const rounded = "rounded-sm";

  if (dateStr > today)
    return `${rounded} bg-neutral-900/40 cursor-default`;

  if (!record)
    return `${rounded} bg-neutral-800 hover:bg-neutral-700 cursor-pointer`;

  // Status siempre gana — el color nunca depende solo de closedAt
  if (record.status === "vacation")
    return `${rounded} bg-violet-700 hover:bg-violet-600 cursor-pointer`;

  if (record.status === "rest")
    return `${rounded} bg-amber-500 hover:bg-amber-400 cursor-pointer`;

  if (record.status === "zero")
    return `${rounded} bg-red-600 hover:bg-red-500 cursor-pointer`;

  // Pulsante solo si es HOY y está activo — nunca en días pasados
  if (!record.closedAt && dateStr === today)
    return `${rounded} bg-green-900/60 ring-1 ring-green-600/50 animate-pulse cursor-pointer`;

  // Productive cerrado — tres saltos de color bien diferenciados
  const h = record.hours ?? 0;
  if (h >= 5) return `${rounded} bg-green-400 hover:bg-green-300 cursor-pointer`; // brillante
  if (h >= 3) return `${rounded} bg-green-600 hover:bg-green-500 cursor-pointer`; // medio
  if (h >= 1) return `${rounded} bg-green-900 hover:bg-green-800 cursor-pointer`; // oscuro

  return `${rounded} bg-neutral-800 hover:bg-neutral-700 cursor-pointer`;
}

// ── Componente ─────────────────────────────────────────────────────────────

export default function Heatmap({ year = new Date().getFullYear(), refreshKey, onRecordChange }) {
  const [recordMap, setRecordMap]   = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [zoom, setZoom] = useState({ phase: "idle", ox: 0, oy: 0 });
  const gridRef = useRef(null);
  const today = todayStr();

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

  function handleSaved() {
    setSelectedDate(null);
    onRecordChange?.();
    zoomOut();
  }

  function handleClose() {
    setSelectedDate(null);
    zoomOut();
  }

  // Zoom style — solo aplica al contenedor del grid, no al modal
  const zoomed = zoom.phase === "in" || zoom.phase === "open";
  const gridZoomStyle = {
    transformOrigin: `${zoom.ox}px ${zoom.oy}px`,
    transform: zoomed ? "scale(2.5)" : "scale(1)",
    transition: zoom.phase === "idle" ? "none" : "transform 0.52s cubic-bezier(0.34, 1.56, 0.64, 1)",
  };

  // Ancho de la columna de números de día
  const labelColW = 18;

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `${labelColW}px repeat(12, ${CELL}px)`,
    gap: `${GAP}px`,
  };

  // Construye las filas: [label, ...12 celdas]
  const rows = [];

  // Fila de encabezado: esquina vacía + iniciales de mes
  rows.push(
    <div key="corner" style={{ width: labelColW }} />,
    ...MONTH_INITIALS.map((initial, mi) => (
      <div
        key={`mh-${mi}`}
        className="text-center text-[10px] text-neutral-600 select-none"
        style={{ lineHeight: `${CELL}px` }}
      >
        {initial}
      </div>
    ))
  );

  // Filas de días 1–31
  for (let day = 1; day <= 31; day++) {
    // Número del día
    rows.push(
      <div
        key={`dl-${day}`}
        className="text-right text-[10px] text-neutral-700 select-none pr-0.5"
        style={{ lineHeight: `${CELL}px`, width: labelColW }}
      >
        {day}
      </div>
    );

    // 12 celdas (una por mes)
    for (let month = 1; month <= 12; month++) {
      const valid = day <= daysInMonth(year, month);
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isToday = dateStr === today;

      if (!valid) {
        // Día inexistente en este mes — relleno discreto
        rows.push(
          <div
            key={`${month}-${day}`}
            className="rounded-sm bg-neutral-900/50"
            style={{ width: CELL, height: CELL }}
          />
        );
        continue;
      }

      const record = recordMap[dateStr];

      rows.push(
        <button
          key={`${month}-${day}`}
          onClick={(e) => handleCellClick(dateStr, e)}
          className={[
            cellClasses(record, dateStr, today),
            isToday ? "ring-1 ring-white/30" : "",
          ].join(" ")}
          style={{ width: CELL, height: CELL }}
          aria-label={dateStr}
          title={dateStr}
        />
      );
    }
  }

  return (
    <div className="w-full">
      {/* Encabezado — año discreto */}
      <div className="flex items-baseline gap-2 mb-4 ml-[21px]">
        <span className="text-xs text-neutral-600 tracking-widest uppercase">registro</span>
        <span className="text-neutral-700 text-sm font-mono">{year}</span>
      </div>

      {/* Grid — este div recibe el zoom; overflow-hidden en wrapper para clipear */}
      <div style={zoomed ? { overflow: "hidden" } : {}}>
        <div ref={gridRef} className="overflow-x-auto pb-2" style={gridZoomStyle}>
          <div style={gridStyle}>{rows}</div>
        </div>
      </div>

      {/* Leyenda — fuera del zoom */}
      <div className="flex items-center gap-2 mt-4 ml-[21px] flex-wrap">
        <span className="text-[10px] text-neutral-700">menos</span>
        {["bg-green-900","bg-green-600","bg-green-400"].map((c) => (
          <div key={c} className={`rounded-sm ${c}`} style={{ width: CELL * 0.7, height: CELL * 0.7 }} />
        ))}
        <span className="text-[10px] text-neutral-700">más</span>
        <div className="rounded-sm bg-red-600 ml-2" style={{ width: CELL * 0.7, height: CELL * 0.7 }} />
        <span className="text-[10px] text-neutral-700">0</span>
        <div className="rounded-sm bg-amber-500 ml-2" style={{ width: CELL * 0.7, height: CELL * 0.7 }} />
        <span className="text-[10px] text-neutral-700">descanso</span>
        <div className="rounded-sm bg-violet-700 ml-2" style={{ width: CELL * 0.7, height: CELL * 0.7 }} />
        <span className="text-[10px] text-neutral-700">vacaciones</span>
      </div>

      {/* Modal — fuera del div transformado, position:fixed no se rompe */}
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
