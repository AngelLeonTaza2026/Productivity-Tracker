import { useState } from "react";
import { createPortal } from "react-dom";
import Timer from "./Timer.jsx";
import FocusMode from "./FocusMode.jsx";
import CloseModal from "./CloseModal.jsx";
import ClosingPhrase from "./ClosingPhrase.jsx";
import { useDayFlow } from "../hooks/useDayFlow.js";
import { useTimer } from "../hooks/useTimer.js";
import { THEMES } from "../themes.js";
import { NAV_RESERVE } from "../layout.js";

function todayLabel() {
  return new Date().toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// Esquina superior derecha — misma posición que el botón de exportar del
// heatmap, para que la fecha no compita visualmente con el indicador central.
function DateBadge({ children }) {
  return (
    <p
      className="fixed select-none text-neutral-600 text-xs tracking-widest uppercase"
      style={{ top: "max(14px, env(safe-area-inset-top))", right: 14, zIndex: 20 }}
    >
      {children}
    </p>
  );
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 1 0 11 11z" />
    </svg>
  );
}

// Esquina inferior izquierda — opuesta a la fecha, por ENCIMA del anclaje
// de navegación (NAV_RESERVE, definida en layout.js).
function CloseDayButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Cerrar día"
      className="fixed flex flex-col items-center gap-1 text-slate-500 hover:text-slate-300 transition-colors duration-200"
      style={{ bottom: NAV_RESERVE + 14, left: 24, zIndex: 20 }}
    >
      <span className="relative flex items-center justify-center" style={{ width: 34, height: 34 }}>
        <span
          className="absolute inset-0 rounded-full bg-slate-700"
          style={{ animation: "close-pulse 2.6s ease-in-out infinite" }}
        />
        <MoonIcon />
      </span>
      <span className="text-[10px] tracking-widest uppercase">Cerrar día</span>
    </button>
  );
}

export default function DayFlow({ onDayChange, theme = THEMES.default, onRequestLanding, refreshKey, isActive }) {
  const {
    activeRecord,
    todayAlreadyClosed,
    closing,
    openDay,
    forceReopenDay,
    requestClose,
    cancelClose,
    confirmClose,
  } = useDayFlow(refreshKey);

  // Compartido con FocusMode: ambos deben reaccionar al mismo isRunning
  const timer = useTimer();

  // El ritual vive fuera de las ramas de abajo a propósito: si estuviera
  // dentro de la rama "día abierto", desaparecería apenas confirmClose()
  // cambia todayAlreadyClosed y el componente salta a la rama "ya registrado".
  const [closingRecord, setClosingRecord] = useState(null); // DayRecord recién cerrado

  // `content` es lo que vive EN el slot de esta pestaña dentro de World.jsx
  // (se mueve con la cámara). `overlays` es todo lo `fixed`, que se manda
  // a un portal — un ancestro con `transform` (la pista de World.jsx) hace
  // que `position:fixed` deje de posicionarse contra la pantalla real.
  let content = null;
  let overlays = null;

  if (activeRecord === undefined) {
    // Cargando
    content = null;
  } else if (todayAlreadyClosed) {
    // Día de hoy ya registrado
    content = (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-2 h-2 rounded-full bg-green-600 mx-auto" />
        <p className="text-neutral-400 text-sm">Día de hoy ya registrado</p>
        <p className="text-xs text-neutral-600 tracking-widest uppercase">{todayLabel()}</p>
        <p className="text-xs text-neutral-700">Podés editarlo desde la vista anual</p>

        {/* Escape hatch: reabrir si fue un error */}
        <button
          onClick={async () => { await forceReopenDay(); onDayChange?.(); }}
          className="mt-4 text-xs text-neutral-600 hover:text-neutral-400 underline underline-offset-4 transition-colors"
        >
          Empezar de nuevo igual
        </button>
      </div>
    );
  } else if (!activeRecord) {
    // Sin día abierto
    content = (
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={async () => { await openDay(); onDayChange?.(); }}
          className="px-10 py-3 rounded-full bg-amber-700 text-amber-50 text-sm font-medium tracking-widest uppercase hover:bg-amber-600 transition-all duration-200"
        >
          Abrir día
        </button>
      </div>
    );
    overlays = <DateBadge>{todayLabel()}</DateBadge>;
  } else {
    // Día abierto
    content = (
      <div className="flex flex-col items-center gap-12">
        <Timer timer={timer} />
      </div>
    );
    overlays = (
      <>
        <CloseDayButton onClick={requestClose} />

        <DateBadge>
          {new Date(`${activeRecord.date}T00:00:00`).toLocaleDateString("es", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </DateBadge>

        <FocusMode isRunning={timer.isRunning} onPause={timer.pause} />

        {closing && (
          <CloseModal
            onConfirm={async (data) => {
              const updated = await confirmClose(data);
              setClosingRecord(updated ?? {
                date: activeRecord.date,
                status: data.status,
                hours: data.hours,
                closedAt: new Date().toISOString(),
              });
            }}
            onCancel={cancelClose}
          />
        )}
      </>
    );
  }

  return (
    <>
      {content}

      {/* Con las dos vistas siempre montadas, estos overlays `fixed` (sobre
          todo FocusMode, que tapa toda la pantalla) tienen que ocultarse
          solos al dejar de ser la pestaña activa — si no, quedarían
          flotando encima de la otra vista al cambiar. */}
      {isActive && overlays && createPortal(overlays, document.body)}

      {isActive && closingRecord && createPortal(
        <ClosingPhrase
          record={closingRecord}
          theme={theme}
          onRequestLanding={onRequestLanding}
          onDone={() => {
            setClosingRecord(null);
            onDayChange?.();
          }}
        />,
        document.body
      )}
    </>
  );
}
