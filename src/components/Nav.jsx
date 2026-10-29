// Reserva vertical para este indicador (contenido + colchón de safe-area),
// reusada por App.jsx/Heatmap.jsx/DayFlow.jsx para no superponerse con
// él — único lugar donde se define, así no se desalinean entre sí.
export const NAV_RESERVE = 46; // despeja los puntos incluso con safe-area grande (iPhone con home indicator)

const VIEWS = ["today", "year"];

// Ya no es una barra de pestañas — ahora que solo hay 2 vistas, navegar
// es con swipe desde el borde (ver DayFlow.jsx/Heatmap.jsx). Esto queda
// como un indicador chico de "dónde estoy" + una forma de tocar para
// cambiar, por si alguien no descubre el gesto del borde.
export default function Nav({ view, onChangeView }) {
  return (
    <div
      className="fixed flex items-center justify-center gap-2"
      style={{ bottom: "max(12px, env(safe-area-inset-bottom))", left: 0, right: 0, zIndex: 20 }}
    >
      {VIEWS.map((id) => (
        <button
          key={id}
          onClick={() => onChangeView(id)}
          aria-label={id === "today" ? "Hoy" : "Año"}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            border: "none",
            padding: 0,
            backgroundColor: view === id ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.25)",
            transition: "background-color 200ms ease",
          }}
        />
      ))}
    </div>
  );
}
