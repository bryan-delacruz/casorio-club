import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM para el refresh token de Bernie y la cookie del flujo OAuth.
 * GCM autentica además de cifrar: un valor alterado no se descifra, lanza.
 * Formato (base64url): iv(12) | tag(16) | texto cifrado.
 */
function llave(): Buffer {
  const raw = process.env.BERNIE_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("BERNIE_TOKEN_ENCRYPTION_KEY no está definida");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("BERNIE_TOKEN_ENCRYPTION_KEY debe tener 32 bytes (base64)");
  return key;
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", llave(), iv);
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), cifrado]).toString("base64url");
}

export function descifrar(valor: string): string {
  const datos = Buffer.from(valor, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", llave(), datos.subarray(0, 12));
  decipher.setAuthTag(datos.subarray(12, 28));
  return Buffer.concat([decipher.update(datos.subarray(28)), decipher.final()]).toString("utf8");
}
