import Timer from "./Timer.jsx";
import CloseModal from "./CloseModal.jsx";
import { useDayFlow } from "../hooks/useDayFlow.js";

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

  // Cargando
  if (activeRecord === undefined) return null;

  // Día de hoy ya registrado
  if (todayAlreadyClosed) {
    return (
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
  }

  // Sin día abierto
  if (!activeRecord) {
    return (
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
  }

  // Día abierto
  return (
    <>
      <div className="flex flex-col items-center gap-12">
        <p className="text-xs text-neutral-600 tracking-widest uppercase">
          {new Date(`${activeRecord.date}T00:00:00`).toLocaleDateString("es", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>

        <Timer />

        <button
          onClick={requestClose}
          className="px-8 py-2 rounded-full border border-neutral-700 text-neutral-500 text-xs tracking-widest uppercase hover:border-neutral-500 hover:text-neutral-400 transition-all duration-200"
        >
          Cerrar día
        </button>
      </div>

      {closing && (
        <CloseModal
          onConfirm={async (data) => { await confirmClose(data); onDayChange?.(); }}
          onCancel={cancelClose}
        />
      )}
    </>
  );
}
