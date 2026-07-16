import db from "./index.js";

const TIMER_ID = "active";

/**
 * Devuelve el estado actual del timer, o el estado inicial si no existe.
 */
export async function getTimerState() {
  const state = await db.timerState.get(TIMER_ID);
  return (
    state ?? {
      id: TIMER_ID,
      accumulatedSeconds: 0,
      isRunning: false,
      runningStartedAt: null,
    }
  );
}

/**
 * Arranca el timer. Si ya estaba corriendo no hace nada.
 */
export async function startTimer() {
  const state = await getTimerState();
  if (state.isRunning) return;

  await db.timerState.put({
    ...state,
    isRunning: true,
    runningStartedAt: new Date().toISOString(),
  });
}

/**
 * Pausa el timer. Acumula los segundos del segmento actual.
 */
export async function pauseTimer() {
  const state = await getTimerState();
  if (!state.isRunning) return;

  const segmentSeconds = elapsedSecondsInSegment(state.runningStartedAt);
  await db.timerState.put({
    ...state,
    accumulatedSeconds: state.accumulatedSeconds + segmentSeconds,
    isRunning: false,
    runningStartedAt: null,
  });
}

/**
 * Devuelve el total de segundos acumulados (incluyendo el segmento en curso si está corriendo).
 * Se usa al cerrar el día para pre-llenar las horas.
 */
export async function getTotalSeconds() {
  const state = await getTimerState();
  const extra = state.isRunning
    ? elapsedSecondsInSegment(state.runningStartedAt)
    : 0;
  return state.accumulatedSeconds + extra;
}

/**
 * Reinicia el timer a cero (se llama al abrir un nuevo día).
 */
export async function resetTimer() {
  await db.timerState.put({
    id: TIMER_ID,
    accumulatedSeconds: 0,
    isRunning: false,
    runningStartedAt: null,
  });
}

// ── helpers ───────────────────────────────────────────────────────────────────

function elapsedSecondsInSegment(runningStartedAt) {
  if (!runningStartedAt) return 0;
  return Math.floor((Date.now() - new Date(runningStartedAt).getTime()) / 1000);
}
