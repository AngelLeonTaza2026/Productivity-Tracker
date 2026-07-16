import { useEffect, useRef, useState } from "react";
import { useTimer } from "../hooks/useTimer.js";
import { getTotalSeconds, resetTimer } from "../db/timer.js";
import { formatRaw } from "../utils/time.js";

const REVEAL_DURATION_MS = 10000;

export default function Timer() {
  const { isRunning, loading, start, pause } = useTimer();

  // ── Reveal de emergencia ──────────────────────────────────────────────────
  const [revealed, setRevealed] = useState(false);
  const [revealedSeconds, setRevealedSeconds] = useState(0);
  const hideTimeout = useRef(null);

  async function handleReveal() {
    const secs = await getTotalSeconds();
    setRevealedSeconds(secs);
    setRevealed(true);
    clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => setRevealed(false), REVEAL_DURATION_MS);
  }

  // Mientras está revelado y corriendo, actualiza cada segundo
  useEffect(() => {
    if (!revealed || !isRunning) return;
    const interval = setInterval(async () => {
      setRevealedSeconds(await getTotalSeconds());
    }, 1000);
    return () => clearInterval(interval);
  }, [revealed, isRunning]);

  async function handleReset() {
    if (isRunning) await pause();
    await resetTimer();
    setRevealedSeconds(0);
    setRevealed(false);
  }

  if (loading) return null;

  return (
    <div className="flex flex-col items-center gap-10">
      {/* Indicador visual — tap para reveal de emergencia */}
      <button
        onClick={handleReveal}
        className="flex flex-col items-center gap-3 focus:outline-none group"
        aria-label="Revelar tiempo acumulado"
      >
        <div
          className={[
            "w-4 h-4 rounded-full transition-colors duration-500",
            isRunning ? "bg-green-500 animate-pulse" : "bg-neutral-700",
          ].join(" ")}
        />
        <span className="text-xs tracking-widest uppercase text-neutral-600 group-hover:text-neutral-500 transition-colors">
          {isRunning ? "corriendo" : "pausado"}
        </span>
      </button>

      {/* Panel de emergencia — solo aparece al tocar el indicador */}
      {revealed && (
        <div className="flex flex-col items-center gap-3 px-6 py-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <p className="text-xs text-neutral-500 tracking-widest uppercase">tiempo acumulado</p>
          <p className="text-2xl font-mono text-amber-400">{formatRaw(revealedSeconds)}</p>
          <button
            onClick={handleReset}
            className="text-xs text-red-500 hover:text-red-400 tracking-widest uppercase mt-1 transition-colors"
          >
            Resetear timer
          </button>
        </div>
      )}

      {/* Botón principal */}
      <button
        onClick={isRunning ? pause : start}
        className={[
          "px-10 py-3 rounded-full text-sm font-medium tracking-widest uppercase transition-all duration-200",
          isRunning
            ? "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            : "bg-green-600 text-white hover:bg-green-500",
        ].join(" ")}
      >
        {isRunning ? "Pausar" : "Iniciar"}
      </button>
    </div>
  );
}
