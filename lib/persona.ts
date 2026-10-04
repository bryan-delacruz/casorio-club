/**
 * Cómo se ve una persona en la app: sus iniciales sobre uno de los colores de
 * la marca. Sin fotos: la genérica de Clerk no dice nada y una de Google, en
 * una tarjeta de 16 px, tampoco.
 */

/** Primera letra de cada palabra, en mayúscula y sin depender de la tilde. */
const letra = (palabra: string | undefined) => (palabra ? palabra.charAt(0).toLocaleUpperCase("es") : "");
/** Solo cuentan las palabras que empiezan con letra: "(demo)" o "2do" no son un apellido. */
const palabras = (s: string | null | undefined) => (s ?? "").trim().split(/\s+/).filter((p) => /^\p{L}/u.test(p));

/**
 * Nombre + primer apellido: "Luis" "Mendoza Paz" → "LM". Sin apellido, las dos
 * primeras palabras de lo que haya ("ana rios" del correo → "AR"), y con una
 * sola palabra, sus dos primeras letras.
 */
export function inicialesDe(nombre: string | null | undefined, apellido: string | null | undefined, respaldo = "") {
  const n = palabras(nombre);
  const a = palabras(apellido);
  if (n.length && a.length) return letra(n[0]) + letra(a[0]);
  const todo = n.length ? n : a.length ? a : palabras(respaldo);
  if (todo.length >= 2) return letra(todo[0]) + letra(todo[1]);
  return (todo[0] ?? "?").slice(0, 2).toLocaleUpperCase("es");
}

/** Cuántos pares fondo/texto hay en globals.css (--persona-N-*). */
export const COLORES_PERSONA = 5;

/**
 * El color de una persona sale de su id, no del azar del render: así le toca
 * siempre el mismo en la tarjeta, el camino, el reparto y la historia.
 */
export function colorDe(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % COLORES_PERSONA) + 1;
}

/**
 * Nombre visible e iniciales a partir de lo que da Clerk. Sin nombre puesto,
 * Clerk devuelve el correo: mostrarlo entero desborda la tarjeta, así que se
 * usa la parte de antes de la arroba.
 */
export function personaDe(u: {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  identifier?: string | null;
  /** Clerk: true solo si la persona subió su foto (no hay login social). */
  hasImage?: boolean;
  imageUrl?: string | null;
}) {
  const propio = [u.firstName, u.lastName].filter(Boolean).join(" ");
  const deCorreo = u.identifier?.includes("@")
    ? u.identifier.split("@")[0].replace(/[._-]+/g, " ")
    : (u.identifier ?? "");
  return {
    id: u.id,
    nombre: propio || deCorreo || "Alguien",
    iniciales: inicialesDe(u.firstName, u.lastName, deCorreo),
    // Sin foto propia, Clerk da una silueta genérica: ahí van las iniciales.
    imagen: u.hasImage && u.imageUrl ? u.imageUrl : undefined,
  };
}
