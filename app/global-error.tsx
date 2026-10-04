"use client";

/**
 * Último recurso: reemplaza al layout raíz, así que no tiene sus estilos ni
 * fuentes. Colores de la marca escritos a mano.
 */
export default function ErrorGlobal({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#e7e5db", color: "#191a1e", fontFamily: "Georgia, serif" }}>
        <title>Casorio Club</title>
        <main style={{ maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontWeight: 400, fontSize: 32, margin: "0 0 12px" }}>Algo se cruzó en el camino</h1>
          <p style={{ fontFamily: "system-ui, sans-serif", color: "#6b5f5a", margin: "0 0 20px" }}>
            Casorio Club no pudo cargar. Lo que ya guardaste está a salvo.
          </p>
          <button
            onClick={() => retry()}
            style={{ font: "500 15px system-ui, sans-serif", padding: "10px 18px", borderRadius: 6, border: 0, background: "#49110b", color: "#e7e5db", cursor: "pointer" }}
          >
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
