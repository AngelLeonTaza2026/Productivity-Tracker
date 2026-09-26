import { useEffect, useRef, useState } from "react";
import { pickClosingPhrase } from "../phrases.js";

const AUTO_HIDE_MS = 3500;
const FADE_MS = 400;

/**
 * Overlay de una sola frase, elegida al azar según el status del día recién
 * cerrado. Se desvanece sola o al tocar la pantalla.
 */
export default function ClosingPhrase({ status, onDone }) {
  const [phrase] = useState(() => pickClosingPhrase(status));
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef(null);
  const doneTimer = useRef(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    hideTimer.current = setTimeout(dismiss, AUTO_HIDE_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(hideTimer.current);
      clearTimeout(doneTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    clearTimeout(hideTimer.current);
    setVisible(false);
    doneTimer.current = setTimeout(() => onDone?.(), FADE_MS);
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-10 text-center"
      style={{
        zIndex: 90,
        backgroundColor: "rgba(10,10,10,0.88)",
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
      onClick={dismiss}
    >
      <p
        className="text-neutral-100 tracking-wide select-none"
        style={{ fontSize: "1.15rem", lineHeight: 1.5, maxWidth: 320 }}
      >
        {phrase}
      </p>
    </div>
  );
}
