import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion.js";

// Resorte firme — viaje final de la cámara al soltar en RadialNav.jsx,
// rápido pero sin golpe seco.
const SPRING_MS = 280;
const SPRING_EASE = "cubic-bezier(0.22, 1.12, 0.36, 1)";
const FADE_MS = 220;

// Cuánto se asoma la cámara hacia el sector que RadialNav.jsx tiene
// iluminado — arranca en el mismo instante en que cambia la selección
// allá (sin espera), un asomo leve, no un desplazamiento completo.
const PEEK_RATIO = 0.12;
const PEEK_MS = 180;

/**
 * Un solo mundo continuo: todas las pestañas quedan siempre montadas, una
 * al lado de la otra en una pista horizontal — cambiar de pestaña mueve
 * una cámara (transform), nunca desmonta/monta componentes. Así cada
 * vista conserva su propio estado (timer, scroll, lo que sea) todo el
 * tiempo, en vez de perderlo al volver.
 *
 * Solo anima `transform`/`opacity` (nunca left/width/filter) para que
 * corra en el compositor, no en el hilo principal — clave para 60fps en
 * el grid de 380+ celdas del heatmap. El valor del blur de fondo queda
 * fijo al abrir la rueda (no se anima su intensidad, solo el escalado
 * que lo acompaña) porque animar `filter` es costoso para el hilo
 * principal justo cuando más importa la respuesta táctil. Respeta
 * prefers-reduced-motion: ahí no hay pista que mover, las pestañas
 * quedan apiladas y se cruzan con un fade.
 *
 * `dimmed` y `previewId` los maneja RadialNav.jsx (vía App.jsx) mientras
 * la rueda de navegación está abierta — desenfoque/retroceso de fondo y
 * el asomo leve hacia el sector iluminado, respectivamente.
 */
export default function World({ tabs, activeId, bgColor, dimmed = false, previewId = null }) {
  const reducedMotion = usePrefersReducedMotion();
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeId));
  const previewIndex = previewId ? tabs.findIndex((t) => t.id === previewId) : -1;
  const isPreviewing = previewIndex >= 0 && previewIndex !== activeIndex;
  const blendedIndex = isPreviewing
    ? activeIndex + (previewIndex - activeIndex) * PEEK_RATIO
    : activeIndex;

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{
        backgroundColor: bgColor,
        transform: dimmed ? "scale(0.95)" : "scale(1)",
        filter: dimmed ? "blur(6px)" : "none", // fijo — nunca animado, ver comentario arriba
        transition: "transform 380ms ease",
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
            : `transform ${isPreviewing ? PEEK_MS : SPRING_MS}ms ${isPreviewing ? "ease-out" : SPRING_EASE}`,
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
