# Productividad Tracker

PWA personal para registrar horas productivas diarias. Reemplaza el sistema de cronómetro + hoja
impresa por un registro digital instalable en iPhone.

## La filosofía del timer sin marcador

El timer **no muestra el tiempo transcurrido mientras corre**. Ver el número ("ya llevo 3h") baja la
motivación de seguir. Como correr una maratón con los ojos vendados — llegas más lejos sin mirar el
marcador. Solo un indicador visual de que "está corriendo".

## Stack

- React + Vite
- Tailwind CSS v4
- Dexie.js (IndexedDB) — toda la data vive en el dispositivo, sin backend
- vite-plugin-pwa — instalable como PWA en iOS vía Safari

## Correr localmente

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` en el navegador.

## Instalar como PWA en iPhone

1. Abre la app en Safari (`https://tu-dominio.com` o la URL local con HTTPS)
2. Toca el botón compartir (cuadrado con flecha)
3. Selecciona **"Añadir a pantalla de inicio"**
4. La app queda instalada y corre en modo standalone (sin barra de Safari)

## Sin backend, sin login

Todo el historial se guarda en IndexedDB del propio dispositivo. No hay sincronización entre
dispositivos — es intencional para esta primera fase.
