# Control de Productividad Diaria — Spec definitivo (Fase 1 / MVP)

App web personal (PWA) para reemplazar mi sistema actual (cronómetro del teléfono + hoja impresa
anual con casillas) por un registro digital instalable en iPhone vía Safari
("Añadir a pantalla de inicio"). **Sin backend, sin login** — todo vive en el propio dispositivo.

Este es un **proyecto personal de portafolio**: debe quedar limpio, bien organizado y listo para
subir a mi GitHub personal como muestra de trabajo. Ver sección "Repositorio / GitHub" al final.

## Filosofía del producto

El corazón de la app es un timer que **no muestra el tiempo transcurrido mientras corre**. Esto es
intencional y es la característica central: ver el número (ej. "ya llevo 3h") baja la motivación de
seguir. Como correr una maratón con los ojos vendados — llegas más lejos sin mirar el marcador.
Solo un indicador visual de que "está corriendo".

## Stack

- React + Vite + Tailwind CSS
- Dexie.js (wrapper sobre IndexedDB) para persistencia local
- manifest.json + Service Worker → instalable como PWA en iOS

## Modelo de datos

```ts
interface DayRecord {
  id: string;               // uuid
  date: string;             // "YYYY-MM-DD" — el día que representa el registro (casilla del heatmap)
  status: "productive" | "zero" | "rest" | "vacation";
  hours: number | null;     // horas productivas; null si status = "rest" o "vacation"
  startedAt: string | null; // ISO timestamp, cuando se abrió el día
  closedAt: string | null;  // ISO timestamp, cuando se cerró el día
  note: string | null;      // nota opcional
}
```

- El "día" NO está atado a medianoche: yo decido cuándo lo abro y cuándo lo cierro. A veces la
  productividad se corre a la noche, a veces empieza muy temprano. Es flexible.
- `date` identifica la casilla en el heatmap anual, no necesariamente coincide con la fecha de `closedAt`.

## Timer (característica central)

- Botones: **Iniciar** / **Pausar**.
- Mientras corre: **NO se muestra el número de tiempo transcurrido**. Solo un indicador visual
  (punto o barra pulsante en verde) que comunica "está corriendo".
- El tiempo se acumula en segundo plano (persistido — sobrevive a recarga o cierre de pestaña) hasta
  que pauso o cierro el día.
- Se puede pausar y reanudar varias veces dentro del mismo día (pauso cuando hago otras cosas).

## Flujo de día

1. **Abrir día** → arranca la sesión, el timer queda disponible.
2. **Cerrar día** → muestra un resumen con el total acumulado (auto-calculado del timer), **editable
   a mano** antes de confirmar (a veces acumulo tiempo fuera de la app, como hago hoy con el cronómetro).
3. Al confirmar, el registro se marca como:
   - Horas productivas (número editable)
   - `0` (día sin nada)
   - Descanso (`rest`) — descanso intencional dentro de la rutina normal, sin horas
   - `V` — Vacaciones (`vacation`) — periodo de vacaciones propiamente dicho, sin horas
   - `rest` y `vacation` son estados distintos: el descanso también es necesario y no todos los
     días tienen que ser productivos, pero vacaciones es algo más específico (viaje, corte largo)
     y merece su propia marca en el heatmap.

## CRUD

- Poder editar o borrar cualquier registro pasado directamente desde la vista anual.

## Vista anual (heatmap estilo GitHub)

- Grid de 365/366 casillas, una por día del año.
- Color por intensidad de horas:
  - `0h` → vacío / rojo tenue (para que "duela" ver los ceros — es parte del efecto motivador)
  - `1–2h` → verde claro
  - `3–4h` → verde medio
  - `5h+` → verde oscuro
  - `rest` → color distinto propio (ej. gris/celeste), sin marca de texto
  - `vacation` → color distinto (ej. azul/morado) **con marca "V" visible como texto sobre la celda**,
    no solo el color — el color solo no es suficiente para distinguirlo.

## Fuera de alcance (Fase 1)

- Panel de estadísticas — DESCARTADO por ahora (quizá en un futuro lejano, no es prioridad).
- Sincronización multi-dispositivo / backend / login.

## Fase 2

Nota de disciplina: en una sesión anterior se construyeron partes de Fase 2 sin pedirlo
explícitamente, contra la instrucción de esperar confirmación. No se rompió nada y el resultado
se mantiene, pero **de ahora en adelante, nada de esta sección se construye sin que yo lo pida
explícitamente feature por feature**, aunque parezca una buena idea en el momento.

- ✅ **[YA CONSTRUIDO] Animación de cierre de día**: transición estilo "pieza que se acomoda en su
  casilla" (efecto portal — la celda se expande a pantalla completa al abrir el modal). Referencia
  original: efecto de desbloqueo de personaje en Lego Star Wars.
- ✅ **[YA CONSTRUIDO] Estética visual inspirada en la serie "The Bear"**: sistema de temas
  implementado (`themes.js`) con paleta de colores y tipografía con carácter. Referencia visual:
  el cartel "EVERY SECOND COUNTS".
- ⬜ **[PENDIENTE — no construir sin pedirlo] Modo enfoque minimalista**: mientras el timer corre, ocultar el resto de la interfaz (menú,
  heatmap, botones) y mostrar únicamente el indicador visual de "corriendo" a pantalla completa.
  Refuerza la idea de no ver el marcador de tiempo ni distracciones alrededor.
- ⬜ **[PENDIENTE — no construir sin pedirlo] Frases al cerrar el día**: al confirmar el cierre de
  un día, mostrar una frase corta motivacional aleatoria de un array local (sin API externa ni
  conexión a internet), estilo "cada segundo cuenta".
- ⬜ **[PENDIENTE — no construir sin pedirlo] Exportar vista anual como imagen**: botón para
  exportar el heatmap anual completo como imagen (PNG), para poder guardarla o compartirla — el
  equivalente digital a la hoja impresa que usaba antes.

## Repositorio / GitHub

Es un proyecto de portafolio personal. Debe incluir:
- `.gitignore` de Node (ignorar `node_modules/`, `dist/`, etc.)
- `README.md` con: descripción del proyecto, la filosofía del timer sin marcador, stack usado,
  cómo correrlo localmente, y cómo instalarlo como PWA en iPhone.
- Commits limpios y con mensajes descriptivos.
- Código ordenado y comentado donde ayude a la legibilidad.
