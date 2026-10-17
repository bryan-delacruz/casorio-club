/**
 * Lógica de metas y del camino (docs/metas.md). Todo puro: recibe acciones y
 * dependencias y devuelve órdenes y conjuntos, para probarlo sin base ni React.
 */

import { cuentaDe } from "./pagos.ts";

export type AccionCamino = {
  id: string;
  titulo: string;
  estado: "por_hacer" | "haciendo" | "hecho";
  inicioSemanas: number | null;
  duracionSemanas: number;
  monto: string | null;
  metaId: string | null;
  esHito: boolean;
};

/**
 * Una acción que ya está en el camino: tiene semana puesta.
 *
 * El tipo existe para que el compilador atrape la idea suelta en vez de
 * confiar en que cada llamador filtró antes (docs/metas.md §2): `inicioDe`,
 * `finDe` y `etapas` solo aceptan esto, y el filtro se hace una vez, en el
 * borde, con `enCamino`.
 */
export type AccionEnCamino = AccionCamino & { inicioSemanas: number };

export type Requisito = { accionId: string; requiereId: string };

/** El borde: de una lista cualquiera, lo que está en el camino. */
export function enCamino<T extends AccionCamino>(acciones: T[]): (T & { inicioSemanas: number })[] {
  return acciones.filter((a): a is T & { inicioSemanas: number } => a.inicioSemanas !== null);
}

/** Idea suelta: sin semana no está en el camino. */
export const esIdea = (a: Pick<AccionCamino, "inicioSemanas">) => a.inicioSemanas === null;

export const inicioDe = (a: Pick<AccionEnCamino, "inicioSemanas">) => a.inicioSemanas;

/** Un hito no dura: es un día. */
export const duracionDe = (a: Pick<AccionCamino, "duracionSemanas" | "esHito">) =>
  a.esHito ? 1 : Math.max(1, a.duracionSemanas);

/** El final, también contado hacia atrás: empezar en 12 y durar 4 acaba en 9. */
export const finDe = (a: Pick<AccionEnCamino, "inicioSemanas" | "duracionSemanas" | "esHito">) =>
  inicioDe(a) - duracionDe(a) + 1;

/** A cuántas semanas de la boda estamos hoy. Null si todavía no hay fecha. */
export function semanasHastaLaBoda(fecha: string | null, ahora = new Date()) {
  if (!fecha) return null;
  const [a, m, d] = fecha.split("-").map(Number);
  const dias = (new Date(a, m - 1, d).getTime() - ahora.getTime()) / 86_400_000;
  return Math.round(dias / 7);
}

/**
 * La semana que se escribe cuando algo entra al camino y nadie dijo cuándo.
 *
 * Se decide al escribir y no al leer (docs/metas.md §2.4): así la pareja ve el
 * número y lo puede cambiar, en vez de arrastrar una suposición invisible.
 * Dentro de una etapa, `hitoSemana + duracion` la deja terminando justo la
 * semana anterior al hito, o sea dentro de esa etapa.
 */
export function semanaPorDefecto({
  hitoSemana = null,
  semanasHastaLaBoda = null,
  duracion = 1,
}: {
  hitoSemana?: number | null;
  semanasHastaLaBoda?: number | null;
  duracion?: number;
}) {
  if (hitoSemana !== null) return hitoSemana + Math.max(1, duracion);
  // Ocho semanas fijas le ponían a quien se casa en tres una fecha ya pasada.
  if (semanasHastaLaBoda !== null) return Math.max(1, semanasHastaLaBoda);
  return 8;
}

/**
 * Por tiempo: lo más temprano primero (más semanas es más lejos de la boda) y,
 * a igualdad, por título. Es el orden de las tarjetas dentro de un carril del
 * Mapa, donde las dependencias no se dibujan (docs/metas.md §7).
 */
export function ordenPorSemana<T extends AccionCamino & { inicioSemanas: number }>(acciones: T[]): T[] {
  return [...acciones].sort(
    (a, b) => b.inicioSemanas - a.inicioSemanas || a.titulo.localeCompare(b.titulo, "es"),
  );
}

/** id → ids que requiere, solo entre las acciones dadas. */
function requisitosEntre(ids: Set<string>, requisitos: Requisito[]) {
  const de = new Map<string, string[]>();
  for (const r of requisitos) {
    if (!ids.has(r.accionId) || !ids.has(r.requiereId) || r.accionId === r.requiereId) continue;
    de.set(r.accionId, [...(de.get(r.accionId) ?? []), r.requiereId]);
  }
  return de;
}

/**
 * A igualdad de dependencias: la que empieza antes (más semanas), luego por
 * título. Las ideas sueltas no tienen semana y se van al final.
 */
const porFecha = (a: AccionCamino, b: AccionCamino) => {
  const porTitulo = a.titulo.localeCompare(b.titulo, "es");
  if (a.inicioSemanas === null || b.inicioSemanas === null) {
    if (a.inicioSemanas === b.inicioSemanas) return porTitulo;
    return a.inicioSemanas === null ? 1 : -1;
  }
  return b.inicioSemanas - a.inicioSemanas || porTitulo;
};

/**
 * Orden de dependencia (topológico, Kahn): primero lo que no espera a nada y
 * después lo que depende de ello. Estable por fecha. Si hubiera un ciclo (la
 * base lo impide, pero los datos viejos podrían traerlo), lo que queda se
 * agrega al final por fecha en vez de colgarse.
 */
export function ordenPorDependencia<T extends AccionCamino>(acciones: T[], requisitos: Requisito[]): T[] {
  const ids = new Set(acciones.map((a) => a.id));
  const requiere = requisitosEntre(ids, requisitos);
  const pendientes = new Map(acciones.map((a) => [a.id, new Set(requiere.get(a.id) ?? [])]));
  const resultado: T[] = [];
  const restantes = [...acciones].sort(porFecha);

  while (restantes.length) {
    const i = restantes.findIndex((a) => pendientes.get(a.id)!.size === 0);
    if (i === -1) {
      resultado.push(...restantes);
      break;
    }
    const [lista] = restantes.splice(i, 1);
    resultado.push(lista);
    for (const p of pendientes.values()) p.delete(lista.id);
  }
  return resultado;
}

/**
 * Cadena principal: la secuencia más larga de dependencias (por cantidad de
 * pasos y, a igualdad, por semanas) que termina en la última acción de la meta.
 * Es la que hay que vigilar: si un eslabón se atrasa, se atrasa la meta.
 */
export function cadenaPrincipal(acciones: AccionCamino[], requisitos: Requisito[]): Set<string> {
  const conSemanas = enCamino(acciones);
  if (conSemanas.length === 0) return new Set();
  const ids = new Set(conSemanas.map((a) => a.id));
  const requiere = requisitosEntre(ids, requisitos);
  const orden = ordenPorDependencia(conSemanas, requisitos);

  const pasos = new Map<string, number>();
  const semanas = new Map<string, number>();
  const previo = new Map<string, string>();
  for (const a of orden) {
    let mejor: string | undefined;
    for (const r of requiere.get(a.id) ?? []) {
      if (!pasos.has(r)) continue; // parte de un ciclo: se ignora
      if (
        !mejor ||
        pasos.get(r)! > pasos.get(mejor)! ||
        (pasos.get(r) === pasos.get(mejor) && semanas.get(r)! > semanas.get(mejor)!)
      ) {
        mejor = r;
      }
    }
    pasos.set(a.id, (mejor ? pasos.get(mejor)! : 0) + 1);
    semanas.set(a.id, (mejor ? semanas.get(mejor)! : 0) + duracionDe(a));
    if (mejor) previo.set(a.id, mejor);
  }

  // La última acción en el tiempo (menor fin); a igualdad, la de cadena más larga.
  const ultima = [...conSemanas].sort(
    (a, b) => finDe(a) - finDe(b) || pasos.get(b.id)! - pasos.get(a.id)!,
  )[0];
  const cadena = new Set<string>();
  for (let id: string | undefined = ultima.id; id; id = previo.get(id)) cadena.add(id);
  // Una sola acción suelta no es una cadena.
  return cadena.size > 1 ? cadena : new Set();
}

/**
 * Lista para empezar: por hacer, con requisitos, y todos ya hechos. Sin
 * requisitos no se marca: todo lo suelto estaría "listo" y la señal se perdería.
 */
export function listasParaEmpezar(acciones: AccionCamino[], requisitos: Requisito[]): Set<string> {
  const estado = new Map(acciones.map((a) => [a.id, a.estado]));
  const requiere = requiereDe(requisitos);

  const listas = new Set<string>();
  for (const a of acciones) {
    const suyos = (requiere.get(a.id) ?? []).filter((id) => estado.has(id));
    if (a.estado === "por_hacer" && suyos.length > 0 && suyos.every((id) => estado.get(id) === "hecho")) {
      listas.add(a.id);
    }
  }
  return listas;
}

/**
 * Avance, rango en semanas y monto de una meta, derivados de sus acciones.
 *
 * El monto suma lo que va **costando** cada acción, `max(el estimado, lo
 * puesto)` (docs/pagos.md §4.3): una acción pagada sin monto dejaría de
 * valer S/ 0. Por eso recibe los pagos ya agrupados por acción, con
 * `pagosPorAccion`: enriquecer las acciones con su pago se colaría en los
 * sitios que no lo necesitan.
 */
export function resumenMeta(
  acciones: AccionCamino[],
  pagos: Map<string, { monto: string }[]> = new Map(),
) {
  const conSemanas = enCamino(acciones);
  return {
    total: acciones.length,
    hechas: acciones.filter((a) => a.estado === "hecho").length,
    inicio: conSemanas.length ? Math.max(...conSemanas.map(inicioDe)) : null,
    fin: conSemanas.length ? Math.min(...conSemanas.map(finDe)) : null,
    // En céntimos y se divide una vez: sumar soles acción por acción arrastra
    // la coma flotante y el total de la meta se desvía (docs/pagos.md §4.3).
    monto:
      acciones.reduce(
        (s, a) => s + cuentaDe(a.monto, pagos.get(a.id) ?? []).centimos.costando,
        0,
      ) / 100,
  };
}

// ---------------------------------------------------------------------------
// El orden de las metas, derivado (docs/metas.md §11.3)
// ---------------------------------------------------------------------------

/** Lo mínimo para ordenar una meta: su id y los dos desempates de la fila. */
export type MetaOrdenable = { id: string; orden: number; creadaEl: Date | string | number };

const enMs = (f: Date | string | number) => (f instanceof Date ? f.getTime() : new Date(f).getTime());

/**
 * El orden de los carriles del Mapa (§7) y de los grupos del Camino (§5).
 *
 * Se deriva de las acciones y no se guarda: una precedencia propia de la meta
 * sería una segunda fuente de verdad capaz de contradecir las semanas de sus
 * acciones, que es el error que costó retirar `momento` (§2). Manda la semana
 * de inicio más temprana de sus acciones —más semanas es más lejos de la
 * boda—, y `metas.orden` queda solo como desempate.
 *
 * Las ideas sueltas no tienen semana, así que no cuentan: una meta que solo
 * las tiene va al final junto a la que no tiene ninguna acción.
 */
export function ordenarMetas<T extends MetaOrdenable>(metas: T[], acciones: AccionCamino[]): T[] {
  const masTemprana = new Map<string, number>();
  for (const a of enCamino(acciones)) {
    if (!a.metaId) continue;
    const previa = masTemprana.get(a.metaId);
    if (previa === undefined || inicioDe(a) > previa) masTemprana.set(a.metaId, inicioDe(a));
  }
  return [...metas].sort((a, b) => {
    const sa = masTemprana.get(a.id);
    const sb = masTemprana.get(b.id);
    if (sa !== sb) {
      if (sa === undefined) return 1;
      if (sb === undefined) return -1;
      return sb - sa;
    }
    return a.orden - b.orden || enMs(a.creadaEl) - enMs(b.creadaEl);
  });
}

/**
 * A quién espera esta meta: las metas de las acciones que las suyas
 * requieren. Alimenta la línea "↳ después de …" de la barra resumen (§11.3).
 *
 * Devuelve las metas dadas, filtradas y **en el orden en que llegan**: quien
 * llama recibe la lista ya ordenada por `ordenarMetas` (se ordena una sola vez
 * al leerlas, en `datos.ts`), así que respetar ese orden basta para unirlas
 * con " y ".
 *
 * Un requisito hacia una acción borrada o sin meta no cuenta, y tampoco el que
 * se queda dentro de la misma meta: eso ya se dibuja como flecha. Dos metas que
 * se esperan entre sí se nombran mutuamente: esto describe lo que la pareja
 * encadenó, no valida una regla.
 */
export function metasQueEspera<T extends { id: string }>(
  metaId: string,
  acciones: AccionCamino[],
  requisitos: Requisito[],
  metas: T[],
): T[] {
  const metaDe = new Map(acciones.map((a) => [a.id, a.metaId]));
  const espera = new Set<string>();
  for (const r of requisitos) {
    if (metaDe.get(r.accionId) !== metaId) continue;
    const previa = metaDe.get(r.requiereId);
    if (!previa || previa === metaId) continue;
    espera.add(previa);
  }
  return metas.filter((m) => espera.has(m.id));
}

// ---------------------------------------------------------------------------
// Etapas: el camino partido por sus hitos (docs/metas.md §6)
// ---------------------------------------------------------------------------

/**
 * Un tramo del calendario. "Etapa" es un nombre interno y nunca se dibuja:
 * desde la enmienda 2 no titula ningún grupo del Camino ni ningún carril del
 * Mapa, y su único trabajo es contestar cuántas cosas faltan antes del
 * próximo hito (docs/metas.md §5.3, §6).
 */
export type Etapa<T extends AccionCamino = AccionEnCamino> = {
  /**
   * Estable entre renders: el id del hito que la cierra. No la semana, que
   * cambia en cuanto se edita el hito.
   */
  clave: string;
  titulo: string;
  /** La semana del corte. Null en el grupo final y cuando no hay hitos. */
  semana: number | null;
  /** El grupo de después del último hito: no lo cierra ningún hito. */
  final: boolean;
  acciones: T[];
};

export const CLAVE_TODO = "todo-el-camino";

/**
 * Las etapas del camino, de la más temprana a la más tardía.
 *
 * La etapa de una acción es el hito más temprano que la sigue en el tiempo,
 * medido por `finDe`: la etapa de algo es aquella en la que hay que
 * terminarlo, así que lo que empieza antes de un hito pero acaba después cae
 * en la etapa siguiente. Esa es la verdad incómoda que hay que ver.
 *
 * El grupo final solo existe si hay algo después del último hito: nadie pide
 * ya un tramo vacío donde soltar, porque los carriles del Mapa son las metas
 * (docs/metas.md §7.1).
 *
 * `metas` solo sirve para desempatar el título cuando dos hitos caen en la
 * misma semana: primero por orden de meta y luego por título.
 */
export function etapas<T extends AccionCamino>(
  acciones: (T & { inicioSemanas: number })[],
  requisitos: Requisito[],
  metas: { id: string }[] = [],
): Etapa<T & { inicioSemanas: number }>[] {
  type A = T & { inicioSemanas: number };
  const hitos = acciones.filter((a) => a.esHito);

  // Sin hitos el camino no se parte: un solo grupo. El título no se muestra
  // en ninguna pantalla; está para que el grupo se pueda nombrar al depurar.
  if (hitos.length === 0) {
    return [
      {
        clave: CLAVE_TODO,
        titulo: "Todo el camino",
        semana: null,
        final: false,
        acciones: ordenPorDependencia(acciones, requisitos),
      },
    ];
  }

  const ordenDeMeta = (a: A) => {
    const i = metas.findIndex((m) => m.id === a.metaId);
    return i === -1 ? metas.length : i;
  };
  const porMetaYTitulo = (a: A, b: A) =>
    ordenDeMeta(a) - ordenDeMeta(b) || a.titulo.localeCompare(b.titulo, "es");

  // Los cortes, de la semana más alta (lo más temprano) a la más baja. Dos
  // hitos en la misma semana son un solo corte, nunca dos etapas.
  const cortes = [...new Set(hitos.map(inicioDe))].sort((a, b) => b - a);
  const ultimo = cortes[cortes.length - 1];

  const grupos = new Map<number, A[]>(cortes.map((s) => [s, []]));
  const despues: A[] = [];
  for (const a of acciones) {
    // El hito más temprano que termina igual o después que esta acción.
    const corte = cortes.find((s) => s <= finDe(a));
    if (corte === undefined) despues.push(a);
    else grupos.get(corte)!.push(a);
  }

  const deLaSemana = (semana: number) => hitos.filter((h) => inicioDe(h) === semana).sort(porMetaYTitulo);
  const nombreDe = (semana: number) => deLaSemana(semana).map((h) => h.titulo).join(" y ");

  /** Dentro de la etapa: orden de dependencia, y el hito que la cierra al final. */
  const ordenar = (lista: A[]) => {
    const orden = ordenPorDependencia(lista, requisitos);
    return [...orden.filter((a) => !a.esHito), ...orden.filter((a) => a.esHito)];
  };

  const cerradas: Etapa<A>[] = cortes.map((semana) => ({
    // El primer hito de la semana da la clave: su id no cambia al editarlo.
    clave: deLaSemana(semana)[0].id,
    titulo: `Hasta ${nombreDe(semana)}`,
    semana,
    final: false,
    acciones: ordenar(grupos.get(semana)!),
  }));

  if (despues.length === 0) return cerradas;
  return [
    ...cerradas,
    {
      clave: `final:${deLaSemana(ultimo)[0].id}`,
      titulo: `Después de ${nombreDe(ultimo)}`,
      semana: null,
      final: true,
      acciones: ordenar(despues),
    },
  ];
}

// ---------------------------------------------------------------------------
// Qué toca ahora y el próximo hito (docs/metas.md §5.2, §5.3)
// ---------------------------------------------------------------------------

/** id → ids que requiere, sin filtrar por lista. */
function requiereDe(requisitos: Requisito[]) {
  const de = new Map<string, string[]>();
  for (const r of requisitos) de.set(r.accionId, [...(de.get(r.accionId) ?? []), r.requiereId]);
  return de;
}

/**
 * Lo que toca ahora: hasta `limite` acciones del camino que ya se pueden
 * hacer, lo que tocaba antes primero (docs/metas.md §5.2).
 *
 * No es `listasParaEmpezar` con otro nombre: aquella exige TENER requisitos
 * porque marca el desbloqueo reciente en el Gantt, y con esa regla una boda
 * recién empezada, sin ninguna dependencia, tendría la banda vacía. Aquí una
 * acción sin requisitos está desbloqueada, que es lo que se espera leer.
 *
 * `semanasHastaLaBoda` no cambia la selección ni el orden —sin fecha la banda
 * funciona igual—; viaja con la llamada porque es lo que la banda necesita
 * para decir cuándo tocaba cada cosa.
 */
export function queTocaAhora<T extends AccionCamino>(
  acciones: T[],
  requisitos: Requisito[],
  // La firma la fija la spec (§5.2) y la banda ya tiene el dato a mano: se
  // queda aunque la selección no dependa de la fecha, para no cambiarle la
  // llamada a nadie el día que la banda ordene por calendario.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  semanasHastaLaBoda: number | null = null,
  limite = 5,
): (T & { inicioSemanas: number })[] {
  const estado = new Map(acciones.map((a) => [a.id, a.estado]));
  const requiere = requiereDe(requisitos);

  const candidatas = enCamino(acciones).filter((a) => {
    if (a.estado === "hecho") return false;
    // Un requisito que apunta a algo borrado no bloquea a nadie.
    const suyos = (requiere.get(a.id) ?? []).filter((id) => estado.has(id));
    return suyos.every((id) => estado.get(id) === "hecho");
  });

  const prisa = (a: T) => (a.estado === "haciendo" ? 0 : 1);
  return candidatas
    .sort(
      (a, b) =>
        b.inicioSemanas - a.inicioSemanas ||
        prisa(a) - prisa(b) ||
        a.titulo.localeCompare(b.titulo, "es"),
    )
    .slice(0, limite);
}

/**
 * Por qué la banda de "Qué toca ahora" salió vacía. Son dos casos con dos
 * textos: quedan acciones pero todas esperan a otra ("bloqueadas"), o no
 * queda ninguna por hacer ("todo_hecho"). Se decide aquí, junto a la
 * selección, para que el componente no repita su criterio de "en camino".
 */
export function motivoBandaVacia<T extends AccionCamino>(
  acciones: T[],
): "bloqueadas" | "todo_hecho" {
  return enCamino(acciones).some((a) => a.estado !== "hecho") ? "bloqueadas" : "todo_hecho";
}

/**
 * El próximo hito: el que está en el camino, no está hecho y tiene la semana
 * más alta, o sea el más temprano (docs/metas.md §5.3). Null si no hay.
 *
 * `metas` desempata cuando dos hitos caen en la misma semana, con el mismo
 * criterio que las etapas: por orden de meta y, a igualdad, por título.
 */
export function proximoHito<T extends AccionCamino>(
  acciones: T[],
  metas: { id: string }[] = [],
): (T & { inicioSemanas: number }) | null {
  const ordenDeMeta = (a: T) => {
    const i = metas.findIndex((m) => m.id === a.metaId);
    return i === -1 ? metas.length : i;
  };
  const hitos = enCamino(acciones).filter((a) => a.esHito && a.estado !== "hecho");
  if (hitos.length === 0) return null;
  return hitos.sort(
    (a, b) =>
      b.inicioSemanas - a.inicioSemanas ||
      ordenDeMeta(a) - ordenDeMeta(b) ||
      a.titulo.localeCompare(b.titulo, "es"),
  )[0];
}

/**
 * El último hito que ya pasó: el que está en el camino, `hecho` y con la
 * semana más baja, o sea el más tardío en el tiempo, porque las semanas se
 * cuentan hacia atrás (docs/metas.md §5.3.1). Null si no hay ninguno.
 *
 * No es "el último que toqué": un hito sin hacer no cuenta, y un hito que es
 * idea suelta tampoco, porque nunca estuvo en el camino.
 */
export function ultimoHitoHecho<T extends AccionCamino>(
  acciones: T[],
  metas: { id: string }[] = [],
): (T & { inicioSemanas: number }) | null {
  const ordenDeMeta = (a: T) => {
    const i = metas.findIndex((m) => m.id === a.metaId);
    return i === -1 ? metas.length : i;
  };
  const hitos = enCamino(acciones).filter((a) => a.esHito && a.estado === "hecho");
  if (hitos.length === 0) return null;
  return hitos.sort(
    (a, b) =>
      a.inicioSemanas - b.inicioSemanas ||
      ordenDeMeta(a) - ordenDeMeta(b) ||
      a.titulo.localeCompare(b.titulo, "es"),
  )[0];
}

/**
 * Qué cuenta la tira de hitos, en uno de cuatro casos (docs/metas.md §5.3.1).
 *
 * Compone `proximoHito` y `ultimoHitoHecho` en vez de dejar tres condiciones
 * dentro del componente: la distinción entre "no hay ningún hito" y "hay
 * hitos pero son ideas sueltas" es la que la pantalla se equivocaría en
 * reproducir, y así se prueba de una vez.
 */
export type EstadoDeHitos<T extends AccionCamino> =
  | { tipo: "proximo"; hito: T & { inicioSemanas: number } }
  | { tipo: "cierre"; hito: T & { inicioSemanas: number } }
  | { tipo: "sin-semana" }
  | { tipo: "ninguno" };

export function estadoDeHitos<T extends AccionCamino>(
  acciones: T[],
  metas: { id: string }[] = [],
): EstadoDeHitos<T> {
  const proximo = proximoHito(acciones, metas);
  if (proximo) return { tipo: "proximo", hito: proximo };
  const ultimo = ultimoHitoHecho(acciones, metas);
  if (ultimo) return { tipo: "cierre", hito: ultimo };
  // Quedan los hitos que nunca entraron al camino: la casilla está marcada y
  // no se ve nada, así que hay que decir que falta la semana.
  return acciones.some((a) => a.esHito) ? { tipo: "sin-semana" } : { tipo: "ninguno" };
}

/**
 * Cómo se nombra el corte de una semana: dos hitos a la vez se leen unidos
 * por " y " (docs/metas.md §6.1).
 */
export function nombreDeHitos<T extends AccionCamino>(
  acciones: T[],
  semana: number,
  metas: { id: string }[] = [],
): string {
  const ordenDeMeta = (a: T) => {
    const i = metas.findIndex((m) => m.id === a.metaId);
    return i === -1 ? metas.length : i;
  };
  return enCamino(acciones)
    .filter((a) => a.esHito && a.inicioSemanas === semana)
    .sort((a, b) => ordenDeMeta(a) - ordenDeMeta(b) || a.titulo.localeCompare(b.titulo, "es"))
    .map((a) => a.titulo)
    .join(" y ");
}

/**
 * Cuántas cosas faltan ANTES de un hito: las acciones no hechas de su etapa,
 * sin contar los hitos mismos, porque la frase dice "te faltan N cosas antes"
 * (docs/metas.md §5.3).
 */
export function faltanAntesDe<T extends AccionCamino>(
  hito: Pick<AccionCamino, "id">,
  acciones: T[],
  requisitos: Requisito[],
  metas: { id: string }[] = [],
): number {
  const suya = etapas(enCamino(acciones), requisitos, metas).find((e) =>
    e.acciones.some((a) => a.id === hito.id),
  );
  if (!suya) return 0;
  return suya.acciones.filter((a) => !a.esHito && a.estado !== "hecho").length;
}

/**
 * Cuántas semanas faltan para una semana del camino: positivo si todavía no
 * llega, cero si es esta semana y negativo si ya pasó. Null sin fecha de
 * boda, que es cuando no hay cuenta regresiva que dar (docs/metas.md §5.3).
 */
export function faltanSemanas(semanasHastaLaBoda: number | null, semana: number) {
  return semanasHastaLaBoda === null ? null : semanasHastaLaBoda - semana;
}

/**
 * Cuántas cosas del camino quedaron en una semana que ya pasó.
 *
 * Solo informa al mover la fecha (docs/fecha-de-la-boda.md §4.4): nada se
 * reprograma solo, porque las semanas las puso la pareja a mano. Las ideas
 * sueltas no cuentan —no están en el camino— ni lo hecho, que ya no espera.
 */
export function cuantasYaPasaron(acciones: AccionCamino[], semanasHastaLaBoda: number | null) {
  if (semanasHastaLaBoda === null) return 0;
  return enCamino(acciones).filter(
    (a) => a.estado !== "hecho" && a.inicioSemanas > semanasHastaLaBoda,
  ).length;
}

// ---------------------------------------------------------------------------
// Plantilla "Registro civil" (Perú)
// ---------------------------------------------------------------------------

export type PasoPlantilla = {
  clave: string;
  titulo: string;
  inicio: number;
  dura: number;
  requiere: string[];
  hito?: boolean;
  tiempo?: boolean;
  /** Títulos anteriores, para reconocer bodas que ya aplicaron la plantilla (docs/metas.md §4.1). Permanente. */
  alias?: string[];
};

export const REGISTRO_CIVIL: { titulo: string; pasos: PasoPlantilla[] } = {
  titulo: "Registro civil",
  pasos: [
    { clave: "partidas", titulo: "Partida de nacimiento de los dos", inicio: 12, dura: 2, requiere: [], tiempo: true },
    { clave: "dni", titulo: "Copia del DNI de los dos", inicio: 12, dura: 1, requiere: [], tiempo: true },
    { clave: "domicilio", titulo: "Certificado domiciliario", inicio: 11, dura: 1, requiere: [], tiempo: true },
    { clave: "medico", titulo: "Certificado médico prenupcial", inicio: 9, dura: 2, requiere: [], tiempo: true },
    { clave: "testigos", titulo: "Elegir a los dos testigos", inicio: 10, dura: 1, requiere: [] },
    {
      clave: "expediente",
      titulo: "Expediente en la municipalidad",
      alias: ["Presentar el expediente en la municipalidad"],
      inicio: 7,
      dura: 1,
      requiere: ["partidas", "dni", "domicilio", "medico", "testigos"],
      tiempo: true,
    },
    { clave: "edicto", titulo: "Edicto matrimonial", alias: ["Publicar el edicto matrimonial"], inicio: 6, dura: 2, requiere: ["expediente"], tiempo: true },
    { clave: "ceremonia", titulo: "Ceremonia civil", inicio: 0, dura: 1, requiere: ["edicto"], hito: true },
    { clave: "acta", titulo: "Acta de matrimonio", alias: ["Recoger el acta de matrimonio"], inicio: -2, dura: 1, requiere: ["ceremonia"], tiempo: true },
  ],
};

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------
// La plantilla del plan: las cuatro metas (docs/plantillas.md)
// ---------------------------------------------------------------------------

/**
 * Una plantilla es una lista de metas con sus pasos. Las claves son únicas en
 * TODA la plantilla y no por meta: así un paso puede requerir una clave de otra
 * meta y los cruces se escriben sin un tipo aparte (docs/plantillas.md §6).
 */
export type Plantilla = {
  metas: { clave: string; titulo: string; pasos: PasoPlantilla[] }[];
};

/**
 * El esqueleto completo de una boda civil peruana: 4 metas, 24 acciones, 21
 * dependencias (docs/plantillas.md §4).
 *
 * Ningún paso trae monto: `monto = 0` haría que `cuentaDe` lo leyera como total
 * conocido y diera "pagado del todo" sin un solo pago (§3). Las semanas están
 * elegidas para que `ordenarMetas` derive 16 → 12 → 11 → 10, que es el orden de
 * los carriles (§2); editarlas cambia ese orden con ellas.
 */
export const PLAN_COMPLETO: Plantilla = {
  metas: [
    {
      clave: "ahorro",
      titulo: "El ahorro",
      pasos: [
        { clave: "cuanto", titulo: "Cuánto queremos gastar", inicio: 16, dura: 1, requiere: [], tiempo: true },
        { clave: "quien-pone", titulo: "Quién pone cuánto", inicio: 15, dura: 1, requiere: ["cuanto"], tiempo: true },
        { clave: "bote", titulo: "El bote común del ahorro", inicio: 14, dura: 1, requiere: ["quien-pone"], tiempo: true },
        // Nueve semanas a propósito: es la barra larga que cruza el Gantt y
        // termina cinco semanas antes, cuando se pagan los saldos (§4.1).
        { clave: "aportes", titulo: "Los aportes de cada mes", inicio: 13, dura: 9, requiere: ["bote"], tiempo: true },
      ],
    },
    // Los nueve pasos del papeleo se componen, no se copian: si REGISTRO_CIVIL
    // cambia, la plantilla del plan cambia con él (§4.2).
    { clave: "registro", titulo: REGISTRO_CIVIL.titulo, pasos: REGISTRO_CIVIL.pasos },
    {
      clave: "ceremonia-lista",
      titulo: "La ceremonia",
      pasos: [
        // Ropa, anillos y fotos esperan al bote: no se compra ni se reserva
        // antes de saber de dónde sale la plata (§4.5).
        { clave: "ropa", titulo: "La ropa de los dos", inicio: 11, dura: 4, requiere: ["bote"], tiempo: true },
        { clave: "anillos", titulo: "Los anillos", inicio: 10, dura: 2, requiere: ["bote"], tiempo: true },
        { clave: "fotos", titulo: "Fotos y video del acto", inicio: 9, dura: 2, requiere: ["bote"], tiempo: true },
        { clave: "ramo", titulo: "El ramo y las flores", inicio: 2, dura: 1, requiere: [], tiempo: true },
        { clave: "traslado", titulo: "Cómo llegamos ese día", inicio: 2, dura: 1, requiere: [], tiempo: true },
      ],
    },
    {
      clave: "recepcion",
      titulo: "La recepción",
      pasos: [
        { clave: "local", titulo: "El local de la recepción", inicio: 10, dura: 2, requiere: ["bote"], tiempo: true },
        // El local antes que la lista porque el aforo manda sobre la lista, y
        // al revés hay que rehacerla dos veces (§4.4).
        { clave: "invitados", titulo: "La lista de invitados", inicio: 9, dura: 2, requiere: ["local"], tiempo: true },
        { clave: "comida", titulo: "La comida y la bebida", inicio: 8, dura: 2, requiere: ["invitados"], tiempo: true },
        { clave: "torta", titulo: "La torta", inicio: 6, dura: 2, requiere: ["invitados"], tiempo: true },
        { clave: "musica", titulo: "La música", inicio: 6, dura: 2, requiere: ["local"], tiempo: true },
        // La invitación lleva día y hora, y la municipalidad los fija al
        // aprobar el expediente (§4.5, supuesto 1 de §13).
        {
          clave: "invitaciones",
          titulo: "Enviar las invitaciones",
          inicio: 5,
          dura: 2,
          requiere: ["invitados", "expediente"],
          tiempo: true,
        },
      ],
    },
  ],
};

/** Todos los pasos de la plantilla, con la meta a la que pertenece cada uno. */
export const pasosDe = (plantilla: Plantilla) =>
  plantilla.metas.flatMap((m) => m.pasos.map((paso) => ({ paso, metaClave: m.clave })));

/** Falta alguna de las metas de la plantilla, comparando sin mayúsculas ni tildes. */
export function faltanMetasDelPlan(
  metasExistentes: { titulo: string }[],
  plantilla: Plantilla = PLAN_COMPLETO,
) {
  const hay = new Set(metasExistentes.map((m) => normalizar(m.titulo)));
  return plantilla.metas.some((m) => !hay.has(normalizar(m.titulo)));
}

/** Lo mínimo que `planDelPlan` necesita saber de una acción que ya existe. */
export type AccionExistente = {
  id: string;
  titulo: string;
  inicioSemanas: number | null;
  metaId: string | null;
  orden: number;
};

export type PlanDelPlan = {
  /** Por clave de meta: la reutilizada o la que hay que crear, en orden de plantilla. */
  metas: Map<string, { id: string; titulo: string; nueva: boolean }>;
  acciones: {
    crear: { id: string; metaId: string; paso: PasoPlantilla }[];
    /** Qué escribirle a una acción que ya existía y estaba sin meta. */
    adoptar: {
      id: string;
      metaId: string;
      inicioSemanas?: number;
      duracionSemanas?: number;
      esHito?: true;
    }[];
    /** Existen con una meta ya puesta: solo sirven de destino de dependencias. */
    intactas: string[];
  };
  dependencias: Requisito[];
  resumen: { metasNuevas: number; accionesNuevas: number; accionesReutilizadas: number };
};

/**
 * Qué hay que escribir para dejar una boda con la plantilla aplicada, sin
 * tocar la base (docs/plantillas.md §10).
 *
 * Es idempotente por construcción: reutiliza la meta cuyo título coincide sin
 * mayúsculas ni tildes, adopta la acción que existe sin meta y no toca la que
 * ya tiene otra. Nunca renombra, nunca desmarca un día clave y nunca reescala
 * semanas: lo que la pareja decidió manda (§7).
 *
 * `nuevoId` se inyecta para que las pruebas sean deterministas y para que la
 * función se mantenga pura.
 */
export function planDelPlan(
  plantilla: Plantilla,
  metasExistentes: { id: string; titulo: string }[],
  accionesExistentes: AccionExistente[],
  nuevoId: () => string = () => crypto.randomUUID(),
): PlanDelPlan {
  const metaPorTitulo = new Map(metasExistentes.map((m) => [normalizar(m.titulo), m]));
  const metasPlan = new Map<string, { id: string; titulo: string; nueva: boolean }>();
  for (const m of plantilla.metas) {
    const ya = metaPorTitulo.get(normalizar(m.titulo));
    // Conserva el título tal como la pareja lo escribió (§7).
    metasPlan.set(m.clave, ya ? { ...ya, nueva: false } : { id: nuevoId(), titulo: m.titulo, nueva: true });
  }

  // Dos acciones con el mismo título: gana la primera por `orden`, el contador
  // de llegada, y la otra se queda suelta (§9).
  const porTitulo = new Map<string, AccionExistente[]>();
  for (const a of [...accionesExistentes].sort((x, y) => x.orden - y.orden || x.id.localeCompare(y.id))) {
    const clave = normalizar(a.titulo);
    porTitulo.set(clave, [...(porTitulo.get(clave) ?? []), a]);
  }

  const crear: PlanDelPlan["acciones"]["crear"] = [];
  const adoptar: PlanDelPlan["acciones"]["adoptar"] = [];
  const intactas: string[] = [];
  const usadas = new Set<string>();
  /** Clave de paso → id de la acción que la representa, exista o se cree. */
  const idDe = new Map<string, string>();

  for (const { paso, metaClave } of pasosDe(plantilla)) {
    const meta = metasPlan.get(metaClave)!;
    const ya = [paso.titulo, ...(paso.alias ?? [])]
      .flatMap((t) => porTitulo.get(normalizar(t)) ?? [])
      .find((a) => !usadas.has(a.id));

    if (!ya) {
      const id = nuevoId();
      crear.push({ id, metaId: meta.id, paso });
      idDe.set(paso.clave, id);
      continue;
    }

    usadas.add(ya.id);
    idDe.set(paso.clave, ya.id);
    if (ya.metaId !== null) {
      // La meta que la pareja eligió gana, incluso si es la de la plantilla:
      // no hay nada que escribirle. Sí es destino de dependencias (§7).
      intactas.push(ya.id);
      continue;
    }
    adoptar.push({
      id: ya.id,
      metaId: meta.id,
      // Una idea suelta sin semana quedaría fuera del camino; una con semana
      // puesta conserva la suya y su duración.
      ...(ya.inicioSemanas === null ? { inicioSemanas: paso.inicio, duracionSemanas: paso.dura } : {}),
      // Solo se marca, nunca se desmarca.
      ...(paso.hito ? { esHito: true as const } : {}),
    });
  }

  const dependencias = pasosDe(plantilla).flatMap(({ paso }) =>
    paso.requiere
      .map((r) => ({ accionId: idDe.get(paso.clave)!, requiereId: idDe.get(r)! }))
      .filter((d) => d.accionId && d.requiereId),
  );

  return {
    metas: metasPlan,
    acciones: { crear, adoptar, intactas },
    dependencias,
    resumen: {
      metasNuevas: [...metasPlan.values()].filter((m) => m.nueva).length,
      accionesNuevas: crear.length,
      accionesReutilizadas: adoptar.length + intactas.length,
    },
  };
}
