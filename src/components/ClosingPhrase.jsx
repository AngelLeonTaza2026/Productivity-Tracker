import { useEffect, useRef, useState } from "react";
import { pickClosingPhrase } from "../phrases.js";
import { getCellBgColor } from "../cellColor.js";

const CARD_W = 168;
const CARD_H = 224;
const DRAG_THRESHOLD = 6; // px — por debajo de esto, un pointerup cuenta como tap

const SUSPENSE_MS = 650;
const SLAM_MS = 420;
const REVEAL_HOLD_MS = 3200; // se auto-transporta si no tocás nada
const TRANSPORT_MS = 300;

function dateLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("es", { day: "numeric", month: "short" }).replace(".", "");
}

function formatHoursLabel(hours) {
  const totalMin = Math.round((hours ?? 0) * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function mainLabel(record) {
  if (record.status === "rest") return "Descanso";
  if (record.status === "vacation") return "Vacaciones";
  if (record.status === "zero") return "0";
  return formatHoursLabel(record.hours);
}

/**
 * Ritual de cierre de día: suspenso → golpe de revelado (estilo "lista negra"
 * de carrera, streaks + flash) → tarjeta inclinable en 3D con el resultado →
 * transporte a la celda real en la vista anual (la propia Heatmap.jsx hace
 * el aterrizaje, acá solo se entrega la posta con el color y la fecha).
 */
export default function ClosingPhrase({ record, theme, onDone, onRequestLanding }) {
  const [phrase] = useState(() => pickClosingPhrase(record.status));
  const [phase, setPhase] = useState("suspense"); // suspense | slam | reveal | transporting
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  const cardRef = useRef(null);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const timers = useRef({});

  const color = getCellBgColor(record, record.date, record.date, theme);

  function clearTimer(key) { clearTimeout(timers.current[key]); }

  useEffect(() => {
    timers.current.suspense = setTimeout(startSlam, SUSPENSE_MS);
    return () => Object.values(timers.current).forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startSlam() {
    clearTimer("suspense");
    setPhase("slam");
    timers.current.slam = setTimeout(startReveal, SLAM_MS);
  }

  function startReveal() {
    clearTimer("slam");
    setPhase("reveal");
    restartAutoTimer();
  }

  function restartAutoTimer() {
    clearTimer("auto");
    timers.current.auto = setTimeout(startTransport, REVEAL_HOLD_MS);
  }

  function startTransport() {
    clearTimer("auto");
    setPhase("transporting");
    timers.current.transport = setTimeout(() => {
      onRequestLanding?.(record.date, color);
      onDone?.();
    }, TRANSPORT_MS);
  }

  function handleBackdropClick() {
    if (phase === "suspense") startSlam();
  }

  function handleCardPointerDown(e) {
    if (phase !== "reveal") return;
    dragging.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
    clearTimer("auto");
    cardRef.current?.setPointerCapture?.(e.pointerId);
  }

  function handleCardPointerMove(e) {
    if (phase !== "reveal") return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (!dragging.current && Math.hypot(dx, dy) > DRAG_THRESHOLD) dragging.current = true;
    if (!dragging.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({ rx: -(y - 0.5) * 22, ry: (x - 0.5) * 22 });
  }

  function endCardDrag() {
    const wasDragging = dragging.current;
    dragging.current = false;
    setTilt({ rx: 0, ry: 0 });
    if (phase === "reveal") {
      if (wasDragging) restartAutoTimer();
      else startTransport(); // tap sin arrastre: confirmar ya
    }
  }

  const showContent = phase !== "suspense";
  const tiltEnabled = phase === "reveal";
  const shine = `linear-gradient(${115 + tilt.ry * 1.5}deg, transparent 30%, rgba(255,255,255,${0.12 + (Math.abs(tilt.rx) + Math.abs(tilt.ry)) / 140}) 50%, transparent 70%)`;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{
        zIndex: 90,
        backgroundColor: "rgba(10,10,10,0.92)",
        transition: "background-color 200ms ease",
      }}
      onClick={handleBackdropClick}
    >
      <div className="flex flex-col items-center gap-4" style={{ opacity: phase === "transporting" ? 0 : 1, transition: "opacity 200ms ease" }}>
        <div
          ref={cardRef}
          onPointerDown={handleCardPointerDown}
          onPointerMove={handleCardPointerMove}
          onPointerUp={endCardDrag}
          onPointerCancel={endCardDrag}
          onPointerLeave={() => dragging.current && endCardDrag()}
          className="relative select-none touch-none"
          style={{
            width: CARD_W,
            height: CARD_H,
            borderRadius: 20,
            backgroundColor: showContent ? color : theme.cells.todayActive,
            overflow: "hidden",
            cursor: tiltEnabled ? "grab" : "default",
            transform: `perspective(700px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
            transition: dragging.current
              ? "none"
              : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1), background-color 200ms ease",
            animation: phase === "suspense"
              ? "card-breathe 1.3s ease-in-out infinite"
              : phase === "slam"
              ? `nfs-punch ${SLAM_MS}ms cubic-bezier(0.2,0.8,0.2,1) forwards`
              : undefined,
            boxShadow: showContent ? `0 8px 30px -8px ${color}99` : "none",
          }}
        >
          {/* brillo holográfico, sigue el tilt */}
          {showContent && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: shine, mixBlendMode: "overlay" }}
            />
          )}

          {/* viñeta inferior para legibilidad del texto */}
          {showContent && (
            <div
              className="absolute left-0 right-0 bottom-0 pointer-events-none"
              style={{ height: "58%", background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)" }}
            />
          )}

          {showContent && (
            <div
              className="absolute left-0 right-0 bottom-0 pb-5 px-4 text-center"
              style={{ color: "white", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}
            >
              <p className="text-[0.65rem] tracking-widest uppercase opacity-80">{dateLabel(record.date)}</p>
              <p className="text-2xl font-bold mt-1">{mainLabel(record)}</p>
            </div>
          )}
        </div>

        {phase === "reveal" && (
          <>
            <p className="text-neutral-100 tracking-wide select-none text-center" style={{ fontSize: "1rem", maxWidth: 280 }}>
              {phrase}
            </p>
            <p className="text-[10px] text-neutral-500 tracking-widest uppercase">tocá la carta para continuar</p>
          </>
        )}
      </div>

      {/* Golpe de revelado — streaks + flash, estilo lista negra de carrera */}
      {phase === "slam" && (
        <div className="fixed inset-0 pointer-events-none">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute left-0 right-0"
              style={{
                top: `${16 + i * 22}%`,
                height: i % 2 === 0 ? 10 : 5,
                background: `linear-gradient(90deg, transparent, ${color}, white, ${color}, transparent)`,
                filter: "blur(2px)",
                opacity: 0,
                animation: `nfs-streak 420ms ease-out ${i * 35}ms forwards`,
              }}
            />
          ))}
          <div className="absolute inset-0 bg-white" style={{ animation: "nfs-flash 380ms ease-out forwards" }} />
        </div>
      )}

      {/* Entrega de la posta: el color llena la pantalla, Heatmap sigue desde ahí */}
      {phase === "transporting" && (
        <div
          className="fixed inset-0"
          style={{ backgroundColor: color, animation: `nfs-flash-in ${TRANSPORT_MS}ms ease-in forwards` }}
        />
      )}
    </div>
  );
}
