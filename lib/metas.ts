/**
 * Lógica de metas y del camino (docs/metas.md). Todo puro: recibe acciones y
 * dependencias y devuelve órdenes y conjuntos, para probarlo sin base ni React.
 */

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
 * confiar en que cada llamador filtró antes (docs/metas.md §2.2): `inicioDe`,
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

/** Avance, rango en semanas y monto de una meta, derivados de sus acciones. */
export function resumenMeta(acciones: AccionCamino[]) {
  const conSemanas = enCamino(acciones);
  return {
    total: acciones.length,
    hechas: acciones.filter((a) => a.estado === "hecho").length,
    inicio: conSemanas.length ? Math.max(...conSemanas.map(inicioDe)) : null,
    fin: conSemanas.length ? Math.min(...conSemanas.map(finDe)) : null,
    monto: acciones.reduce((s, a) => s + (a.monto ? Number(a.monto) : 0), 0),
  };
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

/**
 * Qué hacer al aplicar una plantilla: reutilizar las acciones que ya existen
 * con el mismo título o con uno de sus alias (sin mayúsculas ni tildes) y crear
 * las que faltan. No renombra nada: el título existente es de la pareja.
 */
export function planPlantilla(pasos: PasoPlantilla[], existentes: { id: string; titulo: string }[]) {
  const porTitulo = new Map(existentes.map((e) => [normalizar(e.titulo), e.id]));
  const reutilizar = new Map<string, string>();
  const crear: PasoPlantilla[] = [];
  for (const p of pasos) {
    const id = [p.titulo, ...(p.alias ?? [])].map((t) => porTitulo.get(normalizar(t))).find(Boolean);
    if (id) reutilizar.set(p.clave, id);
    else crear.push(p);
  }
  return { reutilizar, crear };
}
