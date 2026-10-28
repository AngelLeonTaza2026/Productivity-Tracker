import { useEffect, useRef, useState } from "react";
import { pickClosingPhrase } from "../phrases.js";
import { getRecentRecords } from "../db/index.js";
import { getCellBgColor } from "../cellColor.js";

const STRIP_DAYS = 7;
const SUSPENSE_MS = 650;
const REVEAL_TRANSITION_MS = 500;
const AUTO_HIDE_MS = 3400; // cuenta desde que arranca el revelado, no desde el montaje
const DISMISS_FADE_MS = 400;

function buildStripDates(endDateStr, days) {
  const end = new Date(`${endDateStr}T00:00:00`);
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${day}`);
  }
  return dates; // de más viejo a hoy
}

/**
 * Overlay de cierre de día en dos tiempos: suspenso (la celda de hoy respira,
 * como en la tira, sin color todavía) y revelado — la celda se enciende con
 * el color real del resultado, igual que en la vista anual, para que el
 * cierre se sienta conectado con la colección y no una frase flotando sola.
 * Se puede tocar para saltar el suspenso o para descartar el resultado.
 */
export default function ClosingPhrase({ status, date, theme, onDone }) {
  const [phrase] = useState(() => pickClosingPhrase(status));
  const [phase, setPhase] = useState("suspense"); // "suspense" | "reveal" | "hidden"
  const [stripRecords, setStripRecords] = useState({});
  const suspenseTimer = useRef(null);
  const hideTimer = useRef(null);
  const doneTimer = useRef(null);

  useEffect(() => {
    getRecentRecords(date, STRIP_DAYS).then((records) => {
      const map = {};
      records.forEach((r) => { map[r.date] = r; });
      setStripRecords(map);
    });
  }, [date]);

  useEffect(() => {
    suspenseTimer.current = setTimeout(reveal, SUSPENSE_MS);
    return () => {
      clearTimeout(suspenseTimer.current);
      clearTimeout(hideTimer.current);
      clearTimeout(doneTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reveal() {
    clearTimeout(suspenseTimer.current);
    setPhase("reveal");
    hideTimer.current = setTimeout(dismiss, AUTO_HIDE_MS);
  }

  function dismiss() {
    clearTimeout(suspenseTimer.current);
    clearTimeout(hideTimer.current);
    setPhase("hidden");
    doneTimer.current = setTimeout(() => onDone?.(), DISMISS_FADE_MS);
  }

  function handleTap() {
    if (phase === "suspense") reveal();
    else if (phase === "reveal") dismiss();
  }

  const revealed = phase === "reveal";
  const stripDates = buildStripDates(date, STRIP_DAYS);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-10 text-center overflow-hidden"
      style={{
        zIndex: 90,
        backgroundColor: "rgba(10,10,10,0.92)",
        opacity: phase === "hidden" ? 0 : 1,
        transition: `opacity ${DISMISS_FADE_MS}ms ease`,
      }}
      onClick={handleTap}
    >
      <div className="flex flex-col items-center gap-7">
        {/* Tira de los últimos días — hoy se enciende al revelar */}
        <div className="flex items-end gap-2">
          {stripDates.map((d) => {
            const isToday = d === date;
            const color = isToday && !revealed
              ? theme.cells.todayActive
              : getCellBgColor(stripRecords[d], d, date, theme);
            const size = isToday ? 34 : 24;

            return (
              <div
                key={d}
                className="relative flex items-center justify-center"
                style={{ width: size, height: size }}
              >
                {isToday && revealed && (
                  <>
                    <div
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        width: 90,
                        height: 90,
                        background: `radial-gradient(circle, ${color}66, transparent 70%)`,
                        opacity: 1,
                        transition: `opacity ${REVEAL_TRANSITION_MS}ms ease`,
                      }}
                    />
                    <div
                      className="absolute rounded-full border pointer-events-none"
                      style={{
                        width: 40,
                        height: 40,
                        borderColor: color,
                        borderWidth: 1.5,
                        animation: `closing-ring ${REVEAL_TRANSITION_MS * 2}ms ease-out forwards`,
                      }}
                    />
                  </>
                )}
                <div
                  className="rounded-md"
                  style={{
                    width: "100%",
                    height: "100%",
                    backgroundColor: color,
                    animation: isToday && !revealed ? "closing-breathe 1.1s ease-in-out infinite" : "none",
                    transition: `background-color ${REVEAL_TRANSITION_MS}ms ease, width ${REVEAL_TRANSITION_MS}ms ease, height ${REVEAL_TRANSITION_MS}ms ease`,
                  }}
                />
              </div>
            );
          })}
        </div>

        <p
          className="relative text-neutral-100 tracking-wide select-none"
          style={{
            fontSize: "1.15rem",
            lineHeight: 1.5,
            maxWidth: 320,
            opacity: revealed ? 1 : 0,
            transform: `scale(${revealed ? 1 : 0.85}) translateY(${revealed ? 0 : 6}px)`,
            transition: `opacity ${REVEAL_TRANSITION_MS}ms ease, transform ${REVEAL_TRANSITION_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
          }}
        >
          {phrase}
        </p>
      </div>
    </div>
  );
}
