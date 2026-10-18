/**
 * El orden entre acciones (docs/dependencias.md). Todo puro: recibe acciones y
 * aristas, devuelve conjuntos y listas. Nada de React ni de base de datos.
 *
 * Una fila de `dependencias` se lee siempre igual: `accionId` **requiere** a
 * `requiereId`. Las dos direcciones de la pantalla salen de leer ese mismo
 * grafo en un sentido o en el otro (§5).
 */

import type { Requisito } from "./metas";

/**
 * Lo mínimo que la lista necesita de una acción: su nombre, su semana y su
 * meta. No pide `AccionCamino` entera porque aquí no se calcula nada de
 * tiempo, y un tipo más ancho obligaría a inventar montos y duraciones en las
 * pruebas.
 */
export type Elegible = {
  id: string;
  titulo: string;
  inicioSemanas: number | null;
  metaId?: string | null;
};

/** Las dos listas del diálogo (docs/dependencias.md §5). */
export type Lado = "antes" | "despues";

/** id → lo que esa acción requiere. */
export function requiereDe(requisitos: Requisito[]) {
  const de = new Map<string, string[]>();
  for (const r of requisitos) {
    if (r.accionId === r.requiereId) continue;
    de.set(r.accionId, [...(de.get(r.accionId) ?? []), r.requiereId]);
  }
  return de;
}

/** id → quién la requiere. El mismo grafo al revés. */
export function esperanA(requisitos: Requisito[]) {
  const de = new Map<string, string[]>();
  for (const r of requisitos) {
    if (r.accionId === r.requiereId) continue;
    de.set(r.requiereId, [...(de.get(r.requiereId) ?? []), r.accionId]);
  }
  return de;
}

/**
 * Todo lo que se alcanza desde `id`, sin contarlo a él mismo.
 *
 * Iterativa a propósito: una cadena de sesenta acciones desborda la pila de
 * recursión mucho antes de que la memoria sea un problema. El conjunto de
 * vistos también la hace inmune a un ciclo ya guardado en la base.
 */
export function alcanzaDesde(id: string, vecinos: Map<string, string[]>) {
  const vistos = new Set<string>();
  const pila = [...(vecinos.get(id) ?? [])];
  while (pila.length) {
    const actual = pila.pop()!;
    if (vistos.has(actual)) continue;
    vistos.add(actual);
    pila.push(...(vecinos.get(actual) ?? []));
  }
  vistos.delete(id);
  return vistos;
}

/**
 * Las que harían círculo si se marcaran en ese lado (§6).
 *
 * - `antes` (esta requiere a X): lo prohibido es todo lo que **ya requiere a
 *   esta**, directa o por cadena.
 * - `despues` (X requiere a esta): lo prohibido es todo lo que **esta ya
 *   requiere**, directa o por cadena.
 *
 * No incluye la propia acción: no es candidata y se filtra antes (§7).
 */
export function prohibidas(id: string, requisitos: Requisito[], lado: Lado) {
  return alcanzaDesde(
    id,
    lado === "antes" ? esperanA(requisitos) : requiereDe(requisitos),
  );
}

/** Una acción elegible, con todo lo que la fila necesita pintar (§4.1). */
export type Candidata<T> = {
  accion: T;
  /** Haría círculo: la casilla va deshabilitada y con el motivo. */
  prohibida: boolean;
};

/** Un grupo de la lista: una meta, o lo que no es de ninguna (§4.2). */
export type GrupoCandidatas<T> = {
  clave: string;
  titulo: string;
  candidatas: Candidata<T>[];
};

/**
 * Por semana, de la más lejana a la boda a la más cercana, y a igualdad por
 * título. Las ideas sueltas no tienen semana y se van al final de su grupo.
 *
 * Es el mismo criterio que `porFecha` en `lib/metas.ts`, repetido aquí porque
 * allí es privado y exportarlo solo para esto ataría los dos módulos por un
 * detalle de orden.
 */
function porSemana(a: Elegible, b: Elegible) {
  const porTitulo = a.titulo.localeCompare(b.titulo, "es");
  if (a.inicioSemanas === null || b.inicioSemanas === null) {
    if (a.inicioSemanas === b.inicioSemanas) return porTitulo;
    return a.inicioSemanas === null ? 1 : -1;
  }
  return b.inicioSemanas - a.inicioSemanas || porTitulo;
}

/**
 * Las candidatas de un lado, agrupadas por meta (§4.2).
 *
 * `metas` llega **ya ordenada** —el orden derivado de `ordenarMetas`, el mismo
 * de los carriles del Mapa— y los grupos salen en ese orden, con "Sin meta" al
 * final. Un grupo vacío no sale: una meta cuyas acciones son todas la propia
 * no tiene nada que ofrecer.
 */
export function candidatas<T extends Elegible>(
  id: string,
  acciones: T[],
  requisitos: Requisito[],
  metas: { id: string; titulo: string }[],
  lado: Lado,
  nombreSinMeta: string,
): GrupoCandidatas<T>[] {
  const vedadas = prohibidas(id, requisitos, lado);
  const conMeta = new Set(metas.map((m) => m.id));
  const otras = acciones.filter((a) => a.id !== id);

  const grupoDe = (lista: T[]): Candidata<T>[] =>
    [...lista]
      .sort(porSemana)
      .map((accion) => ({ accion, prohibida: vedadas.has(accion.id) }));

  const grupos: GrupoCandidatas<T>[] = [];
  for (const m of metas) {
    const suyas = otras.filter((a) => a.metaId === m.id);
    if (suyas.length > 0) {
      grupos.push({ clave: m.id, titulo: m.titulo, candidatas: grupoDe(suyas) });
    }
  }
  // Lo que no tiene meta, y lo que apunta a una meta que ya no está.
  const sueltas = otras.filter((a) => !a.metaId || !conMeta.has(a.metaId));
  if (sueltas.length > 0) {
    grupos.push({ clave: "sin-meta", titulo: nombreSinMeta, candidatas: grupoDe(sueltas) });
  }
  return grupos;
}

/**
 * El grafo que queda al guardar las dos listas de una acción (§5).
 *
 * Se van **todas** las aristas viejas que tocan a esta acción, en los dos
 * sentidos, y entran las elegidas. El resto del grafo no se toca: lo que dos
 * acciones ajenas tengan entre ellas no es asunto de este diálogo.
 */
export function conNuevas(
  id: string,
  antes: string[],
  despues: string[],
  requisitos: Requisito[],
): Requisito[] {
  const ajenas = requisitos.filter((r) => r.accionId !== id && r.requiereId !== id);
  const limpia = (lista: string[]) => [...new Set(lista)].filter((x) => x !== id);
  return [
    ...ajenas,
    ...limpia(antes).map((requiereId) => ({ accionId: id, requiereId })),
    ...limpia(despues).map((accionId) => ({ accionId, requiereId: id })),
  ];
}

/**
 * Si un conjunto de aristas se muerde la cola.
 *
 * Es el Kahn de `ordenPorDependencia` sin ordenar nada: se van sacando las que
 * no esperan a nadie y, si queda algo sin poder salir, hay ciclo. Se comprueba
 * el grafo **entero** y no solo lo que pasa por una acción: editar las dos
 * direcciones a la vez puede cerrar un círculo entre otras dos (§6).
 */
export function tieneCiclo(requisitos: Requisito[]) {
  const requiere = requiereDe(requisitos);
  // Todo nodo entra, también el que solo es destino: sin él en el mapa, quien
  // lo requiere no se vacía nunca y una cadena sana se denunciaría como ciclo.
  // La auto-arista se **ignora**, no denuncia el grafo entero: una sola fila
  // (X, X) de datos viejos —la clave primaria es el par, así que la base no la
  // impide— bloqueaba toda edición de orden de esa boda, hasta la de acciones
  // que no tenían nada que ver con X. `requiereDe` ya la descarta, así que
  // basta con no sembrarla aquí.
  const pendientes = new Map<string, Set<string>>();
  for (const r of requisitos) {
    if (r.accionId === r.requiereId) continue;
    if (!pendientes.has(r.accionId)) pendientes.set(r.accionId, new Set(requiere.get(r.accionId)));
    if (!pendientes.has(r.requiereId)) pendientes.set(r.requiereId, new Set(requiere.get(r.requiereId)));
  }

  while (pendientes.size > 0) {
    const libre = [...pendientes].find(([, suyas]) => suyas.size === 0);
    if (!libre) return true;
    pendientes.delete(libre[0]);
    for (const suyas of pendientes.values()) suyas.delete(libre[0]);
  }
  return false;
}

/**
 * Con quién está unida una acción, en los dos sentidos y solo directamente
 * (docs/dependencias.md §10.2).
 *
 * Para "quitar unión" en el celular: la pareja toca un bloque y luego el otro
 * extremo de la unión que quiere soltar, y le da igual en qué sentido apunta
 * la flecha. Las uniones indirectas no entran: no hay ninguna flecha que
 * tocar entre dos que solo se relacionan por una cadena.
 */
export function unidasA(id: string, requisitos: Requisito[]) {
  const suyas = new Set<string>();
  for (const r of requisitos) {
    if (r.accionId === r.requiereId) continue;
    if (r.accionId === id) suyas.add(r.requiereId);
    if (r.requiereId === id) suyas.add(r.accionId);
  }
  return suyas;
}

/**
 * La semana donde cae un bloque tras arrastrarlo (docs/dependencias.md §10).
 *
 * El eje del Camino va de la semana más lejana a la izquierda a la boda y lo
 * de después a la derecha, y `inicioSemanas` se cuenta **hacia atrás**. Así
 * que arrastrar a la derecha acerca a la boda, o sea **resta** semanas. Es un
 * signo que se invierte sin que se note, y de ahí que viva aquí y no dentro
 * del componente.
 *
 * `anchoSemana` es el ancho real de una columna, medido en el DOM: vale 36 px
 * desde `sm` y en el celular las columnas se reparten el ancho con `1fr`.
 *
 * El tope de ±260 es el mismo que aplica `ponerEnSemana`: cinco años a cada
 * lado. Sin él, un arrastre con el ratón fuera de la pantalla mandaría un
 * bloque a la semana 4000 y el Gantt quedaría con miles de columnas vacías.
 */
export function semanaAlArrastrar(
  inicioSemanas: number,
  deltaX: number,
  anchoSemana: number,
) {
  if (!Number.isFinite(anchoSemana) || anchoSemana <= 0) return inicioSemanas;
  const pasos = Math.round(deltaX / anchoSemana);
  return Math.max(-260, Math.min(260, inicioSemanas - pasos));
}
