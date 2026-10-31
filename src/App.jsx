import { useCallback, useEffect, useState } from "react";
import DayFlow from "./components/DayFlow.jsx";
import Heatmap from "./components/Heatmap.jsx";
import World from "./components/World.jsx";
import RadialNav from "./components/RadialNav.jsx";
import { TABS } from "./tabs.jsx";
import { NAV_RESERVE } from "./layout.js";
import { THEMES, THEME_ORDER } from "./themes.js";

export default function App() {
  const [view,       setView]       = useState("today");
  const [refreshKey, setRefreshKey] = useState(0);
  const [themeId,    setThemeId]    = useState("light");
  const [landing,    setLanding]    = useState(null); // { date, color } | null
  const [wheelOpen,  setWheelOpen]  = useState(false);
  const [previewId,  setPreviewId]  = useState(null);
  const [dayBlocking,  setDayBlocking]  = useState(false);
  const [yearBlocking, setYearBlocking] = useState(false);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const theme = THEMES[themeId] ?? THEMES.light;
  function toggleTheme() {
    setThemeId((id) => {
      const next = THEME_ORDER[(THEME_ORDER.indexOf(id) + 1) % THEME_ORDER.length];
      return next ?? THEME_ORDER[0];
    });
  }

  // Sin esto, el <body> (ver index.css) y el meta theme-color se quedan en
  // sus valores estáticos de HTML — hace falta reflejar el tema activo ahí
  // para que la barra de estado/chrome del navegador no desentone ni
  // destelle oscuro al cambiar de tema o al abrir la PWA.
  useEffect(() => {
    document.body.dataset.theme = themeId;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.bg);
  }, [themeId, theme.bg]);

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
            onBlockingChange={setDayBlocking}
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
            onBlockingChange={setYearBlocking}
          />
        </div>
      ),
  }));

  return (
    <>
      <World tabs={tabs} activeId={view} bgColor={theme.bg} dimmed={wheelOpen} previewId={previewId} />

      <RadialNav
        tabs={TABS}
        activeId={view}
        onSelect={setView}
        hidden={dayBlocking || yearBlocking}
        onOpenChange={setWheelOpen}
        onPreview={setPreviewId}
        onPreviewCancel={() => setPreviewId(null)}
        theme={theme}
      />
    </>
  );
}
