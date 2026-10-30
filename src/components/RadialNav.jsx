import { useRef, useState } from "react";

const LONG_PRESS_MS = 300;
const WHEEL_RADIUS = 78;
const HIT_RADIUS = 34;
const ITEM_SIZE = 44;
const ANCHOR_SIZE = 44;
const SPRING_MS = 420;
const SPRING_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";

function AnchorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="18" r="1.7" />
      <circle cx="6" cy="13.5" r="1.7" />
      <circle cx="18" cy="13.5" r="1.7" />
    </svg>
  );
}

// Reparte N pestañas en un arco de media luna hacia arriba — con 2 queda
// simétrico a los costados, con más pestañas el arco se abre más (hasta
// 150°), sin que el diseño necesite tocarse al agregar una tercera vista.
function wheelOffsets(count) {
  if (count <= 1) return [{ dx: 0, dy: -WHEEL_RADIUS }];
  const span = Math.min(150, (count - 1) * 70);
  const step = span / (count - 1);
  const start = -span / 2;
  return Array.from({ length: count }, (_, i) => {
    const deg = start + i * step;
    const rad = (deg * Math.PI) / 180;
    return { dx: Math.sin(rad) * WHEEL_RADIUS, dy: -Math.cos(rad) * WHEEL_RADIUS };
  });
}

/**
 * Icono ancla + rueda en media luna para navegar entre pestañas. Vive en
 * su propia zona, fuera del grid del heatmap — no choca con el long-press
 * + arrastre del crosshair de Heatmap.jsx ni con el tilt de la tarjeta.
 *
 * Dos formas de abrirla:
 * - Mantener presionado ~300ms: abre y, sin soltar el dedo, arrastrás
 *   hasta una pestaña (se resalta con un leve escalado) — soltar ahí la
 *   selecciona, soltar afuera cierra sin cambiar de vista.
 * - Toque rápido: abre y queda esperando un toque aparte sobre una
 *   pestaña (o afuera, para cerrarla).
 */
export default function RadialNav({ tabs, activeId, onSelect, hidden, onOpenChange, onPreview, onPreviewCancel }) {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hoverId, setHoverId] = useState(null);

  const anchorRef = useRef(null);
  const longPressTimer = useRef(null);
  const anchorCenter = useRef({ x: 0, y: 0 });
  const heldRef = useRef(false); // true si esta apertura viene de mantener presionado
  const lastHoverRef = useRef(null);

  const offsets = wheelOffsets(tabs.length);

  function setOpenState(next) {
    setOpen(next);
    onOpenChange?.(next);
  }

  function hitTest(px, py) {
    let best = null;
    let bestDist = HIT_RADIUS;
    tabs.forEach((tab, i) => {
      const ox = anchorCenter.current.x + offsets[i].dx;
      const oy = anchorCenter.current.y + offsets[i].dy;
      const d = Math.hypot(px - ox, py - oy);
      if (d <= bestDist) { bestDist = d; best = tab.id; }
    });
    return best;
  }

  function closeWheel() {
    setOpenState(false);
    setDragging(false);
    setHoverId(null);
    lastHoverRef.current = null;
    onPreviewCancel?.();
  }

  function onPointerDown(e) {
    if (hidden) return;
    e.preventDefault();
    try { anchorRef.current.setPointerCapture(e.pointerId); } catch { /* no-op */ }
    const rect = anchorRef.current.getBoundingClientRect();
    anchorCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    heldRef.current = false;
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      heldRef.current = true;
      setDragging(true);
      setOpenState(true);
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const hit = hitTest(e.clientX, e.clientY);
    if (hit !== lastHoverRef.current) {
      lastHoverRef.current = hit;
      setHoverId(hit);
      if (hit) onPreview?.(hit);
      else onPreviewCancel?.();
    }
  }

  function onPointerUp(e) {
    clearTimeout(longPressTimer.current);
    try { anchorRef.current.releasePointerCapture(e.pointerId); } catch { /* no-op */ }

    if (heldRef.current) {
      // Venía de mantener presionado: lo que esté bajo el dedo ahora decide
      const hit = lastHoverRef.current;
      setDragging(false);
      setHoverId(null);
      lastHoverRef.current = null;
      onPreviewCancel?.();
      if (hit) {
        onSelect(hit);
        setOpenState(false);
      } else {
        setOpenState(false);
      }
      return;
    }

    // No hubo mantener presionado: fue un toque rápido — alterna abrir/cerrar
    setOpenState(!open);
  }

  function onPointerCancel() {
    clearTimeout(longPressTimer.current);
    closeWheel();
  }

  // Solo relevante en el modo "toque rápido abre, después tocás un ítem" —
  // durante el arrastre con el dedo mantenido, setPointerCapture hace que
  // estos clicks nunca lleguen (todo el seguimiento pasa por el ancla).
  function handleItemTap(id) {
    onSelect(id);
    setOpenState(false);
  }

  return (
    <div
      className="fixed flex items-center justify-center"
      style={{
        bottom: "max(10px, env(safe-area-inset-bottom))",
        left: 0,
        right: 0,
        zIndex: 40,
        pointerEvents: "none",
      }}
    >
      {/* Atrapa toques afuera de la rueda para cerrarla — solo tiene
          sentido en el modo "toque rápido" (si viene de mantener
          presionado, soltar ya la cierra en onPointerUp). */}
      {open && !dragging && (
        <button
          className="fixed inset-0"
          style={{ background: "transparent", border: "none", pointerEvents: "auto" }}
          aria-label="Cerrar menú"
          onClick={closeWheel}
        />
      )}

      <div className="relative" style={{ width: ANCHOR_SIZE, height: ANCHOR_SIZE, pointerEvents: "auto" }}>
        {tabs.map((tab, i) => {
          const { dx, dy } = offsets[i];
          const isActive = tab.id === activeId;
          const isHover = hoverId === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { if (!dragging) handleItemTap(tab.id); }}
              aria-label={tab.label}
              className="absolute flex items-center justify-center rounded-full"
              style={{
                width: ITEM_SIZE,
                height: ITEM_SIZE,
                left: ANCHOR_SIZE / 2 - ITEM_SIZE / 2,
                top: ANCHOR_SIZE / 2 - ITEM_SIZE / 2,
                touchAction: "none",
                backgroundColor: isActive ? "rgba(255,255,255,0.14)" : "rgba(23,23,23,0.92)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: isActive ? "white" : "rgba(255,255,255,0.55)",
                pointerEvents: open ? "auto" : "none",
                transform: open
                  ? `translate(${dx}px, ${dy}px) scale(${isHover ? 1.2 : 1})`
                  : "translate(0px, 0px) scale(0.2)",
                opacity: open ? 1 : 0,
                transition: open
                  ? `transform ${SPRING_MS}ms ${SPRING_EASE} ${i * 25}ms, opacity 160ms ease ${i * 25}ms`
                  : "transform 260ms ease, opacity 200ms ease",
              }}
            >
              {tab.icon(isActive)}
            </button>
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
          className="relative rounded-full flex items-center justify-center select-none"
          style={{
            width: ANCHOR_SIZE,
            height: ANCHOR_SIZE,
            touchAction: "none",
            WebkitTouchCallout: "none",
            backgroundColor: "rgba(23,23,23,0.85)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.55)",
            opacity: hidden ? 0 : 1,
            pointerEvents: hidden ? "none" : "auto",
            transform: open ? "scale(0.92)" : "scale(1)",
            transition: "opacity 200ms ease, transform 200ms ease",
          }}
        >
          <AnchorIcon />
        </button>
      </div>
    </div>
  );
}
