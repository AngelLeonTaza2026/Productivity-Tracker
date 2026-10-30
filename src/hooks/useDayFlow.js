import { useState, useEffect, useCallback } from "react";
import { createRecord, getActiveRecord, getRecordByDate, updateRecord } from "../db/index.js";
import { resetTimer, pauseTimer } from "../db/timer.js";

function todayDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// `refreshKey` reemplaza al viejo truco de remontar <DayFlow key={refreshKey}>
// — ahora que el mundo (World.jsx) mantiene todo montado siempre, esto es
// lo que hace que el hook vuelva a leer la DB si algo cambió desde afuera
// (ej. se editó el día de hoy desde la vista anual).
export function useDayFlow(refreshKey) {
  const [activeRecord, setActiveRecord] = useState(undefined);
  const [closing, setClosing] = useState(false);
  const [todayAlreadyClosed, setTodayAlreadyClosed] = useState(false);

  useEffect(() => {
    async function load() {
      const active = await getActiveRecord();
      if (active) { setActiveRecord(active); return; }
      const existing = await getRecordByDate(todayDate());
      setTodayAlreadyClosed(!!existing);
      setActiveRecord(null);
    }
    load();
  }, [refreshKey]);

  const openDay = useCallback(async () => {
    const existing = await getRecordByDate(todayDate());
    if (existing) { setTodayAlreadyClosed(true); return; }
    await resetTimer();
    const rec = await createRecord({ date: todayDate(), startedAt: new Date().toISOString() });
    setActiveRecord(rec);
    setTodayAlreadyClosed(false);
  }, []);

  // Reabre el registro cerrado de hoy: resetea el timer y limpia closedAt/hours/status
  const forceReopenDay = useCallback(async () => {
    const existing = await getRecordByDate(todayDate());
    if (!existing) return;
    await resetTimer();
    const reopened = await updateRecord(existing.id, {
      startedAt: new Date().toISOString(),
      closedAt: null,
      hours: null,
      status: "productive",
    });
    setActiveRecord(reopened);
    setTodayAlreadyClosed(false);
  }, []);

  const requestClose = useCallback(() => setClosing(true), []);
  const cancelClose  = useCallback(() => setClosing(false), []);

  const confirmClose = useCallback(
    async ({ hours, status }) => {
      if (!activeRecord) return;
      await pauseTimer();
      const updated = await updateRecord(activeRecord.id, {
        closedAt: new Date().toISOString(),
        hours,
        status,
      });
      setActiveRecord(null);
      setClosing(false);
      setTodayAlreadyClosed(true);
      return updated;
    },
    [activeRecord]
  );

  return {
    activeRecord,
    todayAlreadyClosed,
    closing,
    openDay,
    forceReopenDay,
    requestClose,
    cancelClose,
    confirmClose,
  };
}
