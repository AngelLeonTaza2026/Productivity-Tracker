// Los colores saturados (rojo/ámbar/morado/verdes) se repiten idénticos en
// los tres temas a propósito: son parches sólidos que ya se leen bien sobre
// cualquier fondo. Lo único que cambia de polaridad entre temas claros y
// oscuros es lo que depende del fondo: las celdas "casi invisibles" (future,
// empty), las etiquetas de eje, el número de año y los divisores — y el
// nuevo grupo `text` (ver DayFlow.jsx, que antes asumía fondo oscuro con
// clases Tailwind fijas).
export const THEMES = {
  light: {
    id: "light",
    label: "Oscuro",             // etiqueta del tema AL QUE vas a cambiar
    bg: "#faf8f5",                // crema suave, no blanco puro
    cells: {
      future:      "rgba(0,0,0,0.04)",
      empty:       "#e8e4de",
      zero:        "#dc2626",
      rest:        "#f59e0b",
      vacation:    "#6d28d9",
      todayActive: "#14532d",
      h1:          "#14532d",
      h3:          "#16a34a",
      h5:          "#4ade80",
    },
    labelColor:   "#d6d3d1",
    yearColor:    "rgba(0,0,0,0.14)",
    dividerColor: "rgba(0,0,0,0.08)",
    toggleColor:  "rgba(0,0,0,0.18)",
    text: {
      primary: "#44403c",
      muted:   "#78716c",
      faint:   "#a8a29e",
    },
  },

  dark: {
    id: "dark",
    label: "The Bear",           // etiqueta del tema AL QUE vas a cambiar
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
    text: {
      primary: "#a3a3a3",
      muted:   "#525252",
      faint:   "#404040",
    },
  },

  bear: {
    id: "bear",
    label: "Claro",              // etiqueta del tema AL QUE vas a cambiar
    bg: "#060d18",               // noche de cocina — azul marino profundo
    cells: {
      future:      "rgba(6,13,24,0.7)",
      empty:       "#0c1a2e",
      zero:        "#7f1d1d",
      rest:        "#78350f",
      vacation:    "#1e1b4b",
      todayActive: "#1e3a5f",
      h1:          "#1e3a5f",    // acero oscuro
      h3:          "#1d4ed8",   // acero medio
      h5:          "#60a5fa",   // acero brillante
    },
    labelColor:   "#1e3a5f",
    yearColor:    "rgba(148,163,184,0.4)",
    dividerColor: "rgba(96,165,250,0.12)",
    toggleColor:  "rgba(96,165,250,0.3)",
    text: {
      primary: "#93a5c2",
      muted:   "#5b7291",
      faint:   "#3d4d63",
    },
  },
};

// Orden del ciclo del selector de temas (Heatmap.jsx → onThemeToggle).
export const THEME_ORDER = ["light", "dark", "bear"];
