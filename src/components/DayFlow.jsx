import { useState } from "react";
import Timer from "./Timer.jsx";
import FocusMode from "./FocusMode.jsx";
import CloseModal from "./CloseModal.jsx";
import ClosingPhrase from "./ClosingPhrase.jsx";
import { useDayFlow } from "../hooks/useDayFlow.js";
import { useTimer } from "../hooks/useTimer.js";

function todayLabel() {
  return new Date().toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function DayFlow({ onDayChange }) {
  const {
    activeRecord,
    todayAlreadyClosed,
    closing,
    openDay,
    forceReopenDay,
    requestClose,
    cancelClose,
    confirmClose,
  } = useDayFlow();

  // Compartido con FocusMode: ambos deben reaccionar al mismo isRunning
  const timer = useTimer();

  // La frase vive fuera de las ramas de abajo a propósito: si estuviera
  // dentro de la rama "día abierto", desaparecería apenas confirmClose()
  // cambia todayAlreadyClosed y el componente salta a la rama "ya registrado".
  const [closingPhraseStatus, setClosingPhraseStatus] = useState(null);

  let content = null;

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
          className="px-10 py-3 rounded-full bg-green-600 text-white text-sm font-medium tracking-widest uppercase hover:bg-green-500 transition-all duration-200"
        >
          Abrir día
        </button>
        <p className="text-xs text-neutral-600 tracking-widest uppercase">{todayLabel()}</p>
      </div>
    );
  } else {
    // Día abierto
    content = (
      <>
        <div className="flex flex-col items-center gap-12">
          <p className="text-xs text-neutral-600 tracking-widest uppercase">
            {new Date(`${activeRecord.date}T00:00:00`).toLocaleDateString("es", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>

          <Timer timer={timer} />

          <button
            onClick={requestClose}
            className="px-8 py-2 rounded-full border border-neutral-700 text-neutral-500 text-xs tracking-widest uppercase hover:border-neutral-500 hover:text-neutral-400 transition-all duration-200"
          >
            Cerrar día
          </button>
        </div>

        <FocusMode isRunning={timer.isRunning} onPause={timer.pause} />

        {closing && (
          <CloseModal
            onConfirm={async (data) => {
              const updated = await confirmClose(data);
              setClosingPhraseStatus(updated?.status ?? data.status);
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

      {closingPhraseStatus && (
        <ClosingPhrase
          status={closingPhraseStatus}
          onDone={() => {
            setClosingPhraseStatus(null);
            onDayChange?.();
          }}
        />
      )}
    </>
  );
}
