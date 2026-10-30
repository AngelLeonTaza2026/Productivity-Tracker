import { useCallback, useState } from "react";
import DayFlow from "./components/DayFlow.jsx";
import Heatmap from "./components/Heatmap.jsx";
import World from "./components/World.jsx";
import { TABS } from "./tabs.jsx";
import { NAV_RESERVE } from "./layout.js";
import { THEMES } from "./themes.js";

export default function App() {
  const [view,       setView]       = useState("today");
  const [refreshKey, setRefreshKey] = useState(0);
  const [themeId,    setThemeId]    = useState("default");
  const [landing,    setLanding]    = useState(null); // { date, color } | null
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const theme = THEMES[themeId] ?? THEMES.default;
  function toggleTheme() {
    setThemeId(id => id === "default" ? "bear" : "default");
  }

  // El ritual de cierre de día termina transportando a la vista anual,
  // aterrizando en la celda real de hoy — ver Heatmap.jsx (prop `landing`).
  function requestLanding(date, color) {
    setLanding({ date, color });
    setView("year");
  }

  // Las dos vistas quedan siempre montadas (World.jsx mueve una cámara
  // entre ellas), así conservan su propio estado — el timer sigue su
  // curso aunque estés mirando el año.
  const tabs = TABS.map((t) => ({
    ...t,
    render: () =>
      t.id === "today" ? (
        <div className="flex items-center justify-center w-full h-full px-6" style={{ paddingBottom: NAV_RESERVE }}>
          <DayFlow
            onDayChange={refresh}
            theme={theme}
            onRequestLanding={requestLanding}
            refreshKey={refreshKey}
            isActive={view === "today"}
          />
        </div>
      ) : (
        <div className="w-full h-full" style={{ paddingBottom: NAV_RESERVE }}>
          <Heatmap
            refreshKey={refreshKey}
            onRecordChange={refresh}
            theme={theme}
            onThemeToggle={toggleTheme}
            landing={landing}
            onLandingDone={() => setLanding(null)}
            isActive={view === "year"}
          />
        </div>
      ),
  }));

  return (
    <>
      <World tabs={tabs} activeId={view} bgColor={theme.bg} />

      {/* Botones de depuración temporales del Paso 1 — el Paso 2 los
          reemplaza por el ancla de RadialNav.jsx */}
      <div
        className="fixed flex gap-2 z-50"
        style={{ bottom: "max(10px, env(safe-area-inset-bottom))", left: 0, right: 0, justifyContent: "center" }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={[
              "px-3 py-1 rounded-full text-xs tracking-widest uppercase transition-colors",
              view === t.id ? "bg-neutral-700 text-white" : "bg-neutral-900 text-neutral-500",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>
    </>
  );
}
