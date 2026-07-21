import { useEffect, useRef, useState } from "react";
import { getActiveRecord, getRecordsByYear } from "../db/index.js";
import { THEMES } from "../themes.js";
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

function getCellBgColor(record, dateStr, today, t) {
  const c = t.cells;
  if (dateStr > today)              return c.future;
  if (!record)                      return c.empty;
  if (record.status === "vacation") return c.vacation;
  if (record.status === "rest")     return c.rest;
  if (record.status === "zero")     return c.zero;
  if (!record.closedAt && dateStr === today) return c.todayActive;
  const h = record.hours ?? 0;
  if (h >= 5) return c.h5;
  if (h >= 3) return c.h3;
  if (h >= 1) return c.h1;
  return c.empty;
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

function resetViewportZoom() {
  const meta = document.querySelector("meta[name=viewport]");
  if (!meta) return;
  const orig = meta.content;
  meta.content = orig + ", maximum-scale=1.0";
  requestAnimationFrame(() => { meta.content = orig; });
}

export default function Heatmap({
  year = new Date().getFullYear(),
  refreshKey,
  onRecordChange,
  theme = THEMES.default,
  onThemeToggle,
}) {
  const [recordMap,    setRecordMap]    = useState({});
  const [selectedDate, setSelectedDate] = useState(null);

  const [flyPhase,     setFlyPhase]     = useState("idle");
  const [flyCellRect,  setFlyCellRect]  = useState(null);
  const [flyCellColor, setFlyCellColor] = useState("#262626");
  const [flyExpanded,  setFlyExpanded]  = useState(false);

  const [dims, setDims] = useState(() => computeCell());
  const scrollRef   = useRef(null);
  const flyTimerRef = useRef(null);
  const today = todayStr();

  const cellPx  = dims.cell;
  const gapPx   = dims.gap;
  const fontSize = Math.max(7, Math.min(10, Math.floor(cellPx * 0.52)));
  const radius   = Math.max(1, Math.round(cellPx * 0.1));
  const isFlying = flyPhase !== "idle";

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
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [flyPhase]);

  function handleCellClick(dateStr, e) {
    if (dateStr > today || flyPhase !== "idle") return;
    const rect  = e.currentTarget.getBoundingClientRect();
    const color = getCellBgColor(recordMap[dateStr], dateStr, today, theme);
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

  const clipPath = (() => {
    if (flyExpanded) return "inset(0px round 0px)";
    if (!flyCellRect) return "inset(0px)";
    const { top, right, bottom, left } = flyCellRect;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return `inset(${Math.max(0,top)}px ${Math.max(0,vw-right)}px ${Math.max(0,vh-bottom)}px ${Math.max(0,left)}px round ${radius}px)`;
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
        className="text-center select-none"
        style={{ lineHeight: `${cellPx}px`, fontSize, color: theme.labelColor }}
      >
        {initial}
      </div>
    )
  ));

  for (let day = 1; day <= 31; day++) {
    rows.push(
      <div
        key={`dl-${day}`}
        className="text-right select-none pr-px"
        style={{ lineHeight: `${cellPx}px`, width: LABEL_W, fontSize, color: theme.labelColor }}
      >
        {day}
      </div>
    );

    for (let month = 1; month <= 12; month++) {
      const valid   = day <= daysInMonth(year, month);
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isToday = dateStr === today;
      const isFuture = dateStr > today;

      if (!valid) {
        rows.push(
          <div
            key={`${month}-${day}`}
            style={{ width: cellPx, height: cellPx, borderRadius: radius, backgroundColor: theme.cells.future }}
          />
        );
        continue;
      }

      const record = recordMap[dateStr];
      const bgColor = getCellBgColor(record, dateStr, today, theme);
      const isActivePulse = !record?.closedAt && isToday;

      rows.push(
        <button
          key={`${month}-${day}`}
          onClick={(e) => handleCellClick(dateStr, e)}
          className={[
            "transition-opacity",
            isFuture ? "cursor-default" : "cursor-pointer active:opacity-60",
            isActivePulse ? "animate-pulse" : "",
            isToday && !isFuture ? "ring-1 ring-white/20" : "",
          ].join(" ")}
          style={{ width: cellPx, height: cellPx, borderRadius: radius, backgroundColor: bgColor }}
          aria-label={dateStr}
          title={dateStr}
        />
      );
    }
  }

  // ── Panel lateral: decoración según tema ─────────────────────────────────
  const SideLeft = theme.id === "bear" ? (
    <div
      className="absolute select-none pointer-events-none"
      style={{
        left: 6,
        top: "50%",
        transform: "translateY(-50%) rotate(180deg)",
        writingMode: "vertical-rl",
        textOrientation: "mixed",
      }}
    >
      <span style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: "0.24rem",
        letterSpacing: "0.35em",
        color: "rgba(96,165,250,0.18)",
      }}>
        EVERY SECOND COUNTS
      </span>
    </div>
  ) : null;

  const SideRight = (
    <button
      onClick={onThemeToggle}
      className="absolute select-none"
      style={{
        right: 6,
        top: "50%",
        transform: "translateY(-50%)",
        writingMode: "vertical-rl",
        textOrientation: "mixed",
        padding: "10px 3px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
      }}
      aria-label={`Cambiar a tema ${theme.label}`}
    >
      <span style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: "0.24rem",
        letterSpacing: "0.3em",
        color: theme.toggleColor,
      }}>
        {theme.label}
      </span>
    </button>
  );

  return (
    <div className="w-full h-full">
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
          backgroundColor: theme.bg,
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
            borderBottom: `1px solid ${theme.dividerColor}`,
          }}
        >
          <span
            className="select-none font-mono text-sm tracking-[0.35em]"
            style={{ color: theme.yearColor }}
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
            position: "relative",
          }}
        >
          {SideLeft}
          <div style={gridStyle}>{rows}</div>
          {SideRight}
        </div>
      </div>

      {/* Portal de entrada: clip-path desde la celda hasta full-screen */}
      {isFlying && (
        <div
          className="fixed inset-0 z-40"
          style={{
            backgroundColor: flyExpanded ? theme.bg : flyCellColor,
            clipPath,
            transition: (flyPhase === "in" || flyPhase === "out")
              ? "clip-path 0.52s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.4s ease"
              : "none",
          }}
        />
      )}

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
