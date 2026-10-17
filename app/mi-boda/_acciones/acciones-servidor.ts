"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
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
import { partes } from "@/lib/pagos";
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
 * Pone o quita el día de la boda (docs/fecha-de-la-boda.md §4.4).
 *
 * Devuelve cuántas acciones quedaron en una semana que ya pasó para que el
 * aviso lo cuente, pero no mueve ninguna: las semanas son relativas y las puso
 * la pareja a mano. Se revalida el layout entero porque la cuenta regresiva
 * vive en la cabecera y se ve en todas las rutas de /mi-boda.
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
  revalidatePath("/mi-boda", "layout");
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
 * Deja las dependencias de una acción exactamente en esta lista.
 *
 * Se guarda el conjunto entero y no una a una porque así se elige todo de
 * golpe y se manda una sola vez. Rechaza el círculo: si alguna de las nuevas
 * ya depende de esta, directa o por una cadena, las dos se quedarían
 * esperándose para siempre.
 */
export async function guardarDependencias(accionId: string, requiere: string[]) {
  const { bodaId } = await bodaActiva();
  const pedidas = [...new Set(requiere)].filter((id) => id !== accionId);

  const suyas = await getDb()
    .select({ id: acciones.id })
    .from(acciones)
    .where(
      and(
        eq(acciones.bodaId, bodaId),
        inArray(acciones.id, [accionId, ...pedidas]),
      ),
    );
  const validas = new Set(suyas.map((a) => a.id));
  if (!validas.has(accionId)) throw new Error("Esa acción no es de esta boda");
  const limpias = pedidas.filter((id) => validas.has(id));

  const todas = await getDb()
    .select()
    .from(dependencias)
    .where(eq(dependencias.bodaId, bodaId));

  // El grafo sin las de esta acción, más las que se piden ahora.
  const porQuien = new Map<string, string[]>();
  for (const d of todas) {
    if (d.accionId === accionId) continue;
    porQuien.set(d.accionId, [...(porQuien.get(d.accionId) ?? []), d.requiereId]);
  }

  // ¿Se llega desde alguna de las nuevas de vuelta a esta acción?
  const vistos = new Set<string>();
  const pila = [...limpias];
  while (pila.length) {
    const actual = pila.pop()!;
    if (actual === accionId) throw new Error("Eso haría un círculo");
    if (vistos.has(actual)) continue;
    vistos.add(actual);
    pila.push(...(porQuien.get(actual) ?? []));
  }

  await getDb()
    .delete(dependencias)
    .where(
      and(eq(dependencias.bodaId, bodaId), eq(dependencias.accionId, accionId)),
    );
  if (limpias.length > 0) {
    await getDb()
      .insert(dependencias)
      .values(limpias.map((requiereId) => ({ bodaId, accionId, requiereId })));
  }

  revalidatePath("/mi-boda");
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

  revalidatePath("/mi-boda");
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

  revalidatePath("/mi-boda");
  return {};
}

export async function borrarPago(id: string) {
  const { bodaId } = await bodaActiva();
  await getDb()
    .delete(pagos)
    .where(and(eq(pagos.id, id), eq(pagos.bodaId, bodaId)));
  revalidatePath("/mi-boda");
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

  revalidatePath("/mi-boda");
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

  revalidatePath("/mi-boda");
}

/**
 * Escribir el total de una acción, y nada más (docs/pagos.md §3.5): la
 * invitación del diálogo de pagos. Aparte de `editarAccion`, que exige el
 * formulario entero. No se compara con lo puesto: si queda por debajo, la
 * acción dirá "más de lo calculado" y es verdad.
 */
export async function ponerTotal(accionId: string, monto: string): Promise<{ error?: string }> {
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

  revalidatePath("/mi-boda");
  return {};
}

/**
 * Escribir la semana de una acción, y nada más (docs/metas.md §7): null la
 * devuelve a las ideas sueltas y conserva meta, dependencias, monto, pagos y
 * responsable. No recalcula `orden` ni toca la duración.
 *
 * Queda para el formulario, que es el único sitio donde la semana se escribe
 * a mano; arrastrar en el Mapa escribe la meta con `moverAccion`.
 */
export async function ponerEnSemana(id: string, inicioSemanas: number | null) {
  const { bodaId } = await bodaActiva();
  const semana =
    inicioSemanas === null ? null : Math.trunc(Math.max(-260, Math.min(260, inicioSemanas)));

  await getDb()
    .update(acciones)
    .set({ inicioSemanas: semana, actualizadaEl: new Date() })
    .where(and(eq(acciones.id, id), eq(acciones.bodaId, bodaId)));

  revalidatePath("/mi-boda");
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
    revalidatePath("/mi-boda");
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

  revalidatePath("/mi-boda");
  return {};
}

export async function cambiarEstado(id: string, estado: Estado) {
  const { bodaId } = await bodaActiva();
  await getDb()
    .update(acciones)
    .set({ estado, actualizadaEl: new Date() })
    .where(and(eq(acciones.id, id), eq(acciones.bodaId, bodaId)));
  revalidatePath("/mi-boda");
}

export async function borrarAccion(id: string) {
  const { bodaId } = await bodaActiva();
  await getDb()
    .delete(acciones)
    .where(and(eq(acciones.id, id), eq(acciones.bodaId, bodaId)));
  revalidatePath("/mi-boda");
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
    revalidatePath("/mi-boda");
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
  revalidatePath("/mi-boda");
  return {};
}

/** Borrar la meta no borra sus acciones: quedan sin meta (on delete set null). */
export async function borrarMeta(id: string) {
  const { bodaId } = await bodaActiva();
  await getDb().delete(metas).where(and(eq(metas.id, id), eq(metas.bodaId, bodaId)));
  revalidatePath("/mi-boda");
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

  revalidatePath("/mi-boda");
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
