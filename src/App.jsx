import { useCallback, useEffect, useState } from "react";
import DayFlow from "./components/DayFlow.jsx";
import Heatmap from "./components/Heatmap.jsx";
import Nav from "./components/Nav.jsx";

export default function App() {
  const [view, setView] = useState("today");
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Bloquea el pinch-to-zoom nativo de iOS para que no compita con nuestro zoom de celda
  useEffect(() => {
    function preventPinch(e) {
      if (e.touches.length > 1) e.preventDefault();
    }
    document.addEventListener("touchstart", preventPinch, { passive: false });
    return () => document.removeEventListener("touchstart", preventPinch);
  }, []);

  return (
    // pb-20 deja espacio para la nav bar fija
    <div className="min-h-screen pb-20">
      {view === "today" && (
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-6">
          <DayFlow key={refreshKey} onDayChange={refresh} />
        </div>
      )}

      {view === "year" && (
        <div className="fixed inset-0" style={{ bottom: 80 }}>
          <Heatmap refreshKey={refreshKey} onRecordChange={refresh} />
        </div>
      )}

      <Nav view={view} onChangeView={setView} />
    </div>
  );
}
