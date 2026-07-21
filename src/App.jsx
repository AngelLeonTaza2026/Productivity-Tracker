import { useCallback, useState } from "react";
import DayFlow from "./components/DayFlow.jsx";
import Heatmap from "./components/Heatmap.jsx";
import Nav from "./components/Nav.jsx";
import { THEMES } from "./themes.js";

export default function App() {
  const [view,       setView]       = useState("today");
  const [refreshKey, setRefreshKey] = useState(0);
  const [themeId,    setThemeId]    = useState("default");
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const theme = THEMES[themeId] ?? THEMES.default;
  function toggleTheme() {
    setThemeId(id => id === "default" ? "bear" : "default");
  }

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: theme.bg }}>
      {view === "today" && (
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-6">
          <DayFlow key={refreshKey} onDayChange={refresh} />
        </div>
      )}

      {view === "year" && (
        <div className="fixed inset-0" style={{ bottom: 80, backgroundColor: theme.bg }}>
          <Heatmap
            refreshKey={refreshKey}
            onRecordChange={refresh}
            theme={theme}
            onThemeToggle={toggleTheme}
          />
        </div>
      )}

      <Nav view={view} onChangeView={setView} />
    </div>
  );
}
