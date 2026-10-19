"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import { acciones, bodas, dependencias, metas, pagos } from "@/db/schema";
import {
  cuantasYaPasaron,
  duracionDe,
  planDelPlan,
  PLAN_COMPLETO,
  semanaPorDefecto,
  semanasHastaLaBoda,
} from "@/lib/metas";
import { conNuevas, tieneCiclo } from "@/lib/dependencias";
import { partes, puestosSiExcede } from "@/lib/pagos";
import { listarMiembros } from "./datos";
import { IDEAS, SIN_META, type Destino } from "./tipos";

/**
 * Toda consulta y escritura se ata a la boda activa que Clerk reporta en la
 * sesión. El bodaId NUNCA viene del cliente: si viniera, cualquiera podría
 * pedir o modificar las acciones de otra boda cambiando un campo del formulario.
 */
async function bodaActiva() {
  const { orgId, userId } = await auth();
  if (!userId) throw new Error("Sin sesión");
  if (!orgId) throw new Error("Sin boda activa");
  return { bodaId: orgId, userId };
}

export type Estado = "por_hacer" | "haciendo" | "hecho";

/**
 * Refresca las dos pantallas y la cabecera.
 *
 * El tipo `layout` y no la ruta sola: `revalidatePath("/mi-boda")` invalida
 * **solo** esa página, así que una escritura hecha desde `/mi-boda/camino`
 * dejaba el Camino con datos viejos hasta recargar a mano. Se veía al editar
 * el orden desde ahí (docs/dependencias.md §9.1). Las dos pantallas leen la
 * misma tabla, así que toda escritura las afecta a las dos, y la cuenta
 * regresiva vive en el layout.
 */
function revalidarBoda() {
  revalidatePath("/mi-boda", "layout");
}

/**
 * Pone o quita el día de la boda (docs/fecha-de-la-boda.md §4.4).
 *
 * Devuelve cuántas acciones quedaron en una semana que ya pasó para que el
 * aviso lo cuente, pero no mueve ninguna: las semanas son relativas y las puso
 * la pareja a mano.
 */
export async function guardarFechaBoda(
  fecha: string | null,
): Promise<{ error?: string; yaPasaron?: number }> {
  const { bodaId } = await bodaActiva();
  const limpia = fecha?.trim() || null;
  if (limpia !== null && !esFechaValida(limpia)) {
    return { error: "Esa fecha no se entiende." };
  }

  await getDb()
    .insert(bodas)
    .values({ id: bodaId, fecha: limpia })
    .onConflictDoUpdate({
      target: bodas.id,
      set: { fecha: limpia, actualizadaEl: new Date() },
    });

  const suyas = await getDb().select().from(acciones).where(eq(acciones.bodaId, bodaId));
  revalidarBoda();
  return { yaPasaron: cuantasYaPasaron(suyas, semanasHastaLaBoda(limpia)) };
}

/** El input type="date" ya filtra, pero la acción es un POST abierto. */
function esFechaValida(fecha: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [a, m, d] = fecha.split("-").map(Number);
  const dia = new Date(a, m - 1, d);
  return dia.getFullYear() === a && dia.getMonth() === m - 1 && dia.getDate() === d;
}

/**
 * Deja el orden de una acción exactamente en lo elegido, en los dos sentidos
 * (docs/dependencias.md §8).
 *
 * - `antes`: lo que esta acción requiere.
 * - `despues`: lo que requiere a esta acción.
 *
 * Una sola escritura y no dos encadenadas: el diálogo elige las dos listas de
 * golpe, y partirlo dejaría media edición guardada cuando la otra mitad
 * cierra un círculo.
 *
 * Rechaza el círculo sobre el grafo **resultante completo**, no solo sobre lo
 * que pasa por esta acción: marcar en las dos listas a la vez puede cerrarlo
 * por un camino que sale de aquí y vuelve por otras acciones (§6).
 */
export async function guardarDependenciasDe(
  accionId: string,
  antes: string[],
  despues: string[],
): Promise<{ error?: string }> {
  const { bodaId } = await bodaActiva();
  const pedidas = [...new Set([...antes, ...despues])].filter((id) => id !== accionId);

  // Solo acciones de esta boda, la propia incluida: un id de otra boda se
  // descarta en silencio, y uno inventado no escribe nada.
  const suyas = await getDb()
    .select({ id: acciones.id })
    .from(acciones)
    .where(and(eq(acciones.bodaId, bodaId), inArray(acciones.id, [accionId, ...pedidas])));
  const validas = new Set(suyas.map((a) => a.id));
  if (!validas.has(accionId)) return { error: "Esa cosa no es de esta boda." };

  const limpias = (lista: string[]) =>
    [...new Set(lista)].filter((id) => id !== accionId && validas.has(id));
  const nuevoAntes = limpias(antes);
  const nuevoDespues = limpias(despues);

  const todas = await getDb()
    .select({ accionId: dependencias.accionId, requiereId: dependencias.requiereId })
    .from(dependencias)
    .where(eq(dependencias.bodaId, bodaId));

  if (tieneCiclo(conNuevas(accionId, nuevoAntes, nuevoDespues, todas))) {
    return { error: "Ese orden se muerde la cola. Revisa lo que marcaste." };
  }

  const db = getDb();
  const borrar = db
    .delete(dependencias)
    .where(
      and(
        eq(dependencias.bodaId, bodaId),
        or(eq(dependencias.accionId, accionId), eq(dependencias.requiereId, accionId)),
      ),
    );
  const filas = [
    ...nuevoAntes.map((requiereId) => ({ bodaId, accionId, requiereId })),
    ...nuevoDespues.map((otra) => ({ bodaId, accionId: otra, requiereId: accionId })),
  ];
  // En un batch, que Neon corre como una transacción: borrar y volver a
  // escribir en dos viajes dejaba la acción SIN NINGUNA dependencia, en los
  // dos sentidos, si la inserción fallaba —por ejemplo porque la otra persona
  // de la boda acababa de borrar una de las acciones elegidas—.
  await (filas.length > 0
    ? db.batch([borrar, db.insert(dependencias).values(filas)])
    : borrar);

  revalidarBoda();
  return {};
}

/**
 * Las dos acciones son de esta boda. Devuelve el mensaje de error, o null.
 *
 * Se comprueban las dos en una consulta: una id de otra boda llegando por el
 * POST abierto no debe poder tocar nada, y tampoco debe poder averiguar si
 * existe (el mensaje es el mismo en los dos casos).
 */
async function sonDeLaBoda(bodaId: string, ids: string[]) {
  const suyas = await getDb()
    .select({ id: acciones.id })
    .from(acciones)
    .where(and(eq(acciones.bodaId, bodaId), inArray(acciones.id, ids)));
  return suyas.length === new Set(ids).size ? null : "Esa cosa no es de esta boda.";
}

/**
 * Une dos bloques del Camino: `accionId` pasa a requerir a `requiereId`
 * (docs/dependencias.md §10.1).
 *
 * Una sola arista, y no el conjunto entero como `guardarDependenciasDe`:
 * arrastrar de un bloque a otro dice una cosa, y mandar las dos listas
 * completas borraría lo que el diálogo no estaba mirando.
 *
 * `onConflictDoNothing`: la clave primaria es el par, así que soltar dos veces
 * sobre el mismo bloque no es un error que contarle a nadie.
 */
export async function agregarDependencia(
  accionId: string,
  requiereId: string,
): Promise<{ error?: string }> {
  const { bodaId } = await bodaActiva();
  if (accionId === requiereId) return { error: "Nada puede esperarse a sí mismo." };
  const ajena = await sonDeLaBoda(bodaId, [accionId, requiereId]);
  if (ajena) return { error: ajena };

  const todas = await getDb()
    .select({ accionId: dependencias.accionId, requiereId: dependencias.requiereId })
    .from(dependencias)
    .where(eq(dependencias.bodaId, bodaId));

  if (tieneCiclo([...todas, { accionId, requiereId }])) {
    return { error: "Ese orden se muerde la cola: esa ya te espera a ti." };
  }

  await getDb()
    .insert(dependencias)
    .values({ bodaId, accionId, requiereId })
    .onConflictDoNothing();

  revalidarBoda();
  return {};
}

/**
 * Deshace esa unión. Es el camino de vuelta del arrastre: crear tirando una
 * flecha y tener que abrir un diálogo para quitarla sería cojo.
 */
export async function quitarDependencia(
  accionId: string,
  requiereId: string,
): Promise<{ error?: string }> {
  const { bodaId } = await bodaActiva();
  await getDb()
    .delete(dependencias)
    .where(
      and(
        eq(dependencias.bodaId, bodaId),
        eq(dependencias.accionId, accionId),
        eq(dependencias.requiereId, requiereId),
      ),
    );
  revalidarBoda();
  return {};
}

/**
 * Anota que salió plata por una acción.
 *
 * `pagadoPorId` lo elige la pareja (docs/pagos.md §3.1): responsable y
 * pagador son dos cosas distintas, y una acción la gestiona uno y la paga
 * otro. Cuando no llega nada se copia el responsable, que es el valor por
 * defecto de siempre y una comodidad, no una regla. Null = "Por repartir".
 *
 * Quien paga queda grabado en este momento. Leerlo en vivo haría que cambiar
 * de dueño reescribiera quién pagó el mes pasado.
 */
export async function registrarPago(datos: {
  accionId: string;
  monto: string;
  fecha: string;
  nota: string | null;
  pagadoPorId?: string | null;
}): Promise<{ error?: string }> {
  const { bodaId } = await bodaActiva();
  const monto = Number(datos.monto);
  if (!Number.isFinite(monto) || monto <= 0) return { error: "Ese monto no se entiende." };

  // La acción tiene que ser de esta boda: sin esto, un accionId ajeno colaría
  // un pago en otra boda.
  const [accion] = await getDb()
    .select({ responsableId: acciones.responsableId })
    .from(acciones)
    .where(and(eq(acciones.id, datos.accionId), eq(acciones.bodaId, bodaId)));
  if (!accion) return { error: "Esa acción ya no está." };

  const pagadoPorId =
    datos.pagadoPorId === undefined ? accion.responsableId : datos.pagadoPorId;
  if (pagadoPorId && !(await esDeLaBoda(pagadoPorId))) {
    return { error: "Esa persona no es de esta boda." };
  }

  await getDb().insert(pagos).values({
    bodaId,
    accionId: datos.accionId,
    monto: monto.toFixed(2),
    pagadoPorId,
    fecha: datos.fecha,
    nota: datos.nota,
  });

  revalidarBoda();
  return {};
}

/**
 * Comprueba que un userId sea miembro de esta boda antes de escribirlo.
 *
 * No es una fuga entre bodas —el `boda_id` lo pone el servidor—, pero sin
 * esto un POST a esta acción podría dejar en la fila un userId cualquiera, y
 * el Reparto lo mostraría como "Por repartir" sin que nadie entienda por
 * qué. La lista viene de Clerk y está en `cache` (docs/pagos.md §10.1).
 */
async function esDeLaBoda(userId: string) {
  const miembros = await listarMiembros();
  return miembros.some((m) => m.id === userId);
}

/**
 * El atajo "Repartir": una fila por persona elegida, en un solo viaje y una
 * sola revalidación (docs/pagos.md §3.2).
 *
 * El reparto de los céntimos corre aquí y no en el cliente para que la misma
 * operación dé siempre el mismo resultado: el sobrante va de uno en uno a
 * los primeros, en el orden de miembros que ya usa el Reparto. La nota va
 * igual en todas las filas; las distingue el nombre de quien pagó.
 */
export async function registrarPagoRepartido(
  accionId: string,
  pagadorIds: string[],
  monto: string,
  fecha: string,
  nota: string | null,
): Promise<{ error?: string }> {
  const { bodaId } = await bodaActiva();
  const total = Number(monto);
  if (!Number.isFinite(total) || total <= 0) return { error: "Ese monto no se entiende." };

  const [accion] = await getDb()
    .select({ id: acciones.id })
    .from(acciones)
    .where(and(eq(acciones.id, accionId), eq(acciones.bodaId, bodaId)));
  if (!accion) return { error: "Esa acción ya no está." };

  // El orden lo decide el servidor, no el cliente: así los céntimos de más
  // caen siempre en la misma persona.
  const miembros = await listarMiembros();
  const pedidos = new Set(pagadorIds);
  const elegidos = miembros.filter((m) => pedidos.has(m.id)).map((m) => m.id);
  if (elegidos.length !== pedidos.size) return { error: "Esa persona no es de esta boda." };
  if (elegidos.length < 2) return { error: "Elige al menos dos personas para repartir." };

  const trozos = partes(total.toFixed(2), elegidos.length);
  await getDb()
    .insert(pagos)
    .values(
      elegidos.map((pagadoPorId, i) => ({
        bodaId,
        accionId,
        monto: trozos[i],
        pagadoPorId,
        fecha,
        nota,
      })),
    );

  revalidarBoda();
  return {};
}

export async function borrarPago(id: string) {
  const { bodaId } = await bodaActiva();
  await getDb()
    .delete(pagos)
    .where(and(eq(pagos.id, id), eq(pagos.bodaId, bodaId)));
  revalidarBoda();
}

export async function crearAccion(datos: {
  titulo: string;
  cuestaTiempo: boolean;
  monto: string | null;
  responsableId: string | null;
  notas: string | null;
  inicioSemanas: number | null;
  duracionSemanas: number;
  metaId: string | null;
  esHito: boolean;
}) {
  const { bodaId } = await bodaActiva();
  const titulo = datos.titulo.trim();
  if (!titulo) throw new Error("Falta el título");
  await exigirMetaDeLaBoda(bodaId, datos.metaId);

  // `orden` ya no es la posición en un carril: es el contador de llegada que
  // desempata a las que caen en la misma semana (docs/metas.md §3).
  const [{ siguiente }] = await getDb()
    .select({ siguiente: sql<number>`coalesce(max(${acciones.orden}), -1) + 1` })
    .from(acciones)
    .where(eq(acciones.bodaId, bodaId));

  await getDb().insert(acciones).values({
    bodaId,
    titulo,
    cuestaTiempo: datos.cuestaTiempo,
    monto: datos.monto,
    responsableId: datos.responsableId,
    notas: datos.notas,
    inicioSemanas: datos.inicioSemanas,
    duracionSemanas: datos.duracionSemanas,
    metaId: datos.metaId,
    esHito: datos.esHito,
    orden: siguiente,
  });

  revalidarBoda();
}

/**
 * Editar sí escribe las semanas (es donde la pareja corrige el número), pero
 * no toca `orden`: el contador de llegada no cambia porque algo se mueva.
 */
export async function editarAccion(
  id: string,
  datos: {
    titulo: string;
    cuestaTiempo: boolean;
    monto: string | null;
    responsableId: string | null;
    notas: string | null;
    inicioSemanas: number | null;
    duracionSemanas: number;
    metaId: string | null;
    esHito: boolean;
  },
) {
  const { bodaId } = await bodaActiva();
  const titulo = datos.titulo.trim();
  if (!titulo) throw new Error("Falta el título");
  await exigirMetaDeLaBoda(bodaId, datos.metaId);

  await getDb()
    .update(acciones)
    .set({
      titulo,
      cuestaTiempo: datos.cuestaTiempo,
      monto: datos.monto,
      responsableId: datos.responsableId,
      notas: datos.notas,
      inicioSemanas: datos.inicioSemanas,
      duracionSemanas: datos.duracionSemanas,
      metaId: datos.metaId,
      esHito: datos.esHito,
      actualizadaEl: new Date(),
    })
    .where(and(eq(acciones.id, id), eq(acciones.bodaId, bodaId)));

  revalidarBoda();
}

/**
 * Escribir el total de una acción, y nada más (docs/pagos.md §3.5): la
 * invitación del diálogo de pagos. Aparte de `editarAccion`, que exige el
 * formulario entero. No se compara con lo puesto: si queda por debajo, la
 * acción dirá "S/ N puestos de S/ M" con lo puesto por encima del estimado, y
 * es verdad. Guarda siempre; solo devuelve `puestos` para que el cliente avise
 * (§3.5.1), con la suma hecha aquí y filtrada por `boda_id`.
 */
export async function ponerTotal(
  accionId: string,
  monto: string,
): Promise<{ error?: string; puestos?: string }> {
  const { bodaId } = await bodaActiva();
  const valor = Number(monto);
  if (!monto.trim() || !Number.isFinite(valor) || valor <= 0) {
    return { error: "Ese monto no se entiende." };
  }

  const guardada = await getDb()
    .update(acciones)
    .set({ monto: valor.toFixed(2), actualizadaEl: new Date() })
    .where(and(eq(acciones.id, accionId), eq(acciones.bodaId, bodaId)))
    .returning({ id: acciones.id });
  if (guardada.length === 0) return { error: "Esa acción ya no está." };

  const pagosDeLaAccion = await getDb()
    .select({ monto: pagos.monto })
    .from(pagos)
    .where(and(eq(pagos.accionId, accionId), eq(pagos.bodaId, bodaId)));
  const puestos = puestosSiExcede(valor.toFixed(2), pagosDeLaAccion);

  revalidarBoda();
  return puestos ? { puestos } : {};
}

/**
 * Escribir la semana de una acción, y nada más (docs/metas.md §7): null la
 * devuelve a las ideas sueltas y conserva meta, dependencias, monto, pagos y
 * responsable. No recalcula `orden` ni toca la duración.
 *
 * La escriben el formulario, donde se teclea el número, y el Camino, donde se
 * arrastra el bloque por la línea del tiempo (docs/dependencias.md §10).
 * Arrastrar en el Mapa escribe la meta con `moverAccion`, nunca la semana.
 *
 * El tope de ±260 semanas son cinco años a cada lado: más allá el Gantt
 * tendría cientos de columnas vacías y el arrastre dejaría de poder apuntar.
 */
export async function ponerEnSemana(
  id: string,
  inicioSemanas: number | null,
): Promise<{ error?: string }> {
  const { bodaId } = await bodaActiva();
  const semana =
    inicioSemanas === null ? null : Math.trunc(Math.max(-260, Math.min(260, inicioSemanas)));

  const guardada = await getDb()
    .update(acciones)
    .set({ inicioSemanas: semana, actualizadaEl: new Date() })
    .where(and(eq(acciones.id, id), eq(acciones.bodaId, bodaId)))
    .returning({ id: acciones.id });
  if (guardada.length === 0) return { error: "Esa cosa ya no está." };

  revalidarBoda();
  return {};
}

/**
 * Mover una tarjeta en el Mapa: escribe la meta (docs/metas.md §7).
 *
 * Una sola acción con la rama dentro y no dos encadenadas: un arrastre es un
 * viaje y una revalidación. Dos haría dos `revalidatePath` seguidos y la
 * tarjeta saltaría dos veces.
 *
 * - a un carril de meta → `meta_id` = esa meta;
 * - al carril "Sin meta" → `meta_id = null`;
 * - a "Ideas sueltas" → `inicio_semanas = null`, conservando meta,
 *   dependencias, monto, pagos y responsable;
 * - saliendo de "Ideas sueltas" → además se escribe la semana por defecto.
 *   Es el único arrastre que toca la semana.
 */
export async function moverAccion(id: string, destino: Destino): Promise<{ error?: string }> {
  const { bodaId } = await bodaActiva();
  const db = getDb();

  const [accion] = await db
    .select({
      inicioSemanas: acciones.inicioSemanas,
      duracionSemanas: acciones.duracionSemanas,
      esHito: acciones.esHito,
    })
    .from(acciones)
    .where(and(eq(acciones.id, id), eq(acciones.bodaId, bodaId)));
  if (!accion) return { error: "Esa acción ya no está." };

  if (destino === IDEAS) {
    await db
      .update(acciones)
      .set({ inicioSemanas: null, actualizadaEl: new Date() })
      .where(and(eq(acciones.id, id), eq(acciones.bodaId, bodaId)));
    revalidarBoda();
    return {};
  }

  const metaId = destino === SIN_META ? null : destino;
  if (metaId) {
    const [meta] = await db
      .select({ id: metas.id })
      .from(metas)
      .where(and(eq(metas.id, metaId), eq(metas.bodaId, bodaId)));
    if (!meta) return { error: "Esa meta no es de esta boda." };
  }

  // Mover entre carriles nunca cambia la semana; solo la escribe lo que sale
  // de las ideas sueltas, que hasta ahora no tenía ninguna.
  let semana = accion.inicioSemanas;
  if (semana === null) {
    const [boda] = await db.select({ fecha: bodas.fecha }).from(bodas).where(eq(bodas.id, bodaId));
    semana = semanaPorDefecto({
      hitoSemana: null,
      semanasHastaLaBoda: semanasHastaLaBoda(boda?.fecha ?? null),
      duracion: duracionDe(accion),
    });
  }

  await db
    .update(acciones)
    .set({ metaId, inicioSemanas: semana, actualizadaEl: new Date() })
    .where(and(eq(acciones.id, id), eq(acciones.bodaId, bodaId)));

  revalidarBoda();
  return {};
}

export async function cambiarEstado(id: string, estado: Estado) {
  const { bodaId } = await bodaActiva();
  await getDb()
    .update(acciones)
    .set({ estado, actualizadaEl: new Date() })
    .where(and(eq(acciones.id, id), eq(acciones.bodaId, bodaId)));
  revalidarBoda();
}

export async function borrarAccion(id: string) {
  const { bodaId } = await bodaActiva();
  await getDb()
    .delete(acciones)
    .where(and(eq(acciones.id, id), eq(acciones.bodaId, bodaId)));
  revalidarBoda();
}

// ---------------------------------------------------------------------------
// Metas (docs/metas.md)
// ---------------------------------------------------------------------------

/** Una meta ajena colaría la acción en otra boda: se rechaza. */
async function exigirMetaDeLaBoda(bodaId: string, metaId: string | null) {
  if (!metaId) return;
  const [meta] = await getDb()
    .select({ id: metas.id })
    .from(metas)
    .where(and(eq(metas.id, metaId), eq(metas.bodaId, bodaId)));
  if (!meta) throw new Error("Esa meta no es de esta boda");
}

const MAX_TITULO_META = 60;

/** Violación del índice único (boda_id, titulo) de metas. */
function esDuplicado(e: unknown) {
  const texto = String((e as { cause?: unknown })?.cause ?? e);
  return /23505|duplicate key|metas_boda_titulo_idx/.test(texto + String((e as { code?: string })?.code ?? ""));
}

/**
 * Devuelve { error } en vez de lanzar: en producción Next oculta el mensaje
 * de los errores que una server action lanza, y estos son para el usuario.
 */
export async function crearMeta(titulo: string): Promise<{ id?: string; error?: string }> {
  const { bodaId } = await bodaActiva();
  const limpio = titulo.trim().slice(0, MAX_TITULO_META);
  if (!limpio) return { error: "Ponle un nombre a la meta." };

  const [{ siguiente }] = await getDb()
    .select({ siguiente: sql<number>`coalesce(max(${metas.orden}), -1) + 1` })
    .from(metas)
    .where(eq(metas.bodaId, bodaId));
  try {
    const [meta] = await getDb()
      .insert(metas)
      .values({ bodaId, titulo: limpio, orden: siguiente })
      .returning({ id: metas.id });
    revalidarBoda();
    return { id: meta.id };
  } catch (e) {
    if (esDuplicado(e)) return { error: `Ya tienen una meta llamada "${limpio}".` };
    throw e;
  }
}

export async function renombrarMeta(id: string, titulo: string): Promise<{ error?: string }> {
  const { bodaId } = await bodaActiva();
  const limpio = titulo.trim().slice(0, MAX_TITULO_META);
  if (!limpio) return { error: "Ponle un nombre a la meta." };
  try {
    await getDb()
      .update(metas)
      .set({ titulo: limpio })
      .where(and(eq(metas.id, id), eq(metas.bodaId, bodaId)));
  } catch (e) {
    if (esDuplicado(e)) return { error: `Ya tienen una meta llamada "${limpio}".` };
    throw e;
  }
  revalidarBoda();
  return {};
}

/** Borrar la meta no borra sus acciones: quedan sin meta (on delete set null). */
export async function borrarMeta(id: string) {
  const { bodaId } = await bodaActiva();
  await getDb().delete(metas).where(and(eq(metas.id, id), eq(metas.bodaId, bodaId)));
  revalidarBoda();
}

/**
 * La plantilla del plan: cuatro metas con sus acciones y sus dependencias
 * (docs/plantillas.md).
 *
 * Es idempotente: reutiliza la meta que ya existe con ese título, adopta la
 * acción que está sin meta y no toca la que ya tiene otra. Todo en un solo
 * batch —una sentencia por tabla más las adopciones— para que o quede completo
 * o no quede nada. Devuelve el recuento porque el toast dice el número real, no
 * un texto fijo (§7).
 */
export async function empezarPlan(): Promise<{
  error?: string;
  resumen?: { metasNuevas: number; accionesNuevas: number; accionesReutilizadas: number };
  yaPasaron?: number;
}> {
  const { bodaId } = await bodaActiva();
  const db = getDb();

  const [metasSuyas, existentes, [boda], [{ ordenMeta, ordenAccion }]] = await Promise.all([
    db.select({ id: metas.id, titulo: metas.titulo }).from(metas).where(eq(metas.bodaId, bodaId)),
    db
      .select({
        id: acciones.id,
        titulo: acciones.titulo,
        inicioSemanas: acciones.inicioSemanas,
        metaId: acciones.metaId,
        orden: acciones.orden,
        estado: acciones.estado,
      })
      .from(acciones)
      .where(eq(acciones.bodaId, bodaId)),
    db.select({ fecha: bodas.fecha }).from(bodas).where(eq(bodas.id, bodaId)),
    db
      .select({
        ordenMeta: sql<number>`coalesce(max(${metas.orden}), -1) + 1`,
        // Se lee el contador de llegada en vez del viejo 1000 + i: con 24 filas
        // ese truco choca consigo mismo al aplicar la plantilla dos veces.
        ordenAccion: sql<number>`(select coalesce(max(${acciones.orden}), -1) + 1 from ${acciones} where ${acciones.bodaId} = ${bodaId})`,
      })
      .from(metas)
      .where(eq(metas.bodaId, bodaId)),
  ]);

  const plan = planDelPlan(PLAN_COMPLETO, metasSuyas, existentes);
  const metasNuevas = [...plan.metas.values()].filter((m) => m.nueva);

  // El batch se arma antes de lanzarlo: al reaplicar la plantilla pueden faltar
  // las metas y las acciones, y el tipo de `db.batch` exige al menos una
  // sentencia. El orden importa: las dependencias apuntan a las acciones.
  const sentencias: Parameters<typeof db.batch>[0][number][] = [
      ...(metasNuevas.length
        ? [
            db.insert(metas).values(
              metasNuevas.map((m, i) => ({
                id: m.id,
                bodaId,
                titulo: m.titulo,
                // Solo desempata: el orden de los carriles se deriva (§2).
                orden: Number(ordenMeta) + i,
              })),
            ),
          ]
        : []),
      ...(plan.acciones.crear.length
        ? [
            db.insert(acciones).values(
              plan.acciones.crear.map(({ id, metaId, paso }, i) => ({
                id,
                bodaId,
                titulo: paso.titulo,
                cuestaTiempo: paso.tiempo ?? false,
                // Ningún paso trae monto: monto = 0 daría "pagado del todo"
                // sin un solo pago (docs/plantillas.md §3).
                inicioSemanas: paso.inicio,
                duracionSemanas: paso.dura,
                esHito: paso.hito ?? false,
                metaId,
                orden: Number(ordenAccion) + i,
              })),
            ),
          ]
        : []),
      ...plan.acciones.adoptar.map(({ id, ...campos }) =>
        db
          .update(acciones)
          .set({ ...campos, actualizadaEl: new Date() })
          .where(and(eq(acciones.id, id), eq(acciones.bodaId, bodaId))),
      ),
      db
        .insert(dependencias)
        .values(plan.dependencias.map((d) => ({ bodaId, ...d })))
        .onConflictDoNothing(),
  ];

  try {
    // La última sentencia siempre está: las dependencias se escriben completas.
    await db.batch([sentencias[0], ...sentencias.slice(1)]);
  } catch (e) {
    // Otra persona la aplicó al mismo tiempo: el índice único de metas lo frenó
    // y el batch no dejó nada a medias. Reintentar es seguro.
    if (esDuplicado(e)) return { error: "Alguien acaba de crear el plan. Vuelve a intentarlo." };
    throw e;
  }

  // Las semanas no se reescalan (§7): si la boda es en cinco semanas, la pareja
  // tiene que saber cuántas cosas cayeron en semanas que ya pasaron.
  const semanas = semanasHastaLaBoda(boda?.fecha ?? null);
  const adoptada = new Map(plan.acciones.adoptar.map((a) => [a.id, a]));
  const resultado = [
    ...existentes.map((a) => ({
      ...a,
      inicioSemanas: adoptada.get(a.id)?.inicioSemanas ?? a.inicioSemanas,
    })),
    ...plan.acciones.crear.map(({ paso }) => ({
      estado: "por_hacer" as const,
      inicioSemanas: paso.inicio,
    })),
  ];

  revalidarBoda();
  return {
    resumen: plan.resumen,
    yaPasaron: cuantasYaPasaron(
      resultado.map((a) => ({
        id: "",
        titulo: "",
        estado: a.estado,
        inicioSemanas: a.inicioSemanas,
        duracionSemanas: 1,
        monto: null,
        metaId: null,
        esHito: false,
      })),
      semanas,
    ),
  };
}
