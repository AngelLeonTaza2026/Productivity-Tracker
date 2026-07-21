import { useEffect, useRef, useState } from "react";
import { getActiveRecord, getRecordsByYear } from "../db/index.js";
import { THEMES } from "../themes.js";
import EditModal from "./EditModal.jsx";

const MONTH_INITIALS = ["E","F","M","A","M","J","J","A","S","O","N","D"];
const MONTH_SHORT    = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
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

// ── Tooltip del crosshair (bocadillo de cómic) ───────────────────────────
function CrosshairTooltip({ cx, cy, dateStr, isPast, cellRect, radius }) {
  const d     = new Date(`${dateStr}T00:00:00`);
  const label = `${d.getDate()} / ${MONTH_SHORT[d.getMonth()]}`;
  const TW    = 128;  // ancho del bocadillo
  const GAP   = 12;   // distancia entre el dedo y el borde del bocadillo

  // Preferencia: a la DERECHA del dedo; si no cabe, a la izquierda
  const goRight = cx + GAP + TW + 8 <= window.innerWidth;
  const bx      = goRight
    ? cx + GAP                                 // bocadillo a la derecha
    : Math.max(8, cx - GAP - TW);             // bocadillo a la izquierda

  // Preferencia: por ENCIMA del dedo; si no cabe, por debajo
  const BH     = 52;  // altura aprox. del bocadillo
  const TAIL_H = 12;
  const above  = cy > BH + TAIL_H + 16;
  const by     = above
    ? cy - BH - TAIL_H - 4   // encima
    : cy + TAIL_H + 4;       // debajo

  const bg     = isPast ? "rgba(8,14,28,0.97)" : "rgba(28,28,28,0.93)";
  const bcolor = isPast ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.05)";

  // La cola (triangular) sale de la esquina del bocadillo más cercana al dedo
  // Se posiciona de forma absoluta dentro del bocadillo wrapper
  //
  //  goRight + above → cola en la esquina inferior-izquierda del bocadillo
  //  goRight + below → cola en la esquina superior-izquierda
  // !goRight + above → cola en la esquina inferior-derecha
  // !goRight + below → cola en la esquina superior-derecha
  const tailStyle = (() => {
    const base = { position: "absolute", width: 0, height: 0 };
    if (above && goRight) {
      // cola abajo-izquierda → apunta al dedo que está abajo-izquierda
      return { ...base, bottom: -TAIL_H, left: 14,
        borderTop:  `${TAIL_H}px solid ${bg}`,
        borderLeft: `${TAIL_H}px solid transparent` };
    }
    if (above && !goRight) {
      // cola abajo-derecha
      return { ...base, bottom: -TAIL_H, right: 14,
        borderTop:   `${TAIL_H}px solid ${bg}`,
        borderRight: `${TAIL_H}px solid transparent` };
    }
    if (!above && goRight) {
      // cola arriba-izquierda → dedo está arriba-izquierda
      return { ...base, top: -TAIL_H, left: 14,
        borderBottom: `${TAIL_H}px solid ${bg}`,
        borderLeft:   `${TAIL_H}px solid transparent` };
    }
    // !above && !goRight → cola arriba-derecha
    return { ...base, top: -TAIL_H, right: 14,
      borderBottom: `${TAIL_H}px solid ${bg}`,
      borderRight:  `${TAIL_H}px solid transparent` };
  })();

  return (
    <>
      {/* Resalte de la celda */}
      {cellRect && (
        <div
          className="fixed pointer-events-none"
          style={{
            zIndex: 48,
            left: cellRect.left - 2,
            top:  cellRect.top  - 2,
            width:  cellRect.width  + 4,
            height: cellRect.height + 4,
            borderRadius: radius + 2,
            border: `2px solid ${isPast ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.22)"}`,
            boxShadow: isPast ? "0 0 10px rgba(255,255,255,0.32)" : "none",
          }}
        />
      )}

      {/* Bocadillo de cómic */}
      <div
        className="fixed pointer-events-none"
        style={{ zIndex: 49, left: bx, top: by, width: TW, position: "fixed" }}
      >
        <div style={{ position: "relative" }}>
          {/* Cola */}
          <div style={tailStyle} />

          {/* Cuerpo del bocadillo */}
          <div style={{
            backgroundColor: bg,
            border: `1px solid ${bcolor}`,
            borderRadius: 12,
            padding: "10px 14px",
            textAlign: "center",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
          }}>
            <span style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: "0.72rem",
              color: isPast ? "white" : "rgba(255,255,255,0.28)",
              whiteSpace: "nowrap",
            }}>
              {label}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Heatmap ───────────────────────────────────────────────────────────────
export default function Heatmap({
  year = new Date().getFullYear(),
  refreshKey,
  onRecordChange,
  theme = THEMES.default,
  onThemeToggle,
}) {
  const [recordMap,    setRecordMap]    = useState({});
  const [selectedDate, setSelectedDate] = useState(null);

  // Portal de entrada (fly-in)
  const [flyPhase,     setFlyPhase]    = useState("idle");
  const [flyCellRect,  setFlyCellRect] = useState(null);
  const [flyCellColor, setFlyCellColor] = useState("#262626");
  const [flyExpanded,  setFlyExpanded] = useState(false);

  // Crosshair (mantener presionado + arrastrar)
  const [crosshair, setCrosshair] = useState(null);
  // null | { x, y, info: { dateStr, rect, isPast } | null }

  const [dims, setDims] = useState(() => computeCell());

  const scrollRef    = useRef(null);
  const flyTimerRef  = useRef(null);

  // Refs para los handlers imperativos (capturan valores frescos)
  const todayRef       = useRef(todayStr());
  const flyPhaseRef    = useRef("idle");
  const recordMapRef   = useRef({});
  const themeRef       = useRef(theme);
  const isInCrosshair  = useRef(false);
  const longPressTimer = useRef(null);
  const touchStartPos  = useRef({ x: 0, y: 0 });
  const suppressClick  = useRef(false);

  // Mantener refs sincronizados
  const today = todayStr();
  useEffect(() => { todayRef.current    = today; });
  useEffect(() => { flyPhaseRef.current = flyPhase; }, [flyPhase]);
  useEffect(() => { recordMapRef.current = recordMap; }, [recordMap]);
  useEffect(() => { themeRef.current   = theme; }, [theme]);

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

  // Trigger de la expansión del portal
  useEffect(() => {
    if (flyPhase !== "in-init") return;
    let r1, r2;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        setFlyExpanded(true);
        setFlyPhase("in");
        flyTimerRef.current = setTimeout(() => setFlyPhase("open"), 520);
      });
    });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [flyPhase]);

  // ── Handlers imperativos para crosshair (touchmove/end no-pasivos) ────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Busca la celda bajo el punto tocado usando el data-date del botón
    function getCellAt(x, y) {
      const target = document.elementFromPoint(x, y);
      if (!target) return null;
      const btn = target.dataset?.date
        ? target
        : target.closest?.("button[data-date]");
      if (!btn) return null;
      const dateStr = btn.dataset.date;
      if (!dateStr) return null;
      const isPast = dateStr <= todayRef.current;
      return { dateStr, rect: btn.getBoundingClientRect(), isPast };
    }

    function openCell(info) {
      if (!info?.isPast || flyPhaseRef.current !== "idle") return;
      const rec   = recordMapRef.current[info.dateStr];
      const color = getCellBgColor(rec, info.dateStr, todayRef.current, themeRef.current);
      setSelectedDate(info.dateStr);
      setFlyCellRect(info.rect);
      setFlyCellColor(color);
      setFlyExpanded(false);
      setFlyPhase("in-init");
    }

    function onTouchStart(e) {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      touchStartPos.current = { x: t.clientX, y: t.clientY };
      clearTimeout(longPressTimer.current);
      longPressTimer.current = setTimeout(() => {
        isInCrosshair.current = true;
        navigator.vibrate?.(15); // solo funciona en Android
        const info = getCellAt(t.clientX, t.clientY);
        setCrosshair({ x: t.clientX, y: t.clientY, info });
      }, 350);
    }

    function onTouchMove(e) {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (!isInCrosshair.current) {
        // Cancelar longpress si el dedo se movió antes de los 350ms
        const dx = t.clientX - touchStartPos.current.x;
        const dy = t.clientY - touchStartPos.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > 10) clearTimeout(longPressTimer.current);
        return;
      }
      e.preventDefault(); // Bloquea scroll mientras está en modo crosshair
      const info = getCellAt(t.clientX, t.clientY);
      setCrosshair({ x: t.clientX, y: t.clientY, info });
    }

    function onTouchEnd(e) {
      clearTimeout(longPressTimer.current);
      if (!isInCrosshair.current) return;
      isInCrosshair.current = false;
      e.preventDefault(); // Suprime el click sintético
      const t    = e.changedTouches[0];
      const info = getCellAt(t.clientX, t.clientY);
      setCrosshair(null);
      // Suprimir el onClick que React dispara tras el touchend
      suppressClick.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        suppressClick.current = false;
      }));
      openCell(info);
    }

    function onTouchCancel() {
      clearTimeout(longPressTimer.current);
      isInCrosshair.current = false;
      setCrosshair(null);
    }

    const opts = { passive: false };
    el.addEventListener("touchstart",  onTouchStart,  opts);
    el.addEventListener("touchmove",   onTouchMove,   opts);
    el.addEventListener("touchend",    onTouchEnd,    opts);
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart",  onTouchStart);
      el.removeEventListener("touchmove",   onTouchMove);
      el.removeEventListener("touchend",    onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
  }, []); // handlers estables gracias a refs

  // ── Interacción tap normal ────────────────────────────────────────────
  function handleCellClick(dateStr, e) {
    if (suppressClick.current) return;
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
    const vw = window.innerWidth, vh = window.innerHeight;
    return `inset(${Math.max(0,top)}px ${Math.max(0,vw-right)}px ${Math.max(0,vh-bottom)}px ${Math.max(0,left)}px round ${radius}px)`;
  })();

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `${LABEL_W}px repeat(12, ${cellPx}px)`,
    gap: `${gapPx}px`,
  };

  // ── Filas de la grilla ────────────────────────────────────────────────
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
      const valid    = day <= daysInMonth(year, month);
      const dateStr  = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      const isFuture = dateStr > today;
      const isToday  = dateStr === today;

      if (!valid) {
        rows.push(
          <div
            key={`${month}-${day}`}
            style={{ width: cellPx, height: cellPx, borderRadius: radius, backgroundColor: theme.cells.future }}
          />
        );
        continue;
      }

      const record  = recordMap[dateStr];
      const bgColor = getCellBgColor(record, dateStr, today, theme);
      const isPulse = !record?.closedAt && isToday;

      rows.push(
        <button
          key={`${month}-${day}`}
          data-date={dateStr}
          onClick={(e) => handleCellClick(dateStr, e)}
          className={[
            "transition-opacity",
            isFuture ? "cursor-default" : "cursor-pointer active:opacity-60",
            isPulse ? "animate-pulse" : "",
            isToday && !isFuture ? "ring-1 ring-white/20" : "",
          ].join(" ")}
          style={{ width: cellPx, height: cellPx, borderRadius: radius, backgroundColor: bgColor }}
          aria-label={dateStr}
          title={dateStr}
        />
      );
    }
  }

  // ── Paneles laterales ─────────────────────────────────────────────────
  const SideLeft = theme.id === "bear" ? (
    <div
      className="absolute select-none pointer-events-none"
      style={{
        left: 6, top: "50%",
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
        right: 6, top: "50%",
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
      {/* Scroll container — pull-to-reveal año + snap */}
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

      {/* Portal de entrada (clip-path desde celda hasta full-screen) */}
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

      {/* Modal — aparece solo cuando el portal está completamente abierto */}
      {flyPhase === "open" && selectedDate && (
        <EditModal
          date={selectedDate}
          record={recordMap[selectedDate]}
          onSave={handleSaved}
          onClose={handleClose}
        />
      )}

      {/* Tooltip del crosshair — encima de todo excepto el modal */}
      {crosshair?.info && (
        <CrosshairTooltip
          cx={crosshair.x}
          cy={crosshair.y}
          dateStr={crosshair.info.dateStr}
          isPast={crosshair.info.isPast}
          cellRect={crosshair.info.rect}
          radius={radius}
        />
      )}
    </div>
  );
}
