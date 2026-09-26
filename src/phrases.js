// Frases cortas mostradas al cerrar el día, elegidas al azar según el resultado.
// Editar esta lista no requiere tocar ningún componente.

const PRODUCTIVE = [
  "Otro turno cerrado con honor.",
  "Cada segundo contó hoy.",
  "Así se construye, un día a la vez.",
  "Hoy le ganaste al reloj.",
  "Trabajo limpio. Guardalo.",
  "Ese es el estándar.",
  "La casilla se lo ganó.",
  "Disciplina servida.",
  "Un día más grabado en piedra.",
];

const ZERO = [
  "Hoy no tocó. Mañana se cocina de nuevo.",
  "Un cero no borra lo demás.",
  "El día se cierra igual. Mañana arranca fresco.",
  "No todos los turnos salen redondos.",
  "Cerrá esto y seguí.",
  "Mañana es otra estación.",
  "Esto también se registra, sin drama.",
  "Un día en blanco no define la racha.",
  "Se anota y se sigue.",
];

const RESTFUL = [
  "El descanso también es parte del oficio.",
  "Recargar cuenta como avanzar.",
  "Hasta las mejores cocinas cierran a veces.",
  "Parar a tiempo es parte del trabajo.",
  "Este día también suma, a su manera.",
  "Sin descanso no hay turno siguiente.",
  "Bien merecido.",
  "El fuego se apaga para volver más fuerte.",
  "Pausa necesaria, no una falla.",
];

/**
 * Devuelve una frase al azar según el status con el que se cerró el día.
 * @param {"productive"|"zero"|"rest"|"vacation"} status
 */
export function pickClosingPhrase(status) {
  const pool =
    status === "zero" ? ZERO :
    status === "rest" || status === "vacation" ? RESTFUL :
    PRODUCTIVE;
  return pool[Math.floor(Math.random() * pool.length)];
}
