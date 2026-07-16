import { useEffect, useRef, useState } from "react";
import { createRecord, updateRecord, deleteRecord } from "../db/index.js";
import { quarterMinutesToHours } from "../utils/time.js";

// ── Constantes ─────────────────────────────────────────────────────────────
const ITEM_H = 54;                                        // altura px por ítem en la rueda
const HOUR_VALUES = Array.from({ length: 17 }, (_, i) => i); // 0–16 h
const MIN_VALUES  = [0, 15, 30, 45];
const MIN_PRODUCTIVE = 60;                                // mínimo para contar como productivo

// ── Helpers ────────────────────────────────────────────────────────────────

function toDisplayDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("es", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function hoursToHM(hours) {
  if (!hours) return { h: 1, m: 0 }; // default 1h al abrir
  const totalMin = Math.round((hours * 60) / 15) * 15;
  return { h: Math.floor(totalMin / 60), m: totalMin % 60 };
}

// Devuelve el color del resplandor según los minutos productivos
function glowColor(minutes) {
  if (minutes < MIN_PRODUCTIVE) return null;
  if (minutes < 180) return "rgba(20, 83, 45, 0.55)";   // 1–2h — verde oscuro
  if (minutes < 300) return "rgba(22, 163, 74, 0.50)";  // 3–4h — verde medio
  return "rgba(74, 222, 128, 0.38)";                     // 5h+  — verde brillante
}

// ── Componente de rueda ────────────────────────────────────────────────────

function Wheel({ items, initialValue, onSettle, onLiveChange, renderItem }) {
  const scrollRef  = useRef(null);
  const timerRef   = useRef(null);
  const settleRef  = useRef(onSettle);
  const liveRef    = useRef(onLiveChange);

  // Mantiene las callbacks siempre actualizadas sin re-registrar el listener
  useEffect(() => { settleRef.current = onSettle; });
  useEffect(() => { liveRef.current   = onLiveChange; });

  const initIdx = Math.max(0, items.indexOf(initialValue));

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = initIdx * ITEM_H;
    }
  }, []);

  function handleScroll(e) {
    const raw     = e.target.scrollTop / ITEM_H;
    const idx     = Math.max(0, Math.min(items.length - 1, Math.round(raw)));
    liveRef.current?.(items[idx]);

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollTop = idx * ITEM_H; // snap exacto
      settleRef.current(items[idx]);
    }, 120);
  }

  return (
    <div style={{ position: "relative", flex: 1, height: ITEM_H * 5, overflow: "hidden" }}>

      {/* Líneas de selección */}
      <div style={{
        position: "absolute", left: 0, right: 0,
        top: ITEM_H * 2, height: ITEM_H, pointerEvents: "none", zIndex: 2,
        borderTop: "1px solid rgba(255,255,255,0.12)",
        borderBottom: "1px solid rgba(255,255,255,0.12)",
      }} />

      {/* Degradado que difumina ítems arriba y abajo */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2,
        background: "linear-gradient(to bottom, rgb(23,23,23) 0%, rgba(23,23,23,0) 28%, rgba(23,23,23,0) 72%, rgb(23,23,23) 100%)",
      }} />

      {/* Lista scrolleable */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="wheel-scroll"
        style={{
          height: "100%",
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        <div style={{ height: ITEM_H * 2 }} />
        {items.map((v, i) => (
          <div
            key={i}
            style={{ height: ITEM_H, scrollSnapAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {renderItem
              ? renderItem(v)
              : <span className="text-3xl font-mono font-bold text-white">{String(v).padStart(2, "0")}</span>
            }
          </div>
        ))}
        <div style={{ height: ITEM_H * 2 }} />
      </div>
    </div>
  );
}

// ── Modal principal ────────────────────────────────────────────────────────

export default function EditModal({ date, record, onSave, onClose }) {
  const isNew = !record;
  const { h: initH, m: initM } = hoursToHM(record?.hours);

  const [status, setStatus] = useState(record?.status ?? "productive");
  const [hrs,  setHrs]  = useState(initH);
  const [mins, setMins] = useState(initM);
  const [liveMin, setLiveMin] = useState(initH * 60 + initM);
  const [note, setNote] = useState(record?.note ?? "");
  const [saving, setSaving]             = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Refs para que los callbacks de rueda lean valores siempre frescos
  const hrsRef  = useRef(initH);
  const minsRef = useRef(initM);

  const totalQM     = hrs * 60 + mins;
  const underMin    = status === "productive" && liveMin < MIN_PRODUCTIVE;
  const effectiveSt = underMin ? "zero" : status;
  const glow        = status === "productive" ? glowColor(liveMin) : null;

  function onHrsLive(h)  { setLiveMin(h * 60 + minsRef.current); }
  function onMinsLive(m) { setLiveMin(hrsRef.current * 60 + m); }
  function onHrsSettle(h)  { hrsRef.current  = h; setHrs(h); }
  function onMinsSettle(m) { minsRef.current = m; setMins(m); }

  async function handleSave() {
    setSaving(true);
    const hours =
      effectiveSt === "vacation" ? null :
      effectiveSt === "rest"     ? null :
      effectiveSt === "zero"     ? 0    :
      quarterMinutesToHours(totalQM);
    const now = new Date().toISOString();
    if (isNew) {
      await createRecord({ date, status: effectiveSt, hours, note: note || null, closedAt: now });
    } else {
      await updateRecord(record.id, { status: effectiveSt, hours, note: note || null, closedAt: record.closedAt ?? now });
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
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />

      <div
        className="relative z-10 w-full max-w-sm bg-neutral-900 rounded-t-3xl sm:rounded-2xl px-6 pt-5 flex flex-col gap-5"
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

        {/* Wheel time picker — solo productivo */}
        {status === "productive" && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: glow
                ? `radial-gradient(ellipse 110% 100% at 50% 50%, ${glow} 0%, transparent 70%)`
                : "rgba(23,23,23,0.6)",
              transition: "background 0.5s ease",
            }}
          >
            {underMin && (
              <p className="text-center text-xs text-red-400 pt-3 tracking-wide">
                Menos de 1h — se guardará como cero
              </p>
            )}

            {/* Ruedas */}
            <div className="flex items-center px-6 py-1">
              <Wheel
                items={HOUR_VALUES}
                initialValue={initH}
                onSettle={onHrsSettle}
                onLiveChange={onHrsLive}
              />
              <span className="text-neutral-500 text-base px-1 select-none">h</span>
              <Wheel
                items={MIN_VALUES}
                initialValue={initM}
                onSettle={onMinsSettle}
                onLiveChange={onMinsLive}
                renderItem={(v) => (
                  <span className="text-3xl font-mono font-bold text-white">
                    {String(v).padStart(2, "0")}
                  </span>
                )}
              />
              <span className="text-neutral-500 text-xs tracking-widest uppercase pl-1 select-none">
                min
              </span>
            </div>
          </div>
        )}

        {/* Nota */}
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
              underMin
                ? "bg-red-700 text-white hover:bg-red-600"
                : "bg-green-600 text-white hover:bg-green-500",
              saving ? "opacity-50" : "",
            ].join(" ")}
          >
            {saving ? "Guardando…" : underMin ? "Guardar como cero" : isNew ? "Agregar" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
