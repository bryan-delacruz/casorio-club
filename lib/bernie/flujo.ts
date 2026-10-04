import "server-only";
import { cifrar, descifrar } from "./cifrado";

/**
 * Estado del viaje de ida y vuelta a Bernie, guardado en una cookie httpOnly
 * cifrada. Ata el flujo a la boda y la persona que lo empezó: un callback que
 * llegue en otra sesión o para otra boda se rechaza.
 */
export const COOKIE_FLUJO = "bernie_oauth";
const DURACION_S = 600;

export type Flujo = { state: string; verificador: string; bodaId: string; userId: string; vence: number };

export function cookieDeFlujo(flujo: Omit<Flujo, "vence">) {
  const valor = cifrar(JSON.stringify({ ...flujo, vence: Date.now() + DURACION_S * 1000 }));
  return {
    name: COOKIE_FLUJO,
    value: valor,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const, // la vuelta desde Bernie es una navegación GET de otro sitio
    path: "/api/bernie",
    maxAge: DURACION_S,
  };
}

export function leerFlujo(valor: string | undefined): Flujo | null {
  if (!valor) return null;
  try {
    const flujo = JSON.parse(descifrar(valor)) as Flujo;
    return flujo.vence > Date.now() ? flujo : null;
  } catch {
    return null;
  }
}
