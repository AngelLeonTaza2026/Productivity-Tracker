import { useEffect, useMemo, useState } from "react";
import { getActiveRecord, getRecordsByYear } from "../db/index.js";
import EditModal from "./EditModal.jsx";

// ── Helpers de fecha (local, evita desfase UTC) ────────────────────────────

function toLocalStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayStr() {
  return toLocalStr(new Date());
}

/** Genera array de semanas; cada semana = 7 strings "YYYY-MM-DD" (Dom→Sáb) */
function buildWeeks(year) {
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);

  const start = new Date(jan1);
  start.setDate(jan1.getDate() - jan1.getDay()); // Domingo anterior a Jan 1

  const end = new Date(dec31);
  end.setDate(dec31.getDate() + (6 - dec31.getDay())); // Sábado posterior a Dec 31

  const weeks = [];
  const cur = new Date(start);
  while (cur <= end) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(toLocalStr(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** Para cada semana: label del mes si esa semana contiene un día 1, o null */
function buildMonthLabels(weeks) {
  const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return weeks.map((week) => {
    for (const d of week) {
      if (d.slice(8) === "01") return MESES[parseInt(d.slice(5, 7)) - 1];
    }
    return null;
  });
}

// ── Color por intensidad ───────────────────────────────────────────────────

function cellClasses(record, dateStr, today) {
  const isFuture = dateStr > today;
  const base = "rounded-sm transition-opacity";

  if (isFuture) return `${base} bg-neutral-900 opacity-30 cursor-default`;
  if (!record)  return `${base} bg-neutral-800 hover:bg-neutral-700 cursor-pointer`;

  // Día abierto (sin closedAt) — indica que está en curso
  if (!record.closedAt) return `${base} bg-green-900/60 ring-1 ring-green-600/50 animate-pulse cursor-pointer`;

  if (record.status === "vacation")
    return `${base} bg-violet-700 hover:bg-violet-600 cursor-pointer`;

  if (record.status === "zero")
    return `${base} bg-red-600 hover:bg-red-500 cursor-pointer`;

  // productive
  const h = record.hours ?? 0;
  if (h >= 5) return `${base} bg-green-500 hover:bg-green-400 cursor-pointer`;
  if (h >= 3) return `${base} bg-green-700 hover:bg-green-600 cursor-pointer`;
  if (h >= 1) return `${base} bg-green-900 hover:bg-green-800 cursor-pointer`;
  return `${base} bg-neutral-800 hover:bg-neutral-700 cursor-pointer`;
}

// ── Componente ─────────────────────────────────────────────────────────────

export default function Heatmap({ year = new Date().getFullYear(), refreshKey, onRecordChange }) {
  const [recordMap, setRecordMap] = useState({});
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
      // Incluye el día abierto aunque no tenga closedAt
      if (active && active.date.startsWith(String(year))) {
        map[active.date] = active;
      }
      setRecordMap(map);
    }
    load();
  }, [year, refreshKey]);

  const weeks = useMemo(() => buildWeeks(year), [year]);
  const monthLabels = useMemo(() => buildMonthLabels(weeks), [weeks]);

  function handleCellClick(dateStr) {
    if (dateStr > today) return;
    setSelectedDate(dateStr);
  }

  function handleSaved() {
    setSelectedDate(null);
    onRecordChange?.();
  }

  // Días de semana (Dom → Sáb) para el eje Y
  const DOW = ["D","L","M","X","J","V","S"];

  return (
    <div className="w-full">
      <h2 className="text-xs text-neutral-500 tracking-widest uppercase mb-3">{year}</h2>

      <div className="flex gap-1">
        {/* Eje Y — días de semana */}
        <div className="flex flex-col gap-0.5 mr-0.5 mt-5">
          {DOW.map((d) => (
            <div
              key={d}
              className="h-[13px] text-[9px] text-neutral-700 leading-[13px] select-none"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grid de semanas */}
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {/* Label de mes */}
                <div className="h-4 text-[9px] text-neutral-600 leading-4 select-none whitespace-nowrap">
                  {monthLabels[wi] ?? ""}
                </div>

                {/* 7 celdas */}
                {week.map((dateStr) => {
                  const isThisYear = dateStr.startsWith(String(year));
                  if (!isThisYear) {
                    return (
                      <div key={dateStr} className="w-[13px] h-[13px] rounded-sm bg-transparent" />
                    );
                  }
                  const record = recordMap[dateStr];
                  const isToday = dateStr === today;
                  return (
                    <button
                      key={dateStr}
                      onClick={() => handleCellClick(dateStr)}
                      className={[
                        "w-[13px] h-[13px]",
                        cellClasses(record, dateStr, today),
                        isToday ? "ring-1 ring-white/40" : "",
                      ].join(" ")}
                      title={dateStr}
                      aria-label={dateStr}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-3 mt-3 ml-5">
        <span className="text-[10px] text-neutral-700">menos</span>
        {[
          "bg-neutral-800",
          "bg-green-900",
          "bg-green-700",
          "bg-green-500",
        ].map((c) => (
          <div key={c} className={`w-[13px] h-[13px] rounded-sm ${c}`} />
        ))}
        <span className="text-[10px] text-neutral-700">más</span>
        <div className="w-[13px] h-[13px] rounded-sm bg-red-600 ml-2" />
        <span className="text-[10px] text-neutral-700">0</span>
        <div className="w-[13px] h-[13px] rounded-sm bg-violet-700 ml-1" />
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
