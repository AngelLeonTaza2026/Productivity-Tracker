// Marcos decorativos para la imagen exportada del heatmap anual.
// Harvard y Elegante son fotos/recortes reales con hueco transparente
// (coordenadas calculadas una vez inspeccionando el canal alfa real de cada
// PNG). Gótico es solo florituras de esquina sin ventana definida, así que
// se superpone directo sobre el mismo layout que "Simple".

import harvardUrl from "./assets/frames/harvard.png";
import gothicUrl  from "./assets/frames/gothic.png";
import elegantUrl from "./assets/frames/elegant.png";

export const FRAME_OPTIONS = [
  { id: "none",    label: "Simple",   swatch: "#262626" },
  { id: "harvard", label: "Harvard",  swatch: "#7a1f2b" },
  { id: "gothic",  label: "Gótico",   swatch: "#8b7fc9" },
  { id: "elegant", label: "Elegante", swatch: "#b08d57" },
];

// Fracciones (0–1) del hueco interior transparente de cada foto de marco.
const FRAME_ASSETS = {
  harvard: { url: harvardUrl, hole: { left: 0.1016, right: 0.8977, top: 0.0488, bottom: 0.9508 } },
  elegant: { url: elegantUrl, hole: { left: 0.1030, right: 0.8962, top: 0.0495, bottom: 0.9501 } },
  gothic:  { url: gothicUrl },
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function fontSpec(frameId, sizePx) {
  switch (frameId) {
    case "harvard": return `600 ${sizePx}px Cinzel`;
    case "gothic":  return `700 ${sizePx}px 'UnifrakturCook'`;
    case "elegant": return `italic 600 ${sizePx}px 'Cormorant Garamond'`;
    default:        return `${sizePx}px 'Press Start 2P'`;
  }
}

/** Fuerza la carga de la fuente del marco elegido antes de dibujar en canvas
 *  — el <link> de Google Fonts no alcanza porque el canvas no dispara la
 *  carga perezosa como sí lo hace el texto normal del DOM. */
export async function preloadFrameFont(frameId) {
  try {
    await document.fonts.load(fontSpec(frameId, 40));
  } catch {
    // si falla, el fallback del font stack se usa igual
  }
}

function drawTitle(ctx, frameId, text, cx, cy, scale) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const size = (frameId === "none" ? 28 : 34) * scale;
  ctx.font = fontSpec(frameId, size);
  ctx.fillStyle =
    frameId === "harvard" ? "#7a1f2b" :
    frameId === "gothic"  ? "#cfc6e8" :
    frameId === "elegant" ? "#8a6d3f" :
    "rgba(255,255,255,0.85)";
  if (frameId !== "none") {
    try { ctx.letterSpacing = `${3 * scale}px`; } catch { /* no soportado */ }
  }
  ctx.fillText(text, cx, cy);
  try { ctx.letterSpacing = "0px"; } catch { /* no-op */ }
}

/**
 * Compone el canvas final: título + grid ("contenido"), más el marco elegido.
 * - "none": el contenido ES el canvas final, sin marco.
 * - "harvard" / "elegante": el contenido se ajusta (contain, sin recortar)
 *   dentro del hueco real de la foto del marco; el marco se dibuja encima
 *   a su tamaño nativo, sin distorsión.
 * - "gótico": no tiene ventana propia — se estira sobre el mismo layout
 *   que "Simple".
 */
export async function composeExportCanvas(frameId, { gridImg, year, bg, scale, margin, titleH }) {
  const content = document.createElement("canvas");
  content.width  = gridImg.width + margin * 2;
  content.height = margin + titleH + gridImg.height + margin;
  const cctx = content.getContext("2d");
  cctx.fillStyle = bg;
  cctx.fillRect(0, 0, content.width, content.height);
  drawTitle(cctx, frameId, String(year), content.width / 2, margin + titleH / 2, scale);
  cctx.drawImage(gridImg, margin, margin + titleH);

  if (frameId === "none") return content;

  if (frameId === "gothic") {
    const frameImg = await loadImage(FRAME_ASSETS.gothic.url);
    cctx.drawImage(frameImg, 0, 0, content.width, content.height);
    return content;
  }

  const asset = FRAME_ASSETS[frameId];
  const frameImg = await loadImage(asset.url);
  const { left, right, top, bottom } = asset.hole;

  const canvas = document.createElement("canvas");
  canvas.width  = frameImg.width;
  canvas.height = frameImg.height;
  const ctx = canvas.getContext("2d");

  const holeX = left * canvas.width;
  const holeY = top * canvas.height;
  const holeW = (right - left) * canvas.width;
  const holeH = (bottom - top) * canvas.height;

  ctx.fillStyle = bg;
  ctx.fillRect(holeX, holeY, holeW, holeH);

  const fit  = Math.min(holeW / content.width, holeH / content.height);
  const drawW = content.width * fit;
  const drawH = content.height * fit;
  ctx.drawImage(
    content,
    holeX + (holeW - drawW) / 2,
    holeY + (holeH - drawH) / 2,
    drawW,
    drawH
  );

  ctx.drawImage(frameImg, 0, 0);
  return canvas;
}
