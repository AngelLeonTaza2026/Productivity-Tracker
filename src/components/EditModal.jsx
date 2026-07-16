import { useState } from "react";
import { createRecord, updateRecord, deleteRecord } from "../db/index.js";
import { formatQuarterMinutes, quarterMinutesToHours } from "../utils/time.js";

const MIN_PRODUCTIVE_MINUTES = 60;

function toDisplayDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function hoursToQM(hours) {
  if (hours == null || hours === 0) return 60; // default 1h al editar
  return Math.round((hours * 60) / 15) * 15;
}

export default function EditModal({ date, record, onSave, onClose }) {
  const isNew = !record;

  const [status, setStatus] = useState(record?.status ?? "productive");
  const [qm, setQm] = useState(
    isNew ? 60 : hoursToQM(record?.hours) // default 1h mínimo al abrir
  );
  const [note, setNote] = useState(record?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Regla: si es productivo y < 1h, se fuerza a cero
  const underMinimum = status === "productive" && qm < MIN_PRODUCTIVE_MINUTES;
  const effectiveStatus = underMinimum ? "zero" : status;

  function adjustQm(delta) {
    setQm((prev) => Math.max(0, prev + delta * 15));
  }

  async function handleSave() {
    setSaving(true);
    const finalStatus = effectiveStatus;
    const hours =
      finalStatus === "vacation" ? null :
      finalStatus === "rest"     ? null :
      finalStatus === "zero"     ? 0 :
      quarterMinutesToHours(qm);

    const now = new Date().toISOString();
    if (isNew) {
      await createRecord({ date, status: finalStatus, hours, note: note || null, closedAt: now });
    } else {
      // Siempre sella closedAt al editar manualmente — evita estado "abierto" en días pasados
      const closedAt = record.closedAt ?? now;
      await updateRecord(record.id, { status: finalStatus, hours, note: note || null, closedAt });
    }
    onSave();
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setSaving(true);
    await deleteRecord(record.id);
    onSave();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Cerrar"
      />

      <div className="relative z-10 w-full max-w-sm bg-neutral-900 rounded-t-3xl sm:rounded-2xl px-6 pt-5 pb-10 sm:pb-6 flex flex-col gap-5"
        style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-neutral-700 mx-auto sm:hidden" />

        {/* Fecha */}
        <div>
          <p className="text-xs text-neutral-500 tracking-widest uppercase">
            {isNew ? "Agregar registro" : "Editar registro"}
          </p>
          <p className="text-neutral-300 text-sm mt-1 capitalize">{toDisplayDate(date)}</p>
        </div>

        {/* Status */}
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: "productive", label: "Productivo" },
            { key: "zero",       label: "Cero" },
            { key: "rest",       label: "Descanso" },
            { key: "vacation",   label: "Vacaciones" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatus(key)}
              className={[
                "flex-1 py-2 rounded-xl text-xs tracking-widest uppercase transition-colors",
                status === key
                  ? "bg-neutral-600 text-white"
                  : "bg-neutral-800 text-neutral-500 hover:bg-neutral-700",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Selector de horas — solo cuando es productivo */}
        {status === "productive" && (
          <>
            <div className={[
              "flex items-center justify-between rounded-xl px-4 py-3 transition-colors",
              underMinimum ? "bg-red-950 border border-red-900" : "bg-neutral-800",
            ].join(" ")}>
              <button
                onClick={() => adjustQm(-1)}
                disabled={qm === 0}
                className="w-9 h-9 rounded-full bg-neutral-700 text-neutral-300 text-lg hover:bg-neutral-600 disabled:opacity-30 transition-colors"
              >
                −
              </button>
              <span className={[
                "text-xl font-bold transition-colors",
                underMinimum ? "text-red-400" : "text-white",
              ].join(" ")}>
                {formatQuarterMinutes(qm)}
              </span>
              <button
                onClick={() => adjustQm(1)}
                className="w-9 h-9 rounded-full bg-neutral-700 text-neutral-300 text-lg hover:bg-neutral-600 transition-colors"
              >
                +
              </button>
            </div>

            {/* Aviso mínimo */}
            {underMinimum && (
              <p className="text-xs text-red-500 text-center -mt-2">
                Menos de 1h — se guarda como día en cero
              </p>
            )}
          </>
        )}

        {/* Nota opcional */}
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota (opcional)"
          className="bg-neutral-800 text-neutral-300 placeholder-neutral-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-600"
        />

        {/* Acciones */}
        <div className="flex gap-2">
          {!isNew && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className={[
                "px-4 py-3 rounded-xl text-xs tracking-widest uppercase transition-colors",
                confirmDelete
                  ? "bg-red-700 text-white hover:bg-red-600"
                  : "bg-neutral-800 text-red-500 hover:bg-neutral-700",
              ].join(" ")}
            >
              {confirmDelete ? "¿Confirmar?" : "Borrar"}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className={[
              "flex-1 py-3 rounded-xl text-xs tracking-widest uppercase transition-colors",
              underMinimum
                ? "bg-red-700 text-white hover:bg-red-600"
                : "bg-green-600 text-white hover:bg-green-500",
              saving ? "opacity-50" : "",
            ].join(" ")}
          >
            {saving ? "Guardando…" : underMinimum ? "Guardar como cero" : isNew ? "Agregar" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
