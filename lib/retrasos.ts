/**
 * Lo que se pasó de su semana, y lo que no llega (docs/retrasos.md).
 *
 * Todo puro. Los dos avisos salen de **una sola cuenta**: dónde cae de verdad
 * cada cosa si se empieza hoy y se respetan las dependencias. Tratarlos como
 * dos cálculos era el error a evitar.
 */

import {
  duracionDe,
  enCamino,
  finDe,
  ordenPorDependencia,
  type AccionCamino,
  type Requisito,
} from "./metas.ts";

/** Dónde cae de verdad una acción, y cuánto se pasa (docs/retrasos.md §3). */
export type Proyectada = {
  /** La semana en que puede empezar de verdad. Más grande es más temprano. */
  inicioReal: number;
  /** La semana en que acaba de verdad. */
  finReal: number;
  /** Semanas de más respecto de lo planeado. Siempre positivo aquí. */
  atraso: number;
  /** Acaba después de la boda, sin que nadie lo hubiera planeado así. */
  noLlega: boolean;
};

/**
 * Dónde cae de verdad cada cosa del camino que todavía no está hecha.
 *
 * Solo devuelve **lo que se atrasa**: lo que llega a tiempo no tiene nada que
 * contestar, y así quien lee el mapa no tiene que filtrar.
 *
 * Se recorre en orden de dependencia para que, al llegar a una acción, las que
 * espera ya estén calculadas. Si los datos trajeran un ciclo —la base lo
 * rechaza, pero datos viejos podrían—, `ordenPorDependencia` deja lo que no
 * pudo ordenar al final en vez de colgarse, y aquí a esas se les aplica solo
 * lo que se pueda (§3.1).
 */
export function proyeccion(
  acciones: AccionCamino[],
  requisitos: Requisito[],
  hoy: number | null,
): Map<string, Proyectada> {
  const atrasadas = new Map<string, Proyectada>();
  // Sin fecha de boda no hay con qué comparar: ningún aviso (§3).
  if (hoy === null) return atrasadas;

  const enPlan = enCamino(acciones);
  const porId = new Map(enPlan.map((a) => [a.id, a]));
  const requiere = new Map<string, string[]>();
  for (const r of requisitos) {
    if (r.accionId === r.requiereId) continue;
    requiere.set(r.accionId, [...(requiere.get(r.accionId) ?? []), r.requiereId]);
  }

  /** La semana en que acaba de verdad cada una, hecha o no. */
  const finales = new Map<string, number>();

  for (const a of ordenPorDependencia(enPlan, requisitos)) {
    const finPlaneado = finDe(a);

    // Lo hecho ya está: ni se atrasa ni empuja a quien lo espera (§3).
    if (a.estado === "hecho") {
      finales.set(a.id, finPlaneado);
      continue;
    }

    // No se puede empezar en una semana que ya pasó.
    let inicioReal = Math.min(a.inicioSemanas, hoy);

    // Ni antes de que acabe lo que espera: como pronto, la semana siguiente.
    for (const id of requiere.get(a.id) ?? []) {
      const requisito = porId.get(id);
      // Un requisito hecho, borrado o sin semana no empuja a nadie.
      if (!requisito || requisito.estado === "hecho") continue;
      const finRequisito = finales.get(id);
      if (finRequisito === undefined) continue;
      inicioReal = Math.min(inicioReal, finRequisito - 1);
    }

    const finReal = inicioReal - duracionDe(a) + 1;
    finales.set(a.id, finReal);

    const atraso = finPlaneado - finReal;
    // Lo planeado a propósito para después de la boda no es un retraso (§3).
    const noLlega = finReal < 0 && finPlaneado >= 0;
    if (atraso > 0) atrasadas.set(a.id, { inicioReal, finReal, atraso, noLlega });
  }

  return atrasadas;
}

/** Lo que la línea del Mapa necesita saber (docs/retrasos.md §4.1). */
export type ResumenRetraso<T> = {
  /** Cuántas cosas se pasaron de su semana. */
  cuantas: number;
  /** La que más se pasa **entre las que no llegan**, o null si todas llegan. */
  peor: { accion: T; atraso: number } | null;
};

/**
 * El resumen de una línea.
 *
 * `peor` sale solo de las que **no llegan**, porque es el único caso que
 * merece nombrar a alguien: "se pasó de su semana" se resuelve con una cuenta,
 * y nombrar cinco sería una lista (§4.1).
 */
export function resumenRetraso<T extends AccionCamino>(
  acciones: T[],
  requisitos: Requisito[],
  hoy: number | null,
): ResumenRetraso<T> {
  const atrasadas = proyeccion(acciones, requisitos, hoy);
  let peor: { accion: T; atraso: number } | null = null;

  for (const a of acciones) {
    const suya = atrasadas.get(a.id);
    if (!suya?.noLlega) continue;
    if (!peor || suya.atraso > peor.atraso) peor = { accion: a, atraso: suya.atraso };
  }

  return { cuantas: atrasadas.size, peor };
}
