// Pestañas como datos — World.jsx (Paso 1) y RadialNav.jsx (Paso 2) leen
// de acá, así agregar una tercera vista no implica tocar la navegación.
export const TABS = [
  {
    id: "today",
    label: "Hoy",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        {active && <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />}
      </svg>
    ),
  },
  {
    id: "year",
    label: "Año",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" fill={active ? "currentColor" : "none"} />
        <rect x="14" y="3" width="7" height="7" rx="1" fill={active ? "currentColor" : "none"} />
        <rect x="3" y="14" width="7" height="7" rx="1" fill={active ? "currentColor" : "none"} />
        <rect x="14" y="14" width="7" height="7" rx="1" fill={active ? "currentColor" : "none"} />
      </svg>
    ),
  },
];
