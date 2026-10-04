import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verificación de webhooks de Bernie con Standard Webhooks
 * (standardwebhooks.com): HMAC-SHA256 de `${id}.${timestamp}.${body}` con el
 * secreto `whsec_...` que Bernie entregó al registrar a Casorio.
 */
export type ResultadoFirma = { ok: true } | { ok: false; motivo: "faltan_cabeceras" | "fuera_de_tiempo" | "firma_invalida" };

export function verificarWebhook(
  secreto: string,
  cabeceras: { id: string | null; timestamp: string | null; firma: string | null },
  cuerpo: string,
  opciones: { toleranciaSegundos?: number; ahora?: number } = {},
): ResultadoFirma {
  const { id, timestamp, firma } = cabeceras;
  if (!id || !timestamp || !firma) return { ok: false, motivo: "faltan_cabeceras" };

  const ts = Number(timestamp);
  const ahora = opciones.ahora ?? Math.floor(Date.now() / 1000);
  // Fuera de la ventana = posible reenvío de un webhook capturado.
  if (!Number.isInteger(ts) || Math.abs(ahora - ts) > (opciones.toleranciaSegundos ?? 300)) {
    return { ok: false, motivo: "fuera_de_tiempo" };
  }

  const clave = Buffer.from(secreto.startsWith("whsec_") ? secreto.slice(6) : secreto, "base64");
  const esperada = createHmac("sha256", clave).update(`${id}.${ts}.${cuerpo}`).digest();

  for (const candidata of firma.split(" ")) {
    const [version, valor] = candidata.split(",", 2);
    if (version !== "v1" || !valor) continue;
    const dada = Buffer.from(valor, "base64");
    if (dada.length === esperada.length && timingSafeEqual(dada, esperada)) return { ok: true };
  }
  return { ok: false, motivo: "firma_invalida" };
}
