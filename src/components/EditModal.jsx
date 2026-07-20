import { useEffect, useRef, useState } from "react";
import { createRecord, updateRecord, deleteRecord } from "../db/index.js";
import { quarterMinutesToHours } from "../utils/time.js";

const ITEM_H  = 58;
const VIS     = 3;
const WHEEL_H = ITEM_H * VIS;
const PAD_H   = ITEM_H;

const HOUR_VALUES = Array.from({ length: 17 }, (_, i) => i);
const MIN_VALUES  = [0, 15, 30, 45];
const MIN_PRODUCTIVE = 60;

const STATUS_OPTS = [
  { key: "productive", color: "#16a34a" },
  { key: "zero",       color: "#dc2626" },
  { key: "rest",       color: "#f59e0b" },
  { key: "vacation",   color: "#7c3aed" },
];

// Clases sutiles del botón de guardar según status efectivo
const SAVE_BTN = {
  productive: "bg-green-950 text-green-500 hover:bg-green-900",
  zero:       "bg-red-950 text-red-500 hover:bg-red-900",
  rest:       "bg-amber-950 text-amber-500 hover:bg-amber-900",
  vacation:   "bg-violet-950 text-violet-500 hover:bg-violet-900",
};

function computeGlow(minutes) {
  if (minutes <= 0) return null;
  if (minutes < MIN_PRODUCTIVE) {
    const t = minutes / MIN_PRODUCTIVE;
    const a = (0.2 + t * 0.45).toFixed(2);
    return `radial-gradient(ellipse 130% 110% at 50% 50%, rgba(185,28,28,${a}) 0%, transparent 68%)`;
  }
  const t = Math.min(1, (minutes - MIN_PRODUCTIVE) / (360 - MIN_PRODUCTIVE));
  const r = Math.round(5   + t * (134 - 5));
  const g = Math.round(46  + t * (239 - 46));
  const b = Math.round(22  + t * (172 - 22));
  const a = (0.52 + t * 0.12).toFixed(2);
  return `radial-gradient(ellipse 130% 110% at 50% 50%, rgba(${r},${g},${b},${a}) 0%, transparent 68%)`;
}

function hoursToHM(hours) {
  if (!hours || hours < 1) return { h: 0, m: 0 };
  const totalMin = Math.round((hours * 60) / 15) * 15;
  return { h: Math.floor(totalMin / 60), m: totalMin % 60 };
}

function fmtDay(dateStr) {
  return new Date(`${dateStr}T00:00:00`)
    .toLocaleDateString("es", { day: "numeric", month: "long" });
}

function fmtWeekday(dateStr) {
  return new Date(`${dateStr}T00:00:00`)
    .toLocaleDateString("es", { weekday: "short" });
}

// ── Rueda ──────────────────────────────────────────────────────────────────
function Wheel({ items, initialValue, onSettle, onLiveChange, label, disabled, scrollToRef }) {
  const scrollRef = useRef(null);
  const timerRef  = useRef(null);
  const settleRef = useRef(onSettle);
  const liveRef   = useRef(onLiveChange);
  useEffect(() => { settleRef.current = onSettle; });
  useEffect(() => { liveRef.current   = onLiveChange; });

  const initIdx = Math.max(0, items.indexOf(initialValue));
  const [scrollTop, setScrollTop] = useState(initIdx * ITEM_H);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = initIdx * ITEM_H;
  }, []);

  useEffect(() => {
    if (scrollToRef) {
      scrollToRef.current = (idx) => {
        if (!scrollRef.current) return;
        scrollRef.current.scrollTop = idx * ITEM_H;
        setScrollTop(idx * ITEM_H);
      };
    }
  }, []);

  function handleScroll(e) {
    const st  = e.target.scrollTop;
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(st / ITEM_H)));
    setScrollTop(st);
    liveRef.current?.(items[idx]);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollTop = idx * ITEM_H;
      settleRef.current(items[idx]);
    }, 120);
  }

  return (
    <div style={{
      position: "relative", flex: 1, height: WHEEL_H, overflow: "hidden",
      opacity: disabled ? 0.15 : 1,
      pointerEvents: disabled ? "none" : "auto",
      transition: "opacity 0.2s ease",
    }}>
      <div style={{
        position: "absolute", left: "10%", right: "10%",
        top: PAD_H, height: ITEM_H, pointerEvents: "none", zIndex: 3,
        borderTop: "1px solid rgba(255,255,255,0.13)",
        borderBottom: "1px solid rgba(255,255,255,0.13)",
      }} />
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3,
        background: "linear-gradient(to bottom, rgb(23,23,23) 0%, rgba(23,23,23,0) 32%, rgba(23,23,23,0) 68%, rgb(23,23,23) 100%)",
      }} />
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="wheel-scroll"
        style={{
          height: "100%", overflowY: "scroll",
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        <div style={{ height: PAD_H }} />
        {items.map((v, i) => {
          const dist  = Math.abs(i - scrollTop / ITEM_H);
          const op    = Math.max(0.07, 1 - dist * 0.54);
          const scale = Math.max(0.55, 1 - dist * 0.22);
          return (
            <div
              key={i}
              style={{
                height: ITEM_H, scrollSnapAlign: "center",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: op,
                transform: `scale(${scale})`,
                transition: "transform 0.05s linear, opacity 0.05s linear",
              }}
            >
              <span style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "1.35rem",
                lineHeight: 1,
                color: "white",
                letterSpacing: "0.04em",
              }}>
                {String(v).padStart(2, "0")}
              </span>
            </div>
          );
        })}
        <div style={{ height: PAD_H }} />
      </div>
      <div style={{
        position: "absolute", bottom: 5, left: 0, right: 0,
        display: "flex", justifyContent: "center",
        pointerEvents: "none", zIndex: 4,
      }}>
        <span style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "0.36rem",
          letterSpacing: "0.22em",
          color: "rgba(255,255,255,0.2)",
        }}>
          {label}
        </span>
      </div>
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────
export default function EditModal({ date, record, onSave, onClose }) {
  const isNew = !record;
  const { h: initH, m: initM } = hoursToHM(record?.hours);

  const [status, setStatus]   = useState(record?.status ?? "productive");
  const [hrs,  setHrs]        = useState(initH);
  const [mins, setMins]       = useState(initM);
  const [liveMin, setLiveMin] = useState(initH * 60 + initM);
  const [saving, setSaving]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hrsRef  = useRef(initH);
  const minsRef = useRef(initM);
  const minsScrollToRef = useRef(null);

  // minsDisabled usa hrs (estado actual, no initH) para evitar bug al remontar
  const minsDisabled = status === "productive" && hrs === 0;
  const underMin     = status === "productive" && liveMin < MIN_PRODUCTIVE;
  const effectiveSt  = underMin ? "zero" : status;
  const glow         = status === "productive" ? computeGlow(liveMin) : null;
  const wheelShown   = status === "productive";

  function onHrsLive(h) { setLiveMin(h * 60 + minsRef.current); }
  function onMinsLive(m) { setLiveMin(hrsRef.current * 60 + m); }

  function onHrsSettle(h) {
    hrsRef.current = h;
    setHrs(h);
    if (h === 0) {
      minsRef.current = 0;
      setMins(0);
      setLiveMin(0);
      minsScrollToRef.current?.(0);
    } else {
      setLiveMin(h * 60 + minsRef.current);
    }
  }
  function onMinsSettle(m) { minsRef.current = m; setMins(m); }

  async function handleSave() {
    setSaving(true);
    const totalQM = hrs * 60 + mins;
    const hours =
      effectiveSt === "vacation" ? null :
      effectiveSt === "rest"     ? null :
      effectiveSt === "zero"     ? 0    :
      quarterMinutesToHours(totalQM);
    const now = new Date().toISOString();
    if (isNew) {
      await createRecord({ date, status: effectiveSt, hours, note: null, closedAt: now });
    } else {
      await updateRecord(record.id, {
        status: effectiveSt, hours,
        note: record.note ?? null,
        closedAt: record.closedAt ?? now,
      });
    }
    onSave();
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setSaving(true);
    await deleteRecord(record.id);
    onSave();
  }

  const saveBtnClass = SAVE_BTN[effectiveSt] ?? "bg-neutral-800 text-neutral-300";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-8 py-14">
      <button
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        onClick={onClose}
        aria-label="Cerrar"
      />

      <div
        className="relative z-10 w-full bg-neutral-900 rounded-3xl px-5 py-5 flex flex-col gap-3"
        style={{
          maxWidth: 272,
          animation: "modal-in 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        }}
      >
        {/* Fecha en pixel art */}
        <div className="text-center pt-1 pb-0.5">
          <p
            className="capitalize text-neutral-200"
            style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "0.68rem", lineHeight: 1.8 }}
          >
            {fmtDay(date)}
          </p>
          <p
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: "0.42rem",
              color: "rgba(255,255,255,0.22)",
              marginTop: 4,
            }}
          >
            ({fmtWeekday(date)})
          </p>
        </div>

        {/* Wheel — transición suave show/hide con max-height + opacity */}
        <div style={{
          maxHeight: wheelShown ? `${WHEEL_H + 8}px` : "0px",
          opacity: wheelShown ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.28s ease, opacity 0.22s ease",
        }}>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: glow ?? "rgb(23,23,23)" }}
          >
            <div className="flex items-center">
              {/* initialValue usa hrs/mins (estado actual), no initH/initM
                  para evitar inconsistencia al remontar tras cambio de status */}
              <Wheel
                items={HOUR_VALUES}
                initialValue={hrs}
                onSettle={onHrsSettle}
                onLiveChange={onHrsLive}
                label="HORAS"
              />
              <span style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "0.95rem",
                color: "rgba(255,255,255,0.2)",
                userSelect: "none",
              }}>
                :
              </span>
              <Wheel
                items={MIN_VALUES}
                initialValue={mins}
                onSettle={onMinsSettle}
                onLiveChange={onMinsLive}
                label="MIN"
                disabled={minsDisabled}
                scrollToRef={minsScrollToRef}
              />
            </div>
          </div>
        </div>

        {/* Swatches de color */}
        <div className="flex justify-center gap-4 py-1">
          {STATUS_OPTS.map(({ key, color }) => (
            <button
              key={key}
              onClick={() => setStatus(key)}
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                backgroundColor: color,
                border: status === key ? "2px solid white" : "2px solid transparent",
                outline: status === key ? `2px solid ${color}` : "none",
                outlineOffset: "2px",
                transform: status === key ? "scale(1.22)" : "scale(1)",
                transition: "transform 0.14s ease, outline 0.14s, border-color 0.14s",
              }}
            />
          ))}
        </div>

        {/* Acciones */}
        <div className="flex gap-2 pt-0.5">
          {!isNew && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className={[
                "px-3 py-2.5 rounded-xl transition-colors",
                confirmDelete
                  ? "bg-red-700 text-white hover:bg-red-600"
                  : "bg-neutral-800 text-red-500 hover:bg-neutral-700",
              ].join(" ")}
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "0.4rem", letterSpacing: "0.1em" }}
            >
              {confirmDelete ? "¿SEGURO?" : "BORRAR"}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className={[
              "flex-1 py-2.5 rounded-xl transition-colors duration-200",
              saveBtnClass,
              saving ? "opacity-50" : "",
            ].join(" ")}
            style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "0.4rem", letterSpacing: "0.1em" }}
          >
            {saving ? "..." : isNew ? "AGREGAR" : "GUARDAR"}
          </button>
        </div>
      </div>
    </div>
  );
}
