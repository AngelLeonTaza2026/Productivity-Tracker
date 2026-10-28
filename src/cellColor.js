// Color de una celda del heatmap según su registro — compartido entre la
// vista anual (Heatmap.jsx) y el ritual de cierre de día (ClosingPhrase.jsx)
// para que ambos pinten exactamente igual, sin lógica duplicada.
export function getCellBgColor(record, dateStr, today, theme) {
  const c = theme.cells;
  if (dateStr > today)              return c.future;
  if (!record)                      return c.empty;
  if (record.status === "vacation") return c.vacation;
  if (record.status === "rest")     return c.rest;
  if (record.status === "zero")     return c.zero;
  if (!record.closedAt && dateStr === today) return c.todayActive;
  const h = record.hours ?? 0;
  if (h >= 5) return c.h5;
  if (h >= 3) return c.h3;
  if (h >= 1) return c.h1;
  return c.empty;
}
