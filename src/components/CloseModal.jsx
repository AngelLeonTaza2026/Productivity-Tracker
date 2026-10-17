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
const DIAL_STEP_RAD = Math.PI / 5; // ~36° por paso de ajuste

function GearIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 8a4 4 0 100 8 4 4 0 000-8zm8.94 3a7.97 7.97 0 00-.26-1.94l1.92-1.5-1.5-2.6-2.26.76a8.07 8.07 0 00-1.68-.98L16.7 2h-3l-.46 2.74a8.07 8.07 0 00-1.68.98l-2.26-.76-1.5 2.6 1.92 1.5A7.97 7.97 0 008 11c0 .66.1 1.3.26 1.94l-1.92 1.5 1.5 2.6 2.26-.76c.5.4 1.06.74 1.68.98L12.3 20h3l.46-2.74c.62-.24 1.18-.58 1.68-.98l2.26.76 1.5-2.6-1.92-1.5c.16-.64.26-1.28.26-1.94z" />
    </svg>
  );
}

// Perilla giratoria para ajustar el tiempo: girar en sentido horario suma,
// sentido antihorario resta. Reemplaza los botones +/- planos.
function TimeDial({ onAdjust }) {
  const dialRef = useRef(null);
  const lastAngle = useRef(null);
  const accum = useRef(0);
  const [spin, setSpin] = useState(0); // rotación visual continua, solo estética

  function angleFromEvent(e) {
    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(e.clientY - cy, e.clientX - cx);
  }

  function onPointerDown(e) {
    dialRef.current.setPointerCapture(e.pointerId);
    lastAngle.current = angleFromEvent(e);
    accum.current = 0;
  }

  function onPointerMove(e) {
    if (lastAngle.current === null) return;
    const angle = angleFromEvent(e);
    let delta = angle - lastAngle.current;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    lastAngle.current = angle;
    accum.current += delta;
    setSpin((s) => s + delta * (180 / Math.PI));

    while (accum.current >= DIAL_STEP_RAD) {
      onAdjust(1);
      accum.current -= DIAL_STEP_RAD;
    }
    while (accum.current <= -DIAL_STEP_RAD) {
      onAdjust(-1);
      accum.current += DIAL_STEP_RAD;
    }
  }

  function onPointerUp(e) {
    lastAngle.current = null;
    try { dialRef.current.releasePointerCapture(e.pointerId); } catch { /* no-op */ }
  }

  return (
    <div
      ref={dialRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="slider"
      aria-label="Girar para ajustar el tiempo"
      className="relative w-16 h-16 rounded-full bg-neutral-800 border border-neutral-700 touch-none select-none cursor-grab active:cursor-grabbing flex items-center justify-center"
      style={{
        backgroundImage:
          "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.05) 0deg 8deg, transparent 8deg 24deg)",
      }}
    >
      <div className="absolute inset-0" style={{ transform: `rotate(${spin}deg)` }}>
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-neutral-400" />
      </div>
      <span className="text-neutral-600 pointer-events-none">
        <GearIcon size={18} />
      </span>
    </div>
  );
}

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

  // Los valores entre 0 y 1h se registran todos igual (status "zero"), así
  // que no tiene sentido pararse en 15/30/45min al ajustar: desde 0 el "+"
  // salta directo a 1h, y desde 1h el "−" vuelve directo a 0.
  function adjust(delta) {
    setQm((prev) => {
      if (delta > 0) {
        if (prev === 0) return MIN_PRODUCTIVE_MINUTES;
        return prev + 15;
      }
      if (prev <= MIN_PRODUCTIVE_MINUTES) return 0;
      return prev - 15;
    });
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

          <div
            style={cardStyle}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className={[
              "w-36 py-4 rounded-2xl text-center cursor-grab active:cursor-grabbing select-none touch-none transition-colors duration-150 mt-1",
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

          <TimeDial onAdjust={adjust} />
          <p className="text-[10px] text-neutral-600 tracking-widest uppercase">girá para ajustar</p>
        </div>

        {/* Alternativas */}
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm({ hours: 0, status: "zero" })}
            className="flex-1 py-3 rounded-xl bg-neutral-800 text-neutral-400 text-xs tracking-widest uppercase hover:bg-neutral-700 transition-colors"
          >
            Cero
          </button>
          <button
            onClick={() => onConfirm({ hours: null, status: "rest" })}
            className="flex-1 py-3 rounded-xl bg-amber-900/40 text-amber-500 text-xs tracking-widest uppercase hover:bg-amber-900/60 transition-colors"
          >
            Descanso
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
