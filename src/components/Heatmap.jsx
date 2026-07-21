import { useEffect, useRef, useState } from "react";
import { getActiveRecord, getRecordsByYear } from "../db/index.js";
import EditModal from "./EditModal.jsx";

const MONTH_INITIALS = ["E","F","M","A","M","J","J","A","S","O","N","D"];
const LABEL_W  = 18;
const YEAR_HDR = 56;

function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }

function toLocalStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayStr() { return toLocalStr(new Date()); }

function cellClasses(record, dateStr, today) {
  if (dateStr > today)              return "bg-neutral-900/40 cursor-default";
  if (!record)                      return "bg-neutral-800 hover:bg-neutral-700 cursor-pointer";
  if (record.status === "vacation") return "bg-violet-700 hover:bg-violet-600 cursor-pointer";
  if (record.status === "rest")     return "bg-amber-500 hover:bg-amber-400 cursor-pointer";
  if (record.status === "zero")     return "bg-red-600 hover:bg-red-500 cursor-pointer";
  if (!record.closedAt && dateStr === today)
    return "bg-green-900/60 ring-1 ring-green-600/50 animate-pulse cursor-pointer";
  const h = record.hours ?? 0;
  if (h >= 5) return "bg-green-400 hover:bg-green-300 cursor-pointer";
  if (h >= 3) return "bg-green-600 hover:bg-green-500 cursor-pointer";
  if (h >= 1) return "bg-green-900 hover:bg-green-800 cursor-pointer";
  return "bg-neutral-800 hover:bg-neutral-700 cursor-pointer";
}

// Color de fondo de la celda para usar como color inicial del portal de entrada
function getCellColor(record, dateStr, today) {
  if (!record || dateStr > today) return "#262626"; // neutral-800
  if (record.status === "vacation") return "#6d28d9";
  if (record.status === "rest")     return "#f59e0b";
  if (record.status === "zero")     return "#dc2626";
  if (!record.closedAt && dateStr === today) return "#14532d";
  const h = record.hours ?? 0;
  if (h >= 5) return "#4ade80";
  if (h >= 3) return "#16a34a";
  if (h >= 1) return "#14532d";
  return "#262626";
}

function computeCell() {
  if (typeof window === "undefined") return { cell: 18, gap: 2 };
  const availW = window.innerWidth  - 16;
  const availH = window.innerHeight - 80 - 8;
  for (let c = 28; c >= 8; c--) {
    const g = Math.max(1, Math.round(c * 0.12));
    const w = LABEL_W + 12 * c + 11 * g;
    const h = 32 * c + 31 * g;
    if (w <= availW && h <= availH) return { cell: c, gap: g };
  }
  return { cell: 8, gap: 1 };
}

// Resetea el zoom nativo del viewport de iOS a 1× al cerrar el modal
function resetViewportZoom() {
  const meta = document.querySelector("meta[name=viewport]");
  if (!meta) return;
  const orig = meta.content;
  meta.content = orig + ", maximum-scale=1.0";
  requestAnimationFrame(() => { meta.content = orig; });
}

export default function Heatmap({ year = new Date().getFullYear(), refreshKey, onRecordChange }) {
  const [recordMap,    setRecordMap]    = useState({});
  const [selectedDate, setSelectedDate] = useState(null);

  // Fases del portal de entrada: idle → in-init → in → open → out → idle
  const [flyPhase,    setFlyPhase]    = useState("idle");
  const [flyCellRect, setFlyCellRect] = useState(null);
  const [flyCellColor, setFlyCellColor] = useState("#262626");
  const [flyExpanded, setFlyExpanded] = useState(false);

  const [dims,       setDims]       = useState(() => computeCell());
  const scrollRef  = useRef(null);
  const flyTimerRef = useRef(null);
  const today = todayStr();

  const cellPx   = dims.cell;
  const gapPx    = dims.gap;
  const fontSize  = Math.max(7, Math.min(10, Math.floor(cellPx * 0.52)));
  const radius    = Math.max(1, Math.round(cellPx * 0.1));
  const isFlying  = flyPhase !== "idle";

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = YEAR_HDR;
  }, []);

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

  // Dispara la expansión del clip-path después de que se pinte el estado inicial (celda pequeña)
  useEffect(() => {
    if (flyPhase !== "in-init") return;
    let raf1, raf2;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setFlyExpanded(true);
        setFlyPhase("in");
        flyTimerRef.current = setTimeout(() => setFlyPhase("open"), 520);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [flyPhase]);

  function handleCellClick(dateStr, e) {
    if (dateStr > today || flyPhase !== "idle") return;
    const rect  = e.currentTarget.getBoundingClientRect();
    const color = getCellColor(recordMap[dateStr], dateStr, today);
    setSelectedDate(dateStr);
    setFlyCellRect(rect);
    setFlyCellColor(color);
    setFlyExpanded(false);
    setFlyPhase("in-init");
  }

  function flyOut() {
    clearTimeout(flyTimerRef.current);
    setFlyPhase("out");
    setFlyExpanded(false);
    flyTimerRef.current = setTimeout(() => {
      setFlyPhase("idle");
      setFlyCellRect(null);
      setSelectedDate(null);
      resetViewportZoom();
      if (scrollRef.current) scrollRef.current.scrollTop = YEAR_HDR;
    }, 520);
  }

  function handleSaved() { onRecordChange?.(); flyOut(); }
  function handleClose() { flyOut(); }

  // Calcula el clip-path según si el portal está expandido o no
  const clipPath = (() => {
    if (flyExpanded) return "inset(0px round 0px)";
    if (!flyCellRect) return "inset(0px)";
    const { top, right, bottom, left } = flyCellRect;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const t = Math.max(0, top);
    const r = Math.max(0, vw - right);
    const b = Math.max(0, vh - bottom);
    const l = Math.max(0, left);
    return `inset(${t}px ${r}px ${b}px ${l}px round ${radius}px)`;
  })();

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `${LABEL_W}px repeat(12, ${cellPx}px)`,
    gap: `${gapPx}px`,
  };

  // ── Construir filas ───────────────────────────────────────────────────────
  const rows = [];

  rows.push(<div key="corner" style={{ width: LABEL_W }} />);
  MONTH_INITIALS.forEach((initial, mi) => (
    rows.push(
      <div
        key={`mh-${mi}`}
        className="text-center text-neutral-600 select-none"
        style={{ lineHeight: `${cellPx}px`, fontSize }}
      >
        {initial}
      </div>
    )
  ));

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
            className="bg-neutral-900/50"
            style={{ width: cellPx, height: cellPx, borderRadius: radius }}
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
          style={{ width: cellPx, height: cellPx, borderRadius: radius }}
          aria-label={dateStr}
          title={dateStr}
        />
      );
    }
  }

  return (
    <div className="w-full h-full">
      {/* Scroll container: pull-to-reveal año */}
      <div
        ref={scrollRef}
        className="wheel-scroll"
        style={{
          width: "100%",
          height: "100%",
          overflowY: isFlying ? "hidden" : "scroll",
          overflowX: "hidden",
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
        }}
      >
        {/* Sección del año (pull-to-reveal) */}
        <div
          style={{
            height: YEAR_HDR,
            scrollSnapAlign: "start",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: 14,
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <span
            className="select-none font-mono text-sm tracking-[0.35em]"
            style={{ color: "rgba(255,255,255,0.28)" }}
          >
            {year}
          </span>
        </div>

        {/* Sección de la grilla */}
        <div
          style={{
            minHeight: "100%",
            scrollSnapAlign: "start",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={gridStyle}>{rows}</div>
        </div>
      </div>

      {/*
        Portal de entrada: clip-path que empieza en la celda tocada y
        se expande hasta llenar la pantalla. El color de fondo va
        del color de la celda al negro del app mientras se expande.
      */}
      {isFlying && (
        <div
          className="fixed inset-0 z-40"
          style={{
            backgroundColor: flyExpanded ? "#0a0a0a" : flyCellColor,
            clipPath,
            transition: (flyPhase === "in" || flyPhase === "out")
              ? "clip-path 0.52s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.45s ease"
              : "none",
          }}
        />
      )}

      {/* Modal — aparece recién cuando el portal está completamente abierto */}
      {flyPhase === "open" && selectedDate && (
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
