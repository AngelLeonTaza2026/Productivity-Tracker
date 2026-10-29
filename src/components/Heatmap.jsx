import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { getActiveRecord, getRecordsByYear } from "../db/index.js";
import { THEMES } from "../themes.js";
import { getCellBgColor } from "../cellColor.js";
import { composeExportCanvas, preloadFrameFont } from "../frames.js";
import EditModal from "./EditModal.jsx";
import ExportPanel from "./ExportPanel.jsx";

const MONTH_INITIALS = ["E","F","M","A","M","J","J","A","S","O","N","D"];
const MONTH_SHORT    = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const LABEL_W  = 18;

function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function toLocalStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayStr() { return toLocalStr(new Date()); }

function computeCell() {
  if (typeof window === "undefined") return { cell: 18, gap: 2 };
  const availW = window.innerWidth  - 16;
  // -80 nav inferior, -8 margen, -32 etiqueta fija del año arriba
  const availH = window.innerHeight - 80 - 8 - 32;
  for (let c = 28; c >= 8; c--) {
    const g = Math.max(1, Math.round(c * 0.12));
    const w = LABEL_W + 12 * c + 11 * g;
    const h = 32 * c + 31 * g;
    if (w <= availW && h <= availH) return { cell: c, gap: g };
  }
  return { cell: 8, gap: 1 };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const EXPORT_SCALE   = 3;
const EXPORT_TITLE_H = 52; // banda del título, en px CSS antes de EXPORT_SCALE
const EXPORT_MARGIN  = 20; // margen a los 4 lados, en px CSS antes de EXPORT_SCALE

// Presentación 3D de la mesa — inclinación base de reposo (ambiente) más
// una inclinación dinámica que el usuario maneja arrastrando el dedo
// (teléfono) o moviendo el mouse (PC), como si la agarrara como una carta.
// Reemplaza el scroll que antes revelaba el año (ahora es una etiqueta fija)
// para no competir por el mismo gesto; mantener presionado para
// previsualizar un día sigue intacto, se dispara antes de que el arrastre
// se interprete como inclinación.
const TABLE_TILT_DEG = 9;
const TABLE_PERSPECTIVE = 1400;
const TILT_MAX  = 16;  // grados extra (sobre la base) que puede sumar el arrastre/mouse
const TILT_SENS = 0.15; // grados por pixel de arrastre (touch)

// Coreografía del aterrizaje (estilo "lista negra" de carreras): primero se
// ve la mesa entera, después la cámara se acerca a la celda, pinta, y vuelve.
const LAND_FADE_MS  = 500; // el color de pantalla completa se desvanece
const LAND_ZOOM_MS  = 650; // la cámara se acerca a la celda
const LAND_PAINT_MS = 550; // pausa + resalte sobre la celda
const LAND_OUT_MS   = 650; // vuelve a la vista de reposo

/**
 * Captura solo el grid (no los paneles laterales interactivos), le agrega
 * margen real en los 4 lados (antes el borde derecho/inferior de la imagen
 * quedaba pegado al final de la tabla) y compone el marco + título elegidos
 * aparte por canvas — así no hay que tocar el DOM en vivo para nada de esto.
 * `tableEl` es el contenedor con la inclinación 3D: se neutraliza un
 * instante para la captura, porque html-to-image no interpreta bien un
 * ancestro con transform 3D, y se restaura apenas termina.
 */
async function exportHeatmapAsImage(tableEl, gridEl, year, bgColor, frameId) {
  await document.fonts?.ready;
  await preloadFrameFont(frameId);

  const prevTransform = tableEl.style.transform;
  tableEl.style.transform = "none";

  const gridDataUrl = await toPng(gridEl, {
    backgroundColor: bgColor,
    pixelRatio: EXPORT_SCALE,
  }).finally(() => { tableEl.style.transform = prevTransform; });
  const gridImg = await loadImage(gridDataUrl);

  const margin = EXPORT_MARGIN * EXPORT_SCALE;
  const titleH = EXPORT_TITLE_H * EXPORT_SCALE;

  const canvas = await composeExportCanvas(frameId, {
    gridImg, year, bg: bgColor, scale: EXPORT_SCALE, margin, titleH,
  });

  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `productividad-${year}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function resetViewportZoom() {
  const meta = document.querySelector("meta[name=viewport]");
  if (!meta) return;
  const orig = meta.content;
  meta.content = orig + ", maximum-scale=1.0";
  requestAnimationFrame(() => { meta.content = orig; });
}

// ── Tooltip del crosshair (bocadillo de cómic con cola dinámica) ─────────
function CrosshairTooltip({ cx, cy, dateStr, isPast, cellRect, radius }) {
  const d     = new Date(`${dateStr}T00:00:00`);
  const label = `${d.getDate()} / ${MONTH_SHORT[d.getMonth()]}`;

  const TW     = 128;  // ancho del bocadillo
  const BH     = 42;   // altura aproximada del bocadillo
  const GAP    = 14;   // espacio entre el dedo y el bocadillo
  const TAIL_W = 8;    // semiancho de la base de la cola

  // Bocadillo: a la DERECHA del dedo si cabe, si no a la izquierda
  const goRight = cx + GAP + TW + 8 <= window.innerWidth;
  const bx = goRight ? cx + GAP : Math.max(8, cx - GAP - TW);

  // Bocadillo: ENCIMA del dedo si hay espacio, si no debajo
  const above = cy > BH + GAP + 20;
  const by    = above ? cy - BH - GAP : cy + GAP;

  const bg     = isPast ? "rgba(8,14,28,0.97)" : "rgba(28,28,28,0.93)";
  const bcolor = isPast ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.05)";

  // ── Cola SVG dinámica ──────────────────────────────────────────────────
  // La base de la cola va por el borde del bocadillo más cercano a la celda.
  // La punta de la cola apunta al centro de la celda resaltada.
  let tailPts = null;
  if (cellRect) {
    const cellCx = cellRect.left + cellRect.width  / 2;
    const cellCy = cellRect.top  + cellRect.height / 2;

    // Centro de la base sobre el borde del bocadillo que mira a la celda
    const baseX = Math.max(bx + TAIL_W + 4, Math.min(bx + TW - TAIL_W - 4, cellCx));
    const baseY = above ? by + BH : by; // borde inferior o superior del bocadillo

    // Punta de la cola: borde de la celda más cercano al bocadillo
    const tipX  = cellCx;
    const tipY  = above ? cellRect.top + 1 : cellRect.bottom - 1;

    tailPts = `${baseX - TAIL_W},${baseY} ${baseX + TAIL_W},${baseY} ${tipX},${tipY}`;
  }

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
            border: `2px solid ${isPast ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.22)"}`,
            boxShadow: isPast ? "0 0 10px rgba(255,255,255,0.3)" : "none",
          }}
        />
      )}

      {/* Cola SVG: triángulo con punta en la celda, base en el bocadillo */}
      {tailPts && (
        <svg
          className="fixed pointer-events-none"
          style={{ zIndex: 47, top: 0, left: 0, width: "100%", height: "100%" }}
        >
          <polygon points={tailPts} fill={bg} />
        </svg>
      )}

      {/* Cuerpo del bocadillo */}
      <div
        className="fixed pointer-events-none"
        style={{ zIndex: 49, left: bx, top: by, width: TW }}
      >
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
  landing,      // { date, color } | null — aterrizaje desde el ritual de cierre de día
  onLandingDone,
}) {
  const [recordMap,    setRecordMap]    = useState({});
  const [selectedDate, setSelectedDate] = useState(null);

  // Exportar como imagen
  const gridRef = useRef(null);
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  const [exporting,   setExporting]   = useState(false);
  const [exportError, setExportError] = useState(null);

  // Portal de entrada (fly-in) — edición de una celda pasada
  const [flyPhase,     setFlyPhase]    = useState("idle");
  const [flyCellRect,  setFlyCellRect] = useState(null);
  const [flyCellColor, setFlyCellColor] = useState("#262626");
  const [flyExpanded,  setFlyExpanded] = useState(false);

  // Aterrizaje desde el ritual de cierre de día — cámara que se acerca a
  // la celda sobre la mesa ya inclinada, en vez de un portal plano
  const [zoom, setZoom] = useState({ scale: 1, originX: 50, originY: 50 });
  const [landFade, setLandFade] = useState(false); // color de pantalla completa → transparente
  const [landRing, setLandRing] = useState(null);  // rect de la celda, solo durante "land-paint"

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
  const tiltDragging   = useRef(false); // arrastre rápido en curso (inclina en vez de hacer scroll)
  const zoomRef        = useRef(zoom);

  // Mantener refs sincronizados
  const today = todayStr();
  useEffect(() => { todayRef.current    = today; });
  useEffect(() => { flyPhaseRef.current = flyPhase; }, [flyPhase]);
  useEffect(() => { recordMapRef.current = recordMap; }, [recordMap]);
  useEffect(() => { themeRef.current   = theme; }, [theme]);
  useEffect(() => { zoomRef.current    = zoom; }, [zoom]);

  // Aplica la inclinación directo al DOM (sin pasar por setState/React) para
  // que seguir al dedo o al mouse no vuelva a dibujar las ~380 celdas en
  // cada pixel de movimiento — eso sí se sentiría trabado. Compone con el
  // zoom del aterrizaje leyendo su valor actual desde zoomRef.
  function applyTilt(rx, ry, withTransition) {
    const el = scrollRef.current;
    if (!el) return;
    const z = zoomRef.current;
    el.style.transition = withTransition ? "transform 450ms cubic-bezier(0.22, 1, 0.36, 1)" : "none";
    el.style.transform = `rotateX(${TABLE_TILT_DEG + rx}deg) rotateY(${ry}deg) scale(${z.scale})`;
    el.style.transformOrigin = `${z.originX}% ${z.originY}%`;
  }

  const cellPx  = dims.cell;
  const gapPx   = dims.gap;
  const fontSize = Math.max(7, Math.min(10, Math.floor(cellPx * 0.52)));
  const radius   = Math.max(1, Math.round(cellPx * 0.1));
  const isFlying = flyPhase !== "idle";
  const isLanding = flyPhase.startsWith("land-");

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

  // Trigger de la expansión del portal (entrando a editar una celda)
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

  // Aterrizaje desde el ritual de cierre de día — coreografía en 4 tiempos:
  // 1) se ve la mesa entera (el color de pantalla completa se desvanece)
  // 2) la cámara se acerca a la celda (zoom sobre la mesa ya inclinada)
  // 3) pausa + resalte sobre la celda (acá "se pinta" el día)
  // 4) vuelve a la vista de reposo
  useEffect(() => {
    if (!landing) return;
    setFlyCellColor(landing.color);
    setLandFade(true);
    setFlyPhase("land-wide");
    const raf1 = requestAnimationFrame(() => requestAnimationFrame(() => setLandFade(false)));
    flyTimerRef.current = setTimeout(() => startLandZoomIn(landing.date), LAND_FADE_MS);
    return () => { cancelAnimationFrame(raf1); clearTimeout(flyTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landing]);

  function startLandZoomIn(date) {
    const tableEl = scrollRef.current;
    const cellEl  = document.querySelector(`button[data-date="${date}"]`);
    if (!tableEl || !cellEl) { onLandingDone?.(); return; }

    const tableRect = tableEl.getBoundingClientRect();
    const cellRect   = cellEl.getBoundingClientRect();
    const originX = ((cellRect.left + cellRect.width / 2 - tableRect.left) / tableRect.width) * 100;
    const originY = ((cellRect.top + cellRect.height / 2 - tableRect.top) / tableRect.height) * 100;

    setZoom({ scale: 2.6, originX, originY });
    setFlyPhase("land-zoom-in");
    flyTimerRef.current = setTimeout(() => {
      setLandRing(cellEl.getBoundingClientRect());
      setFlyPhase("land-paint");
      flyTimerRef.current = setTimeout(() => {
        setLandRing(null);
        setZoom((z) => ({ ...z, scale: 1 }));
        setFlyPhase("land-zoom-out");
        flyTimerRef.current = setTimeout(() => {
          setFlyPhase("idle");
          setZoom({ scale: 1, originX: 50, originY: 50 });
          onLandingDone?.();
        }, LAND_OUT_MS);
      }, LAND_PAINT_MS);
    }, LAND_ZOOM_MS);
  }

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
      if (e.touches.length !== 1 || flyPhaseRef.current !== "idle") return;
      const t = e.touches[0];
      touchStartPos.current = { x: t.clientX, y: t.clientY };
      tiltDragging.current = false;
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

      if (isInCrosshair.current) {
        e.preventDefault(); // Bloquea el gesto de inclinar mientras está en modo crosshair
        const info = getCellAt(t.clientX, t.clientY);
        setCrosshair({ x: t.clientX, y: t.clientY, info });
        return;
      }

      const dx = t.clientX - touchStartPos.current.x;
      const dy = t.clientY - touchStartPos.current.y;

      // Un arrastre franco (antes de que se cumplan los 350ms) cancela el
      // modo crosshair y pasa a inclinar la mesa, no a hacer scroll (ya no
      // hay nada que scrollear: el año es una etiqueta fija).
      if (!tiltDragging.current) {
        if (Math.hypot(dx, dy) <= 10) return;
        clearTimeout(longPressTimer.current);
        tiltDragging.current = true;
      }

      e.preventDefault();
      applyTilt(
        clamp(-dy * TILT_SENS, -TILT_MAX, TILT_MAX),
        clamp( dx * TILT_SENS, -TILT_MAX, TILT_MAX),
        false
      );
    }

    function onTouchEnd(e) {
      clearTimeout(longPressTimer.current);

      if (isInCrosshair.current) {
        isInCrosshair.current = false;
        e.preventDefault(); // Suprime el click sintético
        const t    = e.changedTouches[0];
        const info = getCellAt(t.clientX, t.clientY);
        setCrosshair(null);
        suppressClick.current = true;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          suppressClick.current = false;
        }));
        openCell(info);
        return;
      }

      if (tiltDragging.current) {
        tiltDragging.current = false;
        applyTilt(0, 0, true); // vuelve sola a la inclinación de reposo
        // Fue un arrastre, no un tap: suprimir el click sintético que sigue
        suppressClick.current = true;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          suppressClick.current = false;
        }));
      }
    }

    function onTouchCancel() {
      clearTimeout(longPressTimer.current);
      isInCrosshair.current = false;
      tiltDragging.current = false;
      setCrosshair(null);
      applyTilt(0, 0, true);
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
    }, 520);
  }

  // Inclinación con mouse en PC — sigue el cursor como si sostuviera la
  // mesa, sin necesidad de arrastrar ni hacer clic. Directo al DOM por la
  // misma razón que el touch: mousemove dispara muy seguido.
  function handleMouseMove(e) {
    if (flyPhaseRef.current !== "idle") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    applyTilt(
      clamp(-py * TILT_MAX * 2, -TILT_MAX, TILT_MAX),
      clamp( px * TILT_MAX * 2, -TILT_MAX, TILT_MAX),
      false
    );
  }

  function handleMouseLeave() {
    applyTilt(0, 0, true);
  }

  function handleSaved() { onRecordChange?.(); flyOut(); }
  function handleClose() { flyOut(); }

  async function handleExport(frameId) {
    if (exporting || !gridRef.current || !scrollRef.current) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportHeatmapAsImage(scrollRef.current, gridRef.current, year, theme.bg, frameId);
      setExportPanelOpen(false);
    } catch (err) {
      console.error("Error exportando heatmap:", err);
      setExportError("No se pudo exportar la imagen");
    } finally {
      setExporting(false);
    }
  }

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

      const record     = recordMap[dateStr];
      const bgColor    = getCellBgColor(record, dateStr, today, theme);
      const isPulse    = !record?.closedAt && isToday;
      const isVacation = record?.status === "vacation";

      rows.push(
        <button
          key={`${month}-${day}`}
          data-date={dateStr}
          onClick={(e) => handleCellClick(dateStr, e)}
          className={[
            "transition-opacity flex items-center justify-center",
            isFuture ? "cursor-default" : "cursor-pointer active:opacity-60",
            isPulse ? "animate-pulse" : "",
            isToday && !isFuture ? "ring-1 ring-white/20" : "",
          ].join(" ")}
          style={{ width: cellPx, height: cellPx, borderRadius: radius, backgroundColor: bgColor }}
          aria-label={dateStr}
          title={dateStr}
        >
          {isVacation && (
            <span
              className="select-none pointer-events-none"
              style={{
                fontSize: Math.max(6, Math.round(cellPx * 0.5)),
                lineHeight: 1,
                fontWeight: 700,
                color: "rgba(255,255,255,0.85)",
              }}
            >
              V
            </span>
          )}
        </button>
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

  const isZooming = flyPhase === "land-zoom-in" || flyPhase === "land-zoom-out";
  // Transform/transition declarativos: solo reflejan el zoom del aterrizaje
  // (reposo = sin inclinación dinámica). El tilt interactivo se aplica
  // aparte, directo al DOM vía applyTilt() — ver más abajo.
  const restTransition = isZooming
    ? `transform ${flyPhase === "land-zoom-in" ? LAND_ZOOM_MS : LAND_OUT_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
    : "transform 450ms cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <div className="w-full h-full">
      {/*
        Envoltorio de perspectiva — SOLO para la mesa, nunca para los
        hermanos `fixed` (portal, modal, tooltip, botón exportar, año):
        tanto `perspective` como `transform` convierten a su elemento en el
        "contenedor" de los descendientes `fixed`, así que si envolviera todo
        el componente les movería la posición. Por eso este div solo tiene
        un hijo: la mesa.
      */}
      <div style={{ width: "100%", height: "100%", perspective: `${TABLE_PERSPECTIVE}px` }}>
        {/* La mesa — inclinación de reposo + la dinámica (arrastre/mouse) +
            el zoom del aterrizaje, todo en el mismo transform */}
        <div
          ref={scrollRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            width: "100%",
            height: "100%",
            touchAction: "none",
            backgroundColor: theme.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            transform: `rotateX(${TABLE_TILT_DEG}deg) scale(${zoom.scale})`,
            transformOrigin: `${zoom.originX}% ${zoom.originY}%`,
            transition: restTransition,
          }}
        >
          {SideLeft}
          <div ref={gridRef} style={gridStyle}>{rows}</div>
          {SideRight}
        </div>
      </div>

      {/* Año — etiqueta fija (ya no se revela haciendo scroll, ese gesto
          ahora inclina la mesa) */}
      {!isFlying && (
        <p
          className="fixed select-none text-center font-mono text-sm tracking-[0.35em] pointer-events-none"
          style={{ top: "max(14px, env(safe-area-inset-top))", left: 0, right: 0, color: theme.yearColor }}
        >
          {year}
        </p>
      )}

      {/* Portal de entrada/salida al editar una celda pasada (clip-path
          desde la celda hasta pantalla completa) — no interviene durante
          el aterrizaje, que usa su propia coreografía más abajo. */}
      {isFlying && !isLanding && (
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

      {/* Aterrizaje, tiempo 1: el color de pantalla completa se desvanece,
          revelando la mesa entera ya inclinada (no se "cae" sobre la celda
          todavía, eso es el tiempo 2). */}
      {flyPhase === "land-wide" && (
        <div
          className="fixed inset-0 z-40"
          style={{
            backgroundColor: flyCellColor,
            opacity: landFade ? 1 : 0,
            transition: `opacity ${LAND_FADE_MS}ms ease`,
          }}
        />
      )}

      {/* Aterrizaje, tiempo 3: resalte sobre la celda real mientras la
          cámara está acercada — acá "se pinta" el día. */}
      {flyPhase === "land-paint" && landRing && (
        <div
          className="fixed pointer-events-none z-40"
          style={{
            left: landRing.left - 3,
            top: landRing.top - 3,
            width: landRing.width + 6,
            height: landRing.height + 6,
            borderRadius: radius + 3,
            border: `2px solid ${flyCellColor}`,
            boxShadow: `0 0 14px ${flyCellColor}`,
            animation: `closing-ring ${LAND_PAINT_MS}ms ease-out forwards`,
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

      {/* Exportar vista anual como imagen */}
      {!isFlying && (
        <button
          onClick={() => setExportPanelOpen(true)}
          aria-label="Exportar como imagen"
          className="fixed select-none"
          style={{
            top: "max(14px, env(safe-area-inset-top))",
            right: 14,
            zIndex: 30,
            padding: 8,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: theme.toggleColor,
          }}
        >
          <DownloadIcon />
        </button>
      )}

      {exportPanelOpen && (
        <ExportPanel
          onCancel={() => { setExportPanelOpen(false); setExportError(null); }}
          onExport={handleExport}
          exporting={exporting}
          error={exportError}
        />
      )}
    </div>
  );
}
