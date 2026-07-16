const TABS = [
  {
    id: "today",
    label: "Hoy",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        {active && <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />}
      </svg>
    ),
  },
  {
    id: "year",
    label: "Año",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" fill={active ? "currentColor" : "none"} />
        <rect x="14" y="3" width="7" height="7" rx="1" fill={active ? "currentColor" : "none"} />
        <rect x="3" y="14" width="7" height="7" rx="1" fill={active ? "currentColor" : "none"} />
        <rect x="14" y="14" width="7" height="7" rx="1" fill={active ? "currentColor" : "none"} />
      </svg>
    ),
  },
];

export default function Nav({ view, onChangeView }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex bg-neutral-950 border-t border-neutral-800"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map(({ id, label, icon }) => {
        const active = view === id;
        return (
          <button
            key={id}
            onClick={() => onChangeView(id)}
            className={[
              "flex-1 flex flex-col items-center gap-1 py-3 transition-colors duration-150",
              active ? "text-white" : "text-neutral-600",
            ].join(" ")}
          >
            {icon(active)}
            <span className="text-[10px] tracking-widest uppercase">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
