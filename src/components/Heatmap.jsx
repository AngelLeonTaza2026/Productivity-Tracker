import { useEffect, useState } from "react";
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

  if (record.status === "zero")
    return `${rounded} bg-red-600 hover:bg-red-500 cursor-pointer`;

  // Productive sin cerrar → en curso (pulsante)
  if (!record.closedAt)
    return `${rounded} bg-green-900/60 ring-1 ring-green-600/50 animate-pulse cursor-pointer`;

  // Productive cerrado — escala por horas
  const h = record.hours ?? 0;
  if (h >= 5) return `${rounded} bg-green-500 hover:bg-green-400 cursor-pointer`;
  if (h >= 3) return `${rounded} bg-green-700 hover:bg-green-600 cursor-pointer`;
  if (h >= 1) return `${rounded} bg-green-900 hover:bg-green-800 cursor-pointer`;

  return `${rounded} bg-neutral-800 hover:bg-neutral-700 cursor-pointer`;
}

// ── Componente ─────────────────────────────────────────────────────────────

export default function Heatmap({ year = new Date().getFullYear(), refreshKey, onRecordChange }) {
  const [recordMap, setRecordMap]   = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
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

  function handleCellClick(dateStr) {
    if (dateStr > today) return;
    setSelectedDate(dateStr);
  }

  function handleSaved() {
    setSelectedDate(null);
    onRecordChange?.();
  }

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
          onClick={() => handleCellClick(dateStr)}
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

      {/* Grid */}
      <div className="overflow-x-auto pb-2">
        <div style={gridStyle}>{rows}</div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-2 mt-4 ml-[21px] flex-wrap">
        <span className="text-[10px] text-neutral-700">menos</span>
        {["bg-neutral-800","bg-green-900","bg-green-700","bg-green-500"].map((c) => (
          <div key={c} className={`rounded-sm ${c}`} style={{ width: CELL * 0.7, height: CELL * 0.7 }} />
        ))}
        <span className="text-[10px] text-neutral-700">más</span>
        <div className="rounded-sm bg-red-600 ml-2" style={{ width: CELL * 0.7, height: CELL * 0.7 }} />
        <span className="text-[10px] text-neutral-700">0</span>
        <div className="rounded-sm bg-violet-700 ml-1" style={{ width: CELL * 0.7, height: CELL * 0.7 }} />
        <span className="text-[10px] text-neutral-700">V</span>
      </div>

      {selectedDate && (
        <EditModal
          date={selectedDate}
          record={recordMap[selectedDate]}
          onSave={handleSaved}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}
