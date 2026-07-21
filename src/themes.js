export const THEMES = {
  default: {
    id: "default",
    label: "THE BEAR",          // etiqueta del tema AL QUE vas a cambiar
    bg: "#0a0a0a",
    cells: {
      future:      "rgba(23,23,23,0.4)",
      empty:       "#262626",
      zero:        "#dc2626",
      rest:        "#f59e0b",
      vacation:    "#6d28d9",
      todayActive: "#14532d",
      h1:          "#14532d",
      h3:          "#16a34a",
      h5:          "#4ade80",
    },
    labelColor:   "#374151",
    yearColor:    "rgba(255,255,255,0.28)",
    dividerColor: "rgba(255,255,255,0.07)",
    toggleColor:  "rgba(255,255,255,0.15)",
  },

  bear: {
    id: "bear",
    label: "DEFAULT",           // etiqueta del tema AL QUE vas a cambiar
    bg: "#060d18",              // noche de cocina — azul marino profundo
    cells: {
      future:      "rgba(6,13,24,0.7)",
      empty:       "#0c1a2e",
      zero:        "#7f1d1d",
      rest:        "#78350f",
      vacation:    "#1e1b4b",
      todayActive: "#1e3a5f",
      h1:          "#1e3a5f",   // acero oscuro
      h3:          "#1d4ed8",   // acero medio
      h5:          "#60a5fa",   // acero brillante
    },
    labelColor:   "#1e3a5f",
    yearColor:    "rgba(148,163,184,0.4)",
    dividerColor: "rgba(96,165,250,0.12)",
    toggleColor:  "rgba(96,165,250,0.3)",
  },
};
