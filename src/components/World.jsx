import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion.js";

// Resorte con ligero overshoot — misma familia de curva que ya se usa en
// el resto de la app para transiciones "satisfactorias" (portal del
// heatmap, modales), para que la cámara se sienta de la misma casa.
const SPRING_MS = 540;
const SPRING_EASE = "cubic-bezier(0.22, 1.12, 0.36, 1)";
const FADE_MS = 220;

// Cuánto se adelanta la cámara hacia la pestaña que está bajo el dedo
// mientras se arrastra en la rueda de RadialNav.jsx, antes de soltar.
const PREVIEW_BLEND = 0.22;
const PREVIEW_MS = 180;

/**
 * Un solo mundo continuo: todas las pestañas quedan siempre montadas, una
 * al lado de la otra en una pista horizontal — cambiar de pestaña mueve
 * una cámara (transform), nunca desmonta/monta componentes. Así cada
 * vista conserva su propio estado (timer, scroll, lo que sea) todo el
 * tiempo, en vez de perderlo al volver.
 *
 * Solo anima `transform`/`opacity`/`filter` (nunca left/width) para que
 * corra en el compositor, no en el hilo principal — clave para 60fps en
 * el grid de 380+ celdas del heatmap. Respeta prefers-reduced-motion: ahí
 * no hay pista que mover, las pestañas quedan apiladas y se cruzan con
 * un fade.
 *
 * `dimmed` y `previewId` los maneja RadialNav.jsx (vía App.jsx) mientras
 * la rueda de navegación está abierta — desenfoque/retroceso de fondo y
 * el adelanto de cámara hacia la pestaña bajo el dedo, respectivamente.
 */
export default function World({ tabs, activeId, bgColor, dimmed = false, previewId = null }) {
  const reducedMotion = usePrefersReducedMotion();
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeId));
  const previewIndex = previewId ? tabs.findIndex((t) => t.id === previewId) : -1;
  const isPreviewing = previewIndex >= 0 && previewIndex !== activeIndex;
  const blendedIndex = isPreviewing
    ? activeIndex + (previewIndex - activeIndex) * PREVIEW_BLEND
    : activeIndex;

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{
        backgroundColor: bgColor,
        transform: dimmed ? "scale(0.95)" : "scale(1)",
        filter: dimmed ? "blur(6px)" : "none",
        transition: "transform 380ms ease, filter 380ms ease",
      }}
    >
      <div
        className="flex h-full"
        style={{
          width: `${tabs.length * 100}vw`,
          willChange: "transform",
          transform: reducedMotion ? "none" : `translateX(-${blendedIndex * 100}vw)`,
          transition: reducedMotion
            ? "none"
            : `transform ${isPreviewing ? PREVIEW_MS : SPRING_MS}ms ${isPreviewing ? "ease-out" : SPRING_EASE}`,
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <div
              key={tab.id}
              aria-hidden={!isActive}
              style={
                reducedMotion
                  ? {
                      position: "absolute",
                      inset: 0,
                      opacity: isActive ? 1 : 0,
                      pointerEvents: isActive ? "auto" : "none",
                      transition: `opacity ${FADE_MS}ms ease`,
                    }
                  : {
                      width: "100vw",
                      height: "100%",
                      flexShrink: 0,
                      pointerEvents: isActive ? "auto" : "none",
                    }
              }
            >
              {tab.render()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
