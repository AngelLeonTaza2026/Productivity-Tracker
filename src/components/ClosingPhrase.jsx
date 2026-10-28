import { useEffect, useRef, useState } from "react";
import { pickClosingPhrase } from "../phrases.js";

const SUSPENSE_MS = 650;
const REVEAL_TRANSITION_MS = 500;
const AUTO_HIDE_MS = 3200; // cuenta desde que arranca el revelado, no desde el montaje
const DISMISS_FADE_MS = 400;

// Resplandor y anillo según el resultado del día — mismo espíritu que los
// colores del heatmap, pero apagados a propósito (nada de neón).
const STATUS_GLOW = {
  productive: "rgba(74, 222, 128, 0.35)",
  zero: "rgba(220, 38, 38, 0.22)",
  rest: "rgba(100, 116, 139, 0.32)",
  vacation: "rgba(139, 127, 201, 0.32)",
};

const STATUS_RING = {
  productive: "#4ade80",
  zero: "#dc2626",
  rest: "#64748b",
  vacation: "#8b7fc9",
};

/**
 * Overlay de cierre de día en dos tiempos: un breve suspenso (punto que
 * respira) antes de revelar la frase con un resplandor temático según el
 * resultado — pensado como un pequeño "momento" diario, no solo un toast.
 * Se puede saltar el suspenso tocando la pantalla, y el resultado se
 * descarta solo o al tocar de nuevo.
 */
export default function ClosingPhrase({ status, onDone }) {
  const [phrase] = useState(() => pickClosingPhrase(status));
  const [phase, setPhase] = useState("suspense"); // "suspense" | "reveal" | "hidden"
  const suspenseTimer = useRef(null);
  const hideTimer = useRef(null);
  const doneTimer = useRef(null);

  useEffect(() => {
    suspenseTimer.current = setTimeout(reveal, SUSPENSE_MS);
    return () => {
      clearTimeout(suspenseTimer.current);
      clearTimeout(hideTimer.current);
      clearTimeout(doneTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reveal() {
    clearTimeout(suspenseTimer.current);
    setPhase("reveal");
    hideTimer.current = setTimeout(dismiss, AUTO_HIDE_MS);
  }

  function dismiss() {
    clearTimeout(suspenseTimer.current);
    clearTimeout(hideTimer.current);
    setPhase("hidden");
    doneTimer.current = setTimeout(() => onDone?.(), DISMISS_FADE_MS);
  }

  function handleTap() {
    if (phase === "suspense") reveal();
    else if (phase === "reveal") dismiss();
  }

  const glow = STATUS_GLOW[status] ?? STATUS_GLOW.productive;
  const ring = STATUS_RING[status] ?? STATUS_RING.productive;
  const revealed = phase === "reveal";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-10 text-center overflow-hidden"
      style={{
        zIndex: 90,
        backgroundColor: "rgba(10,10,10,0.92)",
        opacity: phase === "hidden" ? 0 : 1,
        transition: `opacity ${DISMISS_FADE_MS}ms ease`,
      }}
      onClick={handleTap}
    >
      {/* Resplandor temático — solo aparece al revelar */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 420,
          height: 420,
          background: `radial-gradient(circle, ${glow}, transparent 70%)`,
          opacity: revealed ? 1 : 0,
          transform: `scale(${revealed ? 1 : 0.6})`,
          transition: `opacity ${REVEAL_TRANSITION_MS}ms ease, transform ${REVEAL_TRANSITION_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
        }}
      />

      {/* Suspenso: un punto que respira mientras se decide el resultado */}
      {!revealed && (
        <div
          className="w-3 h-3 rounded-full bg-neutral-500"
          style={{ animation: "closing-breathe 1.1s ease-in-out infinite" }}
        />
      )}

      {/* Anillo de confirmación: un pulso que se expande justo al revelar */}
      {revealed && (
        <div
          key="ring"
          className="absolute rounded-full border pointer-events-none"
          style={{
            width: 90,
            height: 90,
            borderColor: ring,
            borderWidth: 1.5,
            animation: `closing-ring ${REVEAL_TRANSITION_MS * 2}ms ease-out forwards`,
          }}
        />
      )}

      <p
        className="relative text-neutral-100 tracking-wide select-none"
        style={{
          fontSize: "1.15rem",
          lineHeight: 1.5,
          maxWidth: 320,
          opacity: revealed ? 1 : 0,
          transform: `scale(${revealed ? 1 : 0.85}) translateY(${revealed ? 0 : 6}px)`,
          transition: `opacity ${REVEAL_TRANSITION_MS}ms ease, transform ${REVEAL_TRANSITION_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
        }}
      >
        {phrase}
      </p>
    </div>
  );
}
