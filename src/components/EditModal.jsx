import { useEffect, useRef, useState } from "react";
import { createRecord, updateRecord, deleteRecord } from "../db/index.js";
import { quarterMinutesToHours } from "../utils/time.js";

const ITEM_H = 64;
const HOUR_VALUES = Array.from({ length: 17 }, (_, i) => i); // 0–16 h
const MIN_VALUES  = [0, 15, 30, 45];
const MIN_PRODUCTIVE = 60;

const STATUS_OPTS = [
  { key: "productive", color: "#16a34a" },
  { key: "zero",       color: "#dc2626" },
  { key: "rest",       color: "#f59e0b" },
  { key: "vacation",   color: "#7c3aed" },
];

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
      position: "relative", flex: 1, height: ITEM_H * 5, overflow: "hidden",
      opacity: disabled ? 0.18 : 1,
      pointerEvents: disabled ? "none" : "auto",
      transition: "opacity 0.2s ease",
    }}>
      {/* Selection lines */}
      <div style={{
        position: "absolute", left: "10%", right: "10%",
        top: ITEM_H * 2, height: ITEM_H, pointerEvents: "none", zIndex: 3,
        borderTop: "1px solid rgba(255,255,255,0.15)",
        borderBottom: "1px solid rgba(255,255,255,0.15)",
      }} />
      {/* Fade mask */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3,
        background: "linear-gradient(to bottom, rgb(23,23,23) 0%, rgba(23,23,23,0) 25%, rgba(23,23,23,0) 75%, rgb(23,23,23) 100%)",
      }} />
      {/* Scroll list */}
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
        <div style={{ height: ITEM_H * 2 }} />
        {items.map((v, i) => {
          const dist  = Math.abs(i - scrollTop / ITEM_H);
          const op    = Math.max(0.08, 1 - dist * 0.42);
          const scale = Math.max(0.5,  1 - dist * 0.20);
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
                fontSize: "1.45rem",
                lineHeight: 1,
                color: "white",
                letterSpacing: "0.04em",
                imageRendering: "pixelated",
              }}>
                {String(v).padStart(2, "0")}
              </span>
            </div>
          );
        })}
        <div style={{ height: ITEM_H * 2 }} />
      </div>
      {/* Unit label */}
      <div style={{
        position: "absolute", bottom: ITEM_H * 1.75, left: 0, right: 0,
        display: "flex", justifyContent: "center",
        pointerEvents: "none", zIndex: 4,
      }}>
        <span style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "0.38rem",
          letterSpacing: "0.22em",
          color: "rgba(255,255,255,0.28)",
        }}>
          {label}
        </span>
      </div>
    </div>
  );
}

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

  const minsDisabled = status === "productive" && hrs === 0;
  const underMin     = status === "productive" && liveMin < MIN_PRODUCTIVE;
  const effectiveSt  = underMin ? "zero" : status;
  const glow         = status === "productive" ? computeGlow(liveMin) : null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />

      <div
        className="relative z-10 w-full max-w-sm bg-neutral-900 rounded-t-3xl sm:rounded-2xl px-6 pt-5 flex flex-col gap-4"
        style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-neutral-700 mx-auto sm:hidden" />

        {/* Wheel — solo si productive */}
        {status === "productive" && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: glow ?? "rgba(23,23,23,0.5)" }}
          >
            <div className="flex items-center">
              <Wheel
                items={HOUR_VALUES}
                initialValue={initH}
                onSettle={onHrsSettle}
                onLiveChange={onHrsLive}
                label="HORAS"
              />
              <span style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "1.1rem",
                color: "rgba(255,255,255,0.22)",
                userSelect: "none",
              }}>
                :
              </span>
              <Wheel
                items={MIN_VALUES}
                initialValue={initM}
                onSettle={onMinsSettle}
                onLiveChange={onMinsLive}
                label="MIN"
                disabled={minsDisabled}
                scrollToRef={minsScrollToRef}
              />
            </div>
          </div>
        )}

        {/* Color swatches — selector de status */}
        <div className="flex justify-center gap-5 py-1">
          {STATUS_OPTS.map(({ key, color }) => (
            <button
              key={key}
              onClick={() => setStatus(key)}
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                backgroundColor: color,
                border: status === key ? "2.5px solid white" : "2.5px solid transparent",
                outline: status === key ? `2px solid ${color}` : "none",
                outlineOffset: "2px",
                transform: status === key ? "scale(1.2)" : "scale(1)",
                transition: "transform 0.12s ease, outline 0.12s, border-color 0.12s",
              }}
            />
          ))}
        </div>

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
              {confirmDelete ? "¿Seguro?" : "Borrar"}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className={[
              "flex-1 py-3 rounded-xl text-xs tracking-widest uppercase transition-colors",
              underMin
                ? "bg-red-800 text-red-200 hover:bg-red-700"
                : "bg-green-700 text-white hover:bg-green-600",
              saving ? "opacity-50" : "",
            ].join(" ")}
          >
            {saving ? "…" : isNew ? "Agregar" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
