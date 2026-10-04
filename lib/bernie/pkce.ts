import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * PKCE (RFC 7636) y `state` para el flujo OAuth 2.1 con Bernie.
 * El verificador nunca sale del servidor de Casorio: viaja cifrado en una
 * cookie httpOnly y solo su hash (el challenge) va a Bernie.
 */
export function nuevoVerificador(): string {
  // 32 bytes → 43 caracteres base64url, dentro del rango 43–128 del RFC.
  return randomBytes(32).toString("base64url");
}

export function challengeS256(verificador: string): string {
  return createHash("sha256").update(verificador).digest("base64url");
}

export function nuevoState(): string {
  return randomBytes(24).toString("base64url");
}

/** Compara en tiempo constante: el state no debe filtrarse por tiempos. */
export function mismoState(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
