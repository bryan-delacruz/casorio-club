/**
 * Lo que cuenta la historia para compartir (docs/compartir.md): cuántos días
 * faltan y cómo va cada meta, perla por perla. Puro, para probarlo sin red.
 */
import { ordenPorDependencia, type AccionCamino, type Requisito } from "./metas.ts";

export type Perla = "hecha" | "haciendo" | "falta" | "hito" | "hito-hecho";
export type Collar = { titulo: string; perlas: Perla[]; hechas: number };

/** Hoy en Lima como YYYY-MM-DD: la boda es en Perú aunque el servidor no. */
export const hoyEnLima = (ahora = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(ahora);

/** Días enteros entre hoy y la boda. Null sin fecha; negativo si ya pasó. */
export function diasHasta(fecha: string | null, hoy: string) {
  if (!fecha) return null;
  const dia = (s: string) => {
    const [a, m, d] = s.split("-").map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((dia(fecha) - dia(hoy)) / 86_400_000);
}

const perlaDe = (a: AccionCamino): Perla =>
  a.esHito ? (a.estado === "hecho" ? "hito-hecho" : "hito") : a.estado === "hecho" ? "hecha" : a.estado === "haciendo" ? "haciendo" : "falta";

/**
 * Un collar por meta, en orden de dependencia. Sin metas, uno solo con todo lo
 * que ya tiene fecha. Se cortan en `max` para que la imagen no se desborde.
 */
export function collares(
  acciones: AccionCamino[],
  requisitos: Requisito[],
  metas: { id: string; titulo: string }[],
  max = 4,
): Collar[] {
  const grupos = metas.length
    ? metas.map((m) => ({ titulo: m.titulo, acciones: acciones.filter((a) => a.metaId === m.id) }))
    : [{ titulo: "Nuestro camino", acciones: acciones.filter((a) => a.momento !== "idea") }];
  return grupos
    .filter((g) => g.acciones.length > 0)
    .slice(0, max)
    .map((g) => {
      const orden = ordenPorDependencia(g.acciones, requisitos);
      return {
        titulo: g.titulo,
        perlas: orden.map(perlaDe),
        hechas: orden.filter((a) => a.estado === "hecho").length,
      };
    });
}

/** "Boda de Ana y Luis (demo)" → "Ana y Luis". */
export function nombreDeLaPareja(boda: string | null | undefined) {
  return (boda ?? "")
    .replace(/\s*\(demo\)\s*$/i, "")
    .replace(/^boda de\s+/i, "")
    .trim();
}
