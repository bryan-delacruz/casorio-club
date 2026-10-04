/**
 * Lógica de metas y del camino (docs/metas.md). Todo puro: recibe acciones y
 * dependencias y devuelve órdenes y conjuntos, para probarlo sin base ni React.
 */

export type AccionCamino = {
  id: string;
  titulo: string;
  momento: "idea" | "antes" | "el_dia" | "despues";
  estado: "por_hacer" | "haciendo" | "hecho";
  inicioSemanas: number | null;
  duracionSemanas: number;
  monto: string | null;
  metaId: string | null;
  esHito: boolean;
};

export type Requisito = { accionId: string; requiereId: string };

/**
 * Dónde cae una acción cuando nadie lo ha dicho, contado en semanas desde la
 * boda: positivo antes, cero el mismo día, negativo después.
 */
const POR_DEFECTO: Record<string, number> = { antes: 8, el_dia: 0, despues: -2 };

export const inicioDe = (a: Pick<AccionCamino, "inicioSemanas" | "momento">) =>
  a.inicioSemanas ?? POR_DEFECTO[a.momento] ?? 0;

/** Un hito no dura: es un día. */
export const duracionDe = (a: Pick<AccionCamino, "duracionSemanas" | "esHito">) =>
  a.esHito ? 1 : Math.max(1, a.duracionSemanas);

/** El final, también contado hacia atrás: empezar en 12 y durar 4 acaba en 9. */
export const finDe = (a: Pick<AccionCamino, "inicioSemanas" | "momento" | "duracionSemanas" | "esHito">) =>
  inicioDe(a) - duracionDe(a) + 1;

/** id → ids que requiere, solo entre las acciones dadas. */
function requisitosEntre(ids: Set<string>, requisitos: Requisito[]) {
  const de = new Map<string, string[]>();
  for (const r of requisitos) {
    if (!ids.has(r.accionId) || !ids.has(r.requiereId) || r.accionId === r.requiereId) continue;
    de.set(r.accionId, [...(de.get(r.accionId) ?? []), r.requiereId]);
  }
  return de;
}

/** A igualdad de dependencias: la que empieza antes (más semanas), luego por título. */
const porFecha = (a: AccionCamino, b: AccionCamino) =>
  inicioDe(b) - inicioDe(a) || a.titulo.localeCompare(b.titulo, "es");

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
  const enCalendario = acciones.filter((a) => a.momento !== "idea");
  if (enCalendario.length === 0) return new Set();
  const ids = new Set(enCalendario.map((a) => a.id));
  const requiere = requisitosEntre(ids, requisitos);
  const orden = ordenPorDependencia(enCalendario, requisitos);

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
  const ultima = [...enCalendario].sort(
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
  const requiere = new Map<string, string[]>();
  for (const r of requisitos) requiere.set(r.accionId, [...(requiere.get(r.accionId) ?? []), r.requiereId]);

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
  const enCalendario = acciones.filter((a) => a.momento !== "idea");
  return {
    total: acciones.length,
    hechas: acciones.filter((a) => a.estado === "hecho").length,
    inicio: enCalendario.length ? Math.max(...enCalendario.map(inicioDe)) : null,
    fin: enCalendario.length ? Math.min(...enCalendario.map(finDe)) : null,
    monto: acciones.reduce((s, a) => s + (a.monto ? Number(a.monto) : 0), 0),
  };
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
      titulo: "Presentar el expediente en la municipalidad",
      inicio: 7,
      dura: 1,
      requiere: ["partidas", "dni", "domicilio", "medico", "testigos"],
      tiempo: true,
    },
    { clave: "edicto", titulo: "Publicar el edicto matrimonial", inicio: 6, dura: 2, requiere: ["expediente"], tiempo: true },
    { clave: "ceremonia", titulo: "Ceremonia civil", inicio: 0, dura: 1, requiere: ["edicto"], hito: true },
    { clave: "acta", titulo: "Recoger el acta de matrimonio", inicio: -2, dura: 1, requiere: ["ceremonia"], tiempo: true },
  ],
};

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/** El momento que corresponde a unas semanas: antes, el día o después. */
export const momentoDe = (semanas: number): "antes" | "el_dia" | "despues" =>
  semanas > 0 ? "antes" : semanas === 0 ? "el_dia" : "despues";

/**
 * Qué hacer al aplicar una plantilla: reutilizar las acciones que ya existen
 * con el mismo título (sin mayúsculas ni tildes) y crear las que faltan.
 */
export function planPlantilla(pasos: PasoPlantilla[], existentes: { id: string; titulo: string }[]) {
  const porTitulo = new Map(existentes.map((e) => [normalizar(e.titulo), e.id]));
  const reutilizar = new Map<string, string>();
  const crear: PasoPlantilla[] = [];
  for (const p of pasos) {
    const id = porTitulo.get(normalizar(p.titulo));
    if (id) reutilizar.set(p.clave, id);
    else crear.push(p);
  }
  return { reutilizar, crear };
}
