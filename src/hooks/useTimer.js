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
  const [loading, setLoading] = useState(true);

  // Lee el estado persisitido al montar (sobrevive a recarga de página)
  useEffect(() => {
    getTimerState().then((state) => {
      setIsRunning(state.isRunning);
      setLoading(false);
    });
  }, []);

  const start = useCallback(async () => {
    await startTimer();
    setIsRunning(true);
  }, []);

  const pause = useCallback(async () => {
    await pauseTimer();
    setIsRunning(false);
  }, []);

  return { isRunning, loading, start, pause };
}
