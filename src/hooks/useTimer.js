import { useState, useEffect, useCallback } from "react";
import {
  getTimerState,
  startTimer,
  pauseTimer,
} from "../db/timer.js";

/**
 * Expone solo lo que la UI necesita: si está corriendo, y las acciones.
 * Nunca expone el tiempo transcurrido — esa es la característica central.
 */
export function useTimer() {
  const [isRunning, setIsRunning] = useState(false);
  // No es el tiempo en sí (eso nunca se expone) — solo si el timer ya se
  // inició alguna vez hoy, para distinguir "Iniciar" de "Continuar".
  const [hasAccumulated, setHasAccumulated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Lee el estado persisitido al montar (sobrevive a recarga de página)
  useEffect(() => {
    getTimerState().then((state) => {
      setIsRunning(state.isRunning);
      setHasAccumulated(state.accumulatedSeconds > 0);
      setLoading(false);
    });
  }, []);

  // Al volver de background (pantalla bloqueada, cambio de app), releer el
  // estado real desde Dexie — el timer sigue corriendo por timestamp, esto
  // solo resincroniza isRunning, no cuenta segundos en pantalla.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      getTimerState().then((state) => {
        setIsRunning(state.isRunning);
        setHasAccumulated(state.accumulatedSeconds > 0);
      });
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const start = useCallback(async () => {
    await startTimer();
    setIsRunning(true);
  }, []);

  const pause = useCallback(async () => {
    await pauseTimer();
    setIsRunning(false);
    setHasAccumulated(true);
  }, []);

  return { isRunning, hasAccumulated, loading, start, pause };
}
