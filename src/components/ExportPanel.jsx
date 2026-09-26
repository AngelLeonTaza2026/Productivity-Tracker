import { useState } from "react";
import { FRAME_OPTIONS } from "../frames.js";

export default function ExportPanel({ onCancel, onExport, exporting, error }) {
  const [frameId, setFrameId] = useState("none");

  return (
    <div className="fixed inset-0 flex items-center justify-center px-8" style={{ zIndex: 110 }}>
      <button
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-label="Cancelar"
      />

      <div
        className="relative z-10 w-full bg-neutral-900 rounded-3xl px-6 py-6 flex flex-col gap-5"
        style={{ maxWidth: 320, animation: "modal-in 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
      >
        <p className="text-center text-xs text-neutral-500 tracking-widest uppercase">
          Elegí un marco
        </p>

        <div className="grid grid-cols-2 gap-3">
          {FRAME_OPTIONS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFrameId(f.id)}
              className={[
                "flex flex-col items-center gap-2 py-4 rounded-xl border transition-colors",
                frameId === f.id ? "border-white/70 bg-neutral-800" : "border-neutral-800 bg-neutral-900",
              ].join(" ")}
            >
              <span
                className="w-8 h-8 rounded-full"
                style={{
                  backgroundColor: f.swatch,
                  boxShadow: frameId === f.id ? "0 0 0 3px rgba(255,255,255,0.15)" : "none",
                }}
              />
              <span className="text-[11px] text-neutral-300 tracking-wide">{f.label}</span>
            </button>
          ))}
        </div>

        {error && <p className="text-center text-xs text-red-400">{error}</p>}

        <button
          onClick={() => onExport(frameId)}
          disabled={exporting}
          className={[
            "py-3.5 rounded-xl text-xs tracking-widest uppercase transition-colors",
            exporting ? "bg-neutral-800 text-neutral-500" : "bg-green-950 text-green-500 hover:bg-green-900",
          ].join(" ")}
        >
          {exporting ? "Generando..." : "Descargar"}
        </button>
      </div>
    </div>
  );
}
