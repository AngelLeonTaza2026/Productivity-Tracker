import { useMemo, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion.js";

const LONG_PRESS_MS = 300;
const ANCHOR_SIZE = 44;          // blanco táctil fijo del botón (el tamaño visual idle es por scale)
const RADIUS_MAX_RATIO = 0.55;   // tope de radio relativo al alto, por si el ancho es muy grande
const LABEL_RADIUS_RATIO = 0.6;  // a qué distancia del pivote queda el icono/etiqueta de cada sector

// Apertura/cierre: la media luna crece desde el botón y se encoge de
// vuelta — es la ÚNICA animación de movimiento del dial. Mientras está
// abierta no rota, no se estira, no sigue al dedo.
const OPEN_MS = 420;
const OPEN_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const FADE_MS = 160;
const GLOW_MS = 130; // transición del resaltado al cambiar de sector — empieza en el mismo frame del cruce

// --- Sensibilidad de la selección (ajustables sin tocar la lógica) ---
// Radio por debajo del cual se ignora el dedo por completo — cerca del
// pivote el ángulo cambia muchísimo con movimientos mínimos. Junto con
// HYSTERESIS_DEG es lo que evita la hipersensibilidad, sin meter retraso
// de tiempo (no hay temporizadores en el camino de la selección).
const DEAD_RADIUS_RATIO = 0.3;
// Grados que el dedo debe adentrarse en un sector nuevo, más allá del
// límite, antes de que cuente como selección — el cambio se acepta de
// inmediato en cuanto se cruza, sin espera adicional.
const HYSTERESIS_DEG = 15;
// Filtro pasa-bajos sobre el ángulo del dedo (0-1: más alto = menos
// filtro = más reactivo). Solo un suavizado leve del ruido del sensor
// táctil — la histéresis es la que realmente controla la sensibilidad.
const SMOOTHING = 0.65;

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
// positivo = hacia la derecha.
function angleFromPointer(px, py, pivot) {
  const dx = px - pivot.x;
  const dy = pivot.y - py;
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

function pointAt(angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: Math.sin(rad) * radius, y: -Math.cos(rad) * radius };
}

function sectorAt(angle, boundaries) {
  for (let i = 0; i < boundaries.length - 1; i++) {
    if (angle <= boundaries[i + 1]) return i;
  }
  return boundaries.length - 2;
}

// Igual que sectorAt, pero exige haberse adentrado HYSTERESIS_DEG más
// allá del límite del sector ya confirmado antes de aceptar un cambio —
// así el dedo no hace parpadear la selección justo en el borde.
function sectorWithHysteresis(angle, committed, boundaries) {
  const lo = boundaries[committed];
  const hi = boundaries[committed + 1];
  if (angle >= lo && angle <= hi) return committed;
  const raw = sectorAt(angle, boundaries);
  if (raw === committed) return committed;
  if (raw > committed) {
    const rawLo = boundaries[raw];
    return angle - rawLo >= HYSTERESIS_DEG || raw - committed > 1 ? raw : committed;
  }
  const rawHi = boundaries[raw + 1];
  return rawHi - angle >= HYSTERESIS_DEG || committed - raw > 1 ? raw : committed;
}

/**
 * Icono ancla + media luna de sectores fijos para navegar entre pestañas.
 * Vive en su propia zona, fuera del grid del heatmap — no choca con el
 * long-press + arrastre del crosshair de Heatmap.jsx ni con el tilt de la
 * tarjeta.
 *
 * La media luna es una forma estática: se divide en N sectores iguales
 * (de izquierda a derecha, igual que el orden de pestañas en World.jsx)
 * y solo se anima al abrirse/cerrarse. Mantener presionado el ancla
 * (~300ms) la abre con la pestaña actual ya iluminada; arrastrar sin
 * soltar ilumina otro sector al instante en que se cruza (zona muerta +
 * histéresis evitan la hipersensibilidad, sin temporizadores de por
 * medio); soltar confirma lo iluminado.
 */
export default function RadialNav({ tabs, activeId, onSelect, hidden, onOpenChange, onPreview, onPreviewCancel, theme }) {
  const reducedMotion = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);

  const anchorRef = useRef(null);
  const longPressTimer = useRef(null);
  const pivotRef = useRef({ x: 0, y: 0 });
  const radiusRef = useRef(150);
  const baseIndexRef = useRef(0);      // pestaña activa al abrir
  const committedRef = useRef(0);      // sector iluminado — vive solo en refs, nunca dispara render
  const smoothedAngleRef = useRef(null);
  const glowRefs = useRef([]);
  const iconRefs = useRef([]);

  const count = tabs.length;
  const boundaries = useMemo(() => {
    const step = 180 / count;
    return Array.from({ length: count + 1 }, (_, i) => -90 + i * step);
  }, [count]);
  const midAngles = useMemo(
    () => tabs.map((_, i) => (boundaries[i] + boundaries[i + 1]) / 2),
    [boundaries, tabs.length]
  );

  const accent = theme?.cells?.h5 ?? "#4ade80";

  function setOpenState(next) {
    setOpen(next);
    onOpenChange?.(next);
  }

  // Pinta el resaltado directo en el DOM vía refs — nunca por React state,
  // así un cambio de sector no dispara un re-render de todo el árbol.
  function paintSector(idx) {
    tabs.forEach((_, i) => {
      const on = i === idx;
      const glow = glowRefs.current[i];
      if (glow) glow.style.opacity = on ? "0.22" : "0";
      const icon = iconRefs.current[i];
      if (icon) icon.style.color = on ? accent : "rgba(255,255,255,0.45)";
    });
  }

  // Se acepta en el mismo instante en que la histéresis se cruza — sin
  // temporizador de confirmación de por medio.
  function commitSector(idx) {
    if (idx === committedRef.current) return;
    committedRef.current = idx;
    paintSector(idx);
    if (idx === baseIndexRef.current) onPreviewCancel?.();
    else onPreview?.(tabs[idx].id);
  }

  function openWheel() {
    const rect = anchorRef.current.getBoundingClientRect();
    pivotRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    radiusRef.current = Math.min(window.innerWidth / 2, window.innerHeight * RADIUS_MAX_RATIO);
    const idx = Math.max(0, tabs.findIndex((t) => t.id === activeId));
    baseIndexRef.current = idx;
    committedRef.current = idx;
    smoothedAngleRef.current = null;
    paintSector(idx);
    setOpenState(true);
  }

  function closeWheel(confirm) {
    if (confirm) onSelect(tabs[committedRef.current].id);
    onPreviewCancel?.();
    setOpenState(false);
  }

  function onPointerDown(e) {
    if (hidden) return;
    e.preventDefault();
    try { anchorRef.current.setPointerCapture(e.pointerId); } catch { /* no-op */ }
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(openWheel, LONG_PRESS_MS);
  }

  function onPointerMove(e) {
    if (!open) return;
    const dx = e.clientX - pivotRef.current.x;
    const dy = pivotRef.current.y - e.clientY;
    const dist = Math.hypot(dx, dy);
    const rawAngle = angleFromPointer(e.clientX, e.clientY, pivotRef.current);
    // Zona muerta cerca del pivote, o fuera de la media luna (dedo por
    // debajo del nivel del botón): se ignora, la selección queda como está.
    if (dist < DEAD_RADIUS_RATIO * radiusRef.current || Math.abs(rawAngle) > 90) return;

    smoothedAngleRef.current = smoothedAngleRef.current == null
      ? rawAngle
      : smoothedAngleRef.current + SMOOTHING * (rawAngle - smoothedAngleRef.current);

    const raw = sectorWithHysteresis(smoothedAngleRef.current, committedRef.current, boundaries);
    commitSector(raw);
  }

  function onPointerUp(e) {
    clearTimeout(longPressTimer.current);
    try { anchorRef.current.releasePointerCapture(e.pointerId); } catch { /* no-op */ }
    if (open) closeWheel(true);
  }

  function onPointerCancel() {
    clearTimeout(longPressTimer.current);
    if (open) closeWheel(false);
  }

  const radius = radiusRef.current;
  const openMs = reducedMotion ? 160 : OPEN_MS;
  const openEase = reducedMotion ? "ease-out" : OPEN_EASE;

  const rimPath = useMemo(() => {
    const a = pointAt(-90, radius);
    const b = pointAt(90, radius);
    return `M ${a.x} ${a.y} A ${radius} ${radius} 0 0 1 ${b.x} ${b.y}`;
  }, [radius]);

  const basePath = useMemo(() => `${rimPath.replace("M", "M 0 0 L")} Z`, [rimPath]);

  const sectorPaths = useMemo(
    () =>
      tabs.map((_, i) => {
        const a = pointAt(boundaries[i], radius);
        const b = pointAt(boundaries[i + 1], radius);
        return `M 0 0 L ${a.x} ${a.y} A ${radius} ${radius} 0 0 1 ${b.x} ${b.y} Z`;
      }),
    [boundaries, radius, tabs.length]
  );

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
      <div className="relative" style={{ width: ANCHOR_SIZE, height: ANCHOR_SIZE }}>
        {/* Todo el contenido de la media luna crece/encoge como un único
            bloque rígido anclado al pivote — es la única animación de
            movimiento mientras el dial existe. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: ANCHOR_SIZE / 2,
            top: ANCHOR_SIZE / 2,
            transformOrigin: "0 0",
            transform: open ? "scale(1)" : "scale(0.05)",
            opacity: open ? 1 : 0,
            pointerEvents: "none",
            transition: `transform ${openMs}ms ${openEase}, opacity ${FADE_MS}ms ease`,
          }}
        >
          <svg
            style={{ position: "absolute", left: -radius, top: -radius, width: radius * 2, height: radius, overflow: "visible" }}
            viewBox={`${-radius} ${-radius} ${radius * 2} ${radius}`}
          >
            <path d={basePath} fill="rgba(23,23,23,0.92)" />
            {sectorPaths.map((d, i) => (
              <path
                key={`glow-${tabs[i].id}`}
                ref={(el) => (glowRefs.current[i] = el)}
                d={d}
                fill={accent}
                opacity={0}
                style={{ transition: `opacity ${GLOW_MS}ms ease-out` }}
              />
            ))}
            {boundaries.slice(1, -1).map((a, i) => {
              const p = pointAt(a, radius);
              return (
                <line key={`div-${i}`} x1={0} y1={0} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} />
              );
            })}
            <path d={rimPath} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
          </svg>

          {tabs.map((tab, i) => {
            const p = pointAt(midAngles[i], radius * LABEL_RADIUS_RATIO);
            return (
              <div
                key={tab.id}
                ref={(el) => (iconRefs.current[i] = el)}
                aria-hidden="true"
                className="absolute flex flex-col items-center justify-center"
                style={{
                  left: p.x,
                  top: p.y,
                  transform: "translate(-50%, -50%)",
                  color: "rgba(255,255,255,0.45)",
                  transition: `color ${GLOW_MS}ms ease-out`,
                  pointerEvents: "none",
                }}
              >
                {tab.icon(i === baseIndexRef.current)}
                <span className="mt-1 text-[10px] uppercase tracking-wide" style={{ whiteSpace: "nowrap" }}>
                  {tab.label}
                </span>
              </div>
            );
          })}
        </div>

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
