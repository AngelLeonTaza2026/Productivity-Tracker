/**
 * Formatea segundos totales en texto legible: "3h 07min", "45min", "30s"
 */
export function formatRaw(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}min`;
  return `${totalSeconds}s`;
}

/**
 * Devuelve el tiempo sugerido en minutos, redondeado al cuarto de hora más cercano.
 * Regla: si faltan ≤ 3 min para el siguiente cuarto, sube; si no, queda en el cuarto de abajo.
 *
 * Ejemplos:
 *   3h 07min (187min) → 3h   (faltan 8 min para 3h15 → queda abajo)
 *   2h 58min (178min) → 3h   (faltan 2 min para 3h → sube)
 *   3h 12min (192min) → 3h 15min (faltan 3 min → sube)
 */
export function suggestQuarterMinutes(totalSeconds) {
  const totalMinutes = totalSeconds / 60;
  const quarterBelow = Math.floor(totalMinutes / 15) * 15;
  const quarterAbove = quarterBelow + 15;
  const minutesToNext = quarterAbove - totalMinutes;
  return minutesToNext <= 3 ? quarterAbove : quarterBelow;
}

/**
 * Formatea minutos en cuartos de hora: 180 → "3h", 195 → "3h 15min"
 */
export function formatQuarterMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

/**
 * Convierte minutos a horas decimales para guardar en DB: 195 → 3.25
 */
export function quarterMinutesToHours(minutes) {
  return minutes / 60;
}
