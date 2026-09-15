import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Inicialización perezosa a propósito.
 *
 * `neon()` lanza si DATABASE_URL no está definida, y Next evalúa el código de
 * módulo en tiempo de compilación: inicializar arriba rompería `next build`
 * en cualquier entorno sin la variable puesta todavía.
 *
 * Tampoco se envuelve en un Proxy, que es el atajo habitual para esto: los
 * Proxy interceptan la introspección que hacen algunas librerías sobre el
 * cliente y provocan cuelgues sin error.
 */
let cliente: ReturnType<typeof crear> | null = null;

function crear() {
  return drizzle(neon(process.env.DATABASE_URL!), { schema });
}

export function getDb() {
  if (!cliente) cliente = crear();
  return cliente;
}
