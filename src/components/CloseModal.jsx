import { useEffect, useRef, useState } from "react";
import { getTotalSeconds } from "../db/timer.js";
import {
  formatRaw,
  formatQuarterMinutes,
  suggestQuarterMinutes,
  quarterMinutesToHours,
} from "../utils/time.js";

const SWIPE_THRESHOLD = 90;
const MIN_PRODUCTIVE_MINUTES = 60; // regla: menos de 1h = día en cero

export default function CloseModal({ onConfirm, onCancel }) {
  const [rawSeconds, setRawSeconds] = useState(null);
  const [qm, setQm] = useState(null); // quarter-minutes seleccionados

  useEffect(() => {
    getTotalSeconds().then((secs) => {
      setRawSeconds(secs);
      setQm(suggestQuarterMinutes(secs));
    });
  }, []);

  // ── Regla de 1 hora ───────────────────────────────────────────────────────
  const isUnderMinimum = qm !== null && qm < MIN_PRODUCTIVE_MINUTES;
  // Si está bajo el mínimo, el swipe guarda como ZERO automáticamente
  const effectiveStatus = isUnderMinimum ? "zero" : "productive";

  // ── Swipe-up ──────────────────────────────────────────────────────────────
  const [dragY, setDragY] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const startY = useRef(null);
  const dragging = useRef(false);

  function onPointerDown(e) {
    startY.current = e.clientY;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging.current) return;
    const delta = startY.current - e.clientY;
    setDragY(Math.max(0, delta));
  }

  function onPointerUp() {
    dragging.current = false;
    if (dragY >= SWIPE_THRESHOLD) {
      setConfirmed(true);
      setDragY(300);
      const hours = effectiveStatus === "zero" ? 0 : quarterMinutesToHours(qm);
      setTimeout(() => onConfirm({ hours, status: effectiveStatus }), 350);
    } else {
      setDragY(0);
    }
  }

  function adjust(delta) {
    setQm((prev) => Math.max(0, prev + delta * 15));
  }

  if (rawSeconds === null || qm === null) return null;

  const progress = Math.min(dragY / SWIPE_THRESHOLD, 1);

  const cardStyle = {
    transform: `translateY(${-dragY}px)`,
    transition: dragging.current ? "none" : "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
    opacity: confirmed ? 0 : 1,
  };

  // Colores de la tarjeta según si es productivo o cero
  const cardBg = isUnderMinimum
    ? progress > 0.5 ? "bg-red-700" : "bg-red-900"
    : progress > 0.5 ? "bg-green-600" : "bg-neutral-800";

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-label="Cancelar"
      />

      <div className="relative z-10 bg-neutral-900 rounded-t-3xl px-6 pt-6 pb-10 flex flex-col gap-6"
        style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-neutral-700 mx-auto" />

        {/* Tiempo en crudo */}
        <div className="text-center">
          <p className="text-xs text-neutral-500 tracking-widest uppercase mb-1">tiempo exacto</p>
          <p className="text-neutral-400 text-lg font-mono">{formatRaw(rawSeconds)}</p>
        </div>

        {/* Aviso de mínimo */}
        {isUnderMinimum && (
          <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-2 text-center">
            <p className="text-red-400 text-xs tracking-wide">
              Menos de 1h — se registra como <strong>día en cero</strong>
            </p>
          </div>
        )}

        {/* Tarjeta draggable */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-neutral-500 tracking-widest uppercase">
            {isUnderMinimum ? "arrastra para registrar cero" : "arrastra para registrar"}
          </p>

          <div className="flex items-center gap-6 mt-1">
            <button
              onClick={() => adjust(-1)}
              disabled={qm === 0}
              className="w-10 h-10 rounded-full bg-neutral-800 text-neutral-300 text-lg hover:bg-neutral-700 disabled:opacity-30 transition-colors"
            >
              −
            </button>

            <div
              style={cardStyle}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className={[
                "px-8 py-4 rounded-2xl text-center cursor-grab active:cursor-grabbing select-none touch-none transition-colors duration-150",
                cardBg,
              ].join(" ")}
            >
              <span className="text-3xl font-bold tracking-tight text-white">
                {isUnderMinimum ? "0" : formatQuarterMinutes(qm)}
              </span>
              <div
                className="mt-2 text-xs tracking-widest uppercase text-white/70 transition-opacity duration-150"
                style={{ opacity: progress > 0.15 ? 1 : 0.4 }}
              >
                {progress >= 1 ? "¡suelta!" : "↑ sube"}
              </div>
            </div>

            <button
              onClick={() => adjust(1)}
              className="w-10 h-10 rounded-full bg-neutral-800 text-neutral-300 text-lg hover:bg-neutral-700 transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* Alternativas */}
        <div className="flex gap-3">
          <button
            onClick={() => onConfirm({ hours: 0, status: "zero" })}
            className="flex-1 py-3 rounded-xl bg-neutral-800 text-neutral-400 text-xs tracking-widest uppercase hover:bg-neutral-700 transition-colors"
          >
            Sin nada (0)
          </button>
          <button
            onClick={() => onConfirm({ hours: null, status: "vacation" })}
            className="flex-1 py-3 rounded-xl bg-neutral-800 text-neutral-400 text-xs tracking-widest uppercase hover:bg-neutral-700 transition-colors"
          >
            Vacaciones
          </button>
        </div>
      </div>
    </div>
  );
}
