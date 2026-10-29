import { useCallback, useState } from "react";
import DayFlow from "./components/DayFlow.jsx";
import Heatmap from "./components/Heatmap.jsx";
import Nav, { NAV_RESERVE } from "./components/Nav.jsx";
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.bg, paddingBottom: NAV_RESERVE }}>
      {view === "today" && (
        <div className="flex items-center justify-center px-6" style={{ minHeight: `calc(100vh - ${NAV_RESERVE}px)` }}>
          <DayFlow key={refreshKey} onDayChange={refresh} theme={theme} onRequestLanding={requestLanding} />
        </div>
      )}

      {view === "year" && (
        <div className="fixed inset-0" style={{ bottom: NAV_RESERVE, backgroundColor: theme.bg }}>
          <Heatmap
            refreshKey={refreshKey}
            onRecordChange={refresh}
            theme={theme}
            onThemeToggle={toggleTheme}
            landing={landing}
            onLandingDone={() => setLanding(null)}
          />
        </div>
      )}

      <Nav view={view} onChangeView={setView} />
    </div>
  );
}
