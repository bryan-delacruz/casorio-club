import { ImageResponse } from "next/og";

// Imagen que representa la marca al compartir el link (WhatsApp, LinkedIn, etc.).
export const alt = "Casorio Club — Tu matrimonio civil, organizado entre dos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          color: "#e7e5db",
          fontFamily: "serif",
          background: "linear-gradient(150deg, #6b1a11 0%, #49110b 50%, #2a0a06 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 34, fontWeight: 600 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              display: "flex",
              background: "#ad9e89",
            }}
          />
          Casorio Club
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 80, fontWeight: 600, lineHeight: 1.04, letterSpacing: -2, maxWidth: 960 }}>
            Tu matrimonio civil, organizado entre dos.
          </div>
          <div style={{ fontSize: 30, color: "rgba(231,229,219,0.82)", maxWidth: 880, fontFamily: "sans-serif" }}>
            Pendientes, trámites, compras y gastos en un solo lugar.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 24, color: "rgba(231,229,219,0.7)", fontFamily: "monospace" }}>
          tablero compartido · presupuesto · fechas y dependencias
        </div>
      </div>
    ),
    size,
  );
}
