import Dexie from "dexie";

const db = new Dexie("productividad-tracker");

db.version(1).stores({
  records: "id, date, status",
});

// version 2: agrega el estado del timer (singleton con id "active")
db.version(2).stores({
  records: "id, date, status",
  timerState: "id",
});

export default db;

// ── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * Crea un nuevo DayRecord. Devuelve el registro creado.
 * @param {Partial<DayRecord>} data
 */
export async function createRecord(data) {
  const record = {
    id: crypto.randomUUID(),
    date: data.date,
    status: data.status ?? "productive",
    hours: data.hours ?? null,
    startedAt: data.startedAt ?? null,
    closedAt: data.closedAt ?? null,
    note: data.note ?? null,
  };
  await db.records.add(record);
  return record;
}

/**
 * Devuelve el DayRecord para una fecha específica ("YYYY-MM-DD"), o undefined si no existe.
 * @param {string} date
 */
export async function getRecordByDate(date) {
  return db.records.where("date").equals(date).first();
}

/**
 * Devuelve el DayRecord por id, o undefined si no existe.
 * @param {string} id
 */
export async function getRecordById(id) {
  return db.records.get(id);
}

/**
 * Devuelve todos los DayRecords de un año calendario (enero → diciembre).
 * @param {number} year
 */
export async function getRecordsByYear(year) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  return db.records
    .where("date")
    .between(from, to, true, true)
    .sortBy("date");
}

/**
 * Actualiza campos de un DayRecord existente. Hace merge parcial (no sobreescribe todo).
 * @param {string} id
 * @param {Partial<DayRecord>} changes
 */
export async function updateRecord(id, changes) {
  await db.records.update(id, changes);
  return db.records.get(id);
}

/**
 * Elimina un DayRecord por id.
 * @param {string} id
 */
export async function deleteRecord(id) {
  await db.records.delete(id);
}

/**
 * Devuelve el DayRecord activo (startedAt != null, closedAt == null), o undefined.
 */
export async function getActiveRecord() {
  return db.records
    .filter((r) => r.startedAt !== null && r.closedAt === null)
    .first();
}
