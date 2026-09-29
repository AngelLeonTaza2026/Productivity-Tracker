import { useEffect, useRef, useState } from "react";

const CONTROLS_HIDE_DELAY_MS = 3000;
const PAUSE_COLOR = "#b56b4a"; // terracota apagada — "pausa", no "alarma"

function PauseIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

/**
 * Overlay de pantalla completa que se activa mientras el timer corre.
 * No tiene lógica propia de conteo de tiempo — solo refleja isRunning,
 * que ya vive en useTimer.js respaldado por el startedAt en Dexie.
 */
export default function FocusMode({ isRunning, onPause }) {
  const [controlsVisible, setControlsVisible] = useState(false);
  const hideTimer = useRef(null);

  // Al salir del modo enfoque, resetea el estado de los controles para la próxima vez
  useEffect(() => {
    if (!isRunning) {
      clearTimeout(hideTimer.current);
      setControlsVisible(false);
    }
  }, [isRunning]);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  if (!isRunning) return null;

  function revealControls() {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY_MS);
  }

  function handlePause(e) {
    e.stopPropagation();
    clearTimeout(hideTimer.current);
    onPause();
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-neutral-950"
      style={{ zIndex: 100 }}
      onClick={revealControls}
    >
      <div className="w-6 h-6 rounded-full bg-green-500 animate-pulse" />

      <button
        onClick={handlePause}
        aria-label="Pausar"
        className={[
          "absolute p-4 transition-opacity duration-300",
          controlsVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))", color: PAUSE_COLOR }}
      >
        <PauseIcon />
      </button>
    </div>
  );
}
