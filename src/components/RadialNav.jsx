import { useMemo, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion.js";

const LONG_PRESS_MS = 300;
const ANCHOR_SIZE = 44;          // blanco táctil fijo del botón (el tamaño visual idle es por scale)
const ITEM_SIZE = 44;
const STEP_DEG = 48;             // separación angular entre pestañas — fija, no depende del conteo
const RADIUS_MAX_RATIO = 0.55;   // tope de radio relativo al alto, por si el ancho es muy grande
const SPRING_MS = 420;
const SPRING_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const DRAG_MS = 60;              // suavizado mínimo mientras se arrastra, sin perder respuesta

// Marcas de minutero y dientes de engranaje del aro — decorativos, ángulos
// fijos e independientes de las pestañas (como las marcas de un reloj).
const TICK_ANGLES = Array.from({ length: 13 }, (_, i) => -108 + i * 18);
const TOOTH_ANGLES = Array.from({ length: 10 }, (_, i) => -99 + i * 22);

function AnchorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="18" r="1.7" />
      <circle cx="6" cy="13.5" r="1.7" />
      <circle cx="18" cy="13.5" r="1.7" />
    </svg>
  );
}

// Ángulo del dedo respecto al pivote, en grados, con 0° = arriba y signo
// positivo = hacia la derecha (misma convención que posFor más abajo).
function angleFromPointer(px, py, pivot) {
  const dx = px - pivot.x;
  const dy = pivot.y - py;
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

function normalizeDelta(d) {
  let n = d;
  while (n > 180) n -= 360;
  while (n < -180) n += 360;
  return n;
}

function posFor(angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180;
  return { dx: Math.sin(rad) * radius, dy: -Math.cos(rad) * radius };
}

/**
 * Icono ancla + dial giratorio en media luna para navegar entre pestañas.
 * Vive en su propia zona, fuera del grid del heatmap — no choca con el
 * long-press + arrastre del crosshair de Heatmap.jsx ni con el tilt de la
 * tarjeta.
 *
 * Secuencia: mantener presionado el ancla (~300ms) abre el dial con la
 * pestaña actual ya alineada arriba. Sin soltar el dedo, arrastrar a lo
 * largo del arco rota el dial — la cámara del mundo (World.jsx) se
 * adelanta en vivo hacia la pestaña que queda arriba. Soltar confirma esa
 * pestaña y el dial se repliega de vuelta al botón.
 */
export default function RadialNav({ tabs, activeId, onSelect, hidden, onOpenChange, onPreview, onPreviewCancel, theme }) {
  const reducedMotion = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [rotation, setRotation] = useState(0); // delta acumulado del arrastre, relativo a la apertura

  const anchorRef = useRef(null);
  const longPressTimer = useRef(null);
  const pivotRef = useRef({ x: 0, y: 0 });
  const radiusRef = useRef(150);
  const baseIndexRef = useRef(0); // pestaña activa al abrir — la que arranca alineada arriba
  const lastAngleRef = useRef(null);
  const lastSelectedRef = useRef(null);

  const count = tabs.length;
  const tabAngles = useMemo(
    () => tabs.map((_, i) => (i - (count - 1) / 2) * STEP_DEG),
    [count]
  );

  function setOpenState(next) {
    setOpen(next);
    onOpenChange?.(next);
  }

  function selectedIndexFor(ring) {
    let best = 0;
    let bestDiff = Infinity;
    tabAngles.forEach((a, i) => {
      const diff = Math.abs(normalizeDelta(a - ring));
      if (diff < bestDiff) {
        bestDiff = diff;
        best = i;
      }
    });
    return best;
  }

  const ring = tabAngles[baseIndexRef.current] + rotation;
  const selectedIndex = selectedIndexFor(ring);

  function openWheel() {
    const rect = anchorRef.current.getBoundingClientRect();
    pivotRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    radiusRef.current = Math.min(window.innerWidth / 2, window.innerHeight * RADIUS_MAX_RATIO);
    baseIndexRef.current = Math.max(0, tabs.findIndex((t) => t.id === activeId));
    lastAngleRef.current = null;
    lastSelectedRef.current = baseIndexRef.current;
    setRotation(0);
    setDragging(true);
    setOpenState(true);
  }

  function closeWheel(confirm) {
    if (confirm) {
      const finalIndex = selectedIndexFor(tabAngles[baseIndexRef.current] + rotation);
      onSelect(tabs[finalIndex].id);
    }
    onPreviewCancel?.();
    setDragging(false);
    setOpenState(false);
    lastAngleRef.current = null;
  }

  function onPointerDown(e) {
    if (hidden) return;
    e.preventDefault();
    try { anchorRef.current.setPointerCapture(e.pointerId); } catch { /* no-op */ }
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(openWheel, LONG_PRESS_MS);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const angle = angleFromPointer(e.clientX, e.clientY, pivotRef.current);
    if (lastAngleRef.current == null) {
      // Primer move tras abrir: solo fija la referencia, no rota todavía
      // (el dedo suele estar casi sobre el pivote al disparar el long-press).
      lastAngleRef.current = angle;
      return;
    }
    const delta = normalizeDelta(angle - lastAngleRef.current);
    lastAngleRef.current = angle;
    setRotation((r) => {
      const next = r + delta;
      const sel = selectedIndexFor(tabAngles[baseIndexRef.current] + next);
      if (sel !== lastSelectedRef.current) {
        lastSelectedRef.current = sel;
        onPreview?.(tabs[sel].id);
      }
      return next;
    });
  }

  function onPointerUp(e) {
    clearTimeout(longPressTimer.current);
    try { anchorRef.current.releasePointerCapture(e.pointerId); } catch { /* no-op */ }
    if (dragging) closeWheel(true);
  }

  function onPointerCancel() {
    clearTimeout(longPressTimer.current);
    if (dragging) closeWheel(false);
  }

  const radius = radiusRef.current;
  const transDuration = dragging ? DRAG_MS : reducedMotion ? 160 : SPRING_MS;
  const transEase = dragging ? "linear" : reducedMotion ? "ease-out" : SPRING_EASE;
  const accent = theme?.cells?.h5 ?? "#4ade80";

  return (
    <div
      className="fixed flex items-center justify-center"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        left: 0,
        right: 0,
        zIndex: 40,
        pointerEvents: "none",
      }}
    >
      <div className="relative" style={{ width: ANCHOR_SIZE, height: ANCHOR_SIZE, pointerEvents: "auto" }}>
        {/* Aro decorativo: ticks de minutero + dientes de engranaje, mismo
            sistema de coordenadas que las pestañas (centrado en el ancla). */}
        {open && TICK_ANGLES.map((a, i) => {
          const visual = a - ring;
          const { dx, dy } = posFor(visual, radius - 8);
          return (
            <div
              key={`tick-${i}`}
              aria-hidden="true"
              className="absolute rounded-full"
              style={{
                width: 2,
                height: 10,
                left: ANCHOR_SIZE / 2 - 1,
                top: ANCHOR_SIZE / 2 - 5,
                background: "rgba(255,255,255,0.18)",
                pointerEvents: "none",
                transform: `translate(${dx}px, ${dy}px) rotate(${visual}deg)`,
                transition: `transform ${transDuration}ms ${transEase}`,
              }}
            />
          );
        })}
        {open && TOOTH_ANGLES.map((a, i) => {
          const visual = a - ring;
          const { dx, dy } = posFor(visual, radius + 5);
          return (
            <div
              key={`tooth-${i}`}
              aria-hidden="true"
              className="absolute rounded-sm"
              style={{
                width: 4,
                height: 6,
                left: ANCHOR_SIZE / 2 - 2,
                top: ANCHOR_SIZE / 2 - 3,
                background: "rgba(255,255,255,0.1)",
                pointerEvents: "none",
                transform: `translate(${dx}px, ${dy}px) rotate(${visual}deg)`,
                transition: `transform ${transDuration}ms ${transEase}`,
              }}
            />
          );
        })}

        {tabs.map((tab, i) => {
          const visual = tabAngles[i] - ring;
          const { dx, dy } = posFor(visual, radius);
          const isSelected = open && i === selectedIndex;
          return (
            <div
              key={tab.id}
              aria-hidden="true"
              className="absolute flex items-center justify-center rounded-full"
              style={{
                width: ITEM_SIZE,
                height: ITEM_SIZE,
                left: ANCHOR_SIZE / 2 - ITEM_SIZE / 2,
                top: ANCHOR_SIZE / 2 - ITEM_SIZE / 2,
                backgroundColor: isSelected ? `${accent}26` : "rgba(23,23,23,0.92)",
                border: isSelected ? `1px solid ${accent}` : "1px solid rgba(255,255,255,0.08)",
                boxShadow: isSelected ? `0 0 14px 2px ${accent}66` : "none",
                color: isSelected ? accent : "rgba(255,255,255,0.45)",
                pointerEvents: "none",
                transform: open
                  ? `translate(${dx}px, ${dy}px) scale(${isSelected ? 1.14 : 1})`
                  : "translate(0px, 0px) scale(0.2)",
                opacity: open ? 1 : 0,
                transition: `transform ${transDuration}ms ${transEase}, opacity 160ms ease, background-color 120ms ease, box-shadow 120ms ease, color 120ms ease`,
              }}
            >
              {tab.icon(isSelected)}
            </div>
          );
        })}

        <button
          ref={anchorRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Navegar"
          className="relative rounded-full flex items-center justify-center"
          style={{
            width: ANCHOR_SIZE,
            height: ANCHOR_SIZE,
            touchAction: "none",
            WebkitTouchCallout: "none",
            userSelect: "none",
            backgroundColor: "rgba(23,23,23,0.85)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.55)",
            opacity: hidden ? 0 : open ? 1 : 0.4,
            pointerEvents: hidden ? "none" : "auto",
            transform: open ? "scale(1.04)" : "scale(0.82)",
            transition: "opacity 200ms ease, transform 200ms ease",
          }}
        >
          <AnchorIcon />
        </button>
      </div>
    </div>
  );
}
