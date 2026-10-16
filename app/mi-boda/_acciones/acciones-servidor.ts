"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import { acciones, bodas, dependencias, metas, pagos } from "@/db/schema";
import {
  duracionDe,
  planPlantilla,
  REGISTRO_CIVIL,
  semanaPorDefecto,
  semanasHastaLaBoda,
} from "@/lib/metas";
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

export async function guardarFechaBoda(fecha: string | null) {
  const { bodaId } = await bodaActiva();
  await getDb()
    .insert(bodas)
    .values({ id: bodaId, fecha })
    .onConflictDoUpdate({
      target: bodas.id,
      set: { fecha, actualizadaEl: new Date() },
    });
  revalidatePath("/mi-boda");
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
 * Quien paga se copia del responsable en este momento. Leerlo en vivo haría
 * que cambiar de dueño reescribiera quién pagó el mes pasado.
 */
export async function registrarPago(datos: {
  accionId: string;
  monto: string;
  fecha: string;
  nota: string | null;
}) {
  const { bodaId } = await bodaActiva();
  const monto = Number(datos.monto);
  if (!Number.isFinite(monto) || monto <= 0) throw new Error("Monto inválido");

  // La acción tiene que ser de esta boda: sin esto, un accionId ajeno colaría
  // un pago en otra boda.
  const [accion] = await getDb()
    .select({ responsableId: acciones.responsableId })
    .from(acciones)
    .where(and(eq(acciones.id, datos.accionId), eq(acciones.bodaId, bodaId)));
  if (!accion) throw new Error("Esa acción no es de esta boda");

  await getDb().insert(pagos).values({
    bodaId,
    accionId: datos.accionId,
    monto: monto.toFixed(2),
    pagadoPorId: accion.responsableId,
    fecha: datos.fecha,
    nota: datos.nota,
  });

  revalidatePath("/mi-boda");
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
 * Plantilla "Registro civil": crea la meta, reutiliza las acciones que ya
 * existen con el mismo título y crea las que faltan, con sus dependencias.
 * Todo en un solo batch: o queda completa o no queda nada.
 */
export async function empezarRegistroCivil(): Promise<{ error?: string }> {
  const { bodaId } = await bodaActiva();
  const db = getDb();

  const [existentes, yaHay] = await Promise.all([
    db
      .select({
        id: acciones.id,
        titulo: acciones.titulo,
        inicioSemanas: acciones.inicioSemanas,
      })
      .from(acciones)
      .where(eq(acciones.bodaId, bodaId)),
    db
      .select({ id: metas.id })
      .from(metas)
      .where(and(eq(metas.bodaId, bodaId), eq(metas.titulo, REGISTRO_CIVIL.titulo))),
  ]);
  if (yaHay.length) return { error: "Ya tienen la meta Registro civil." };

  const { reutilizar, crear } = planPlantilla(REGISTRO_CIVIL.pasos, existentes);
  const metaId = crypto.randomUUID();
  const ids = new Map(reutilizar);
  for (const p of crear) ids.set(p.clave, crypto.randomUUID());

  const [{ siguiente }] = await db
    .select({ siguiente: sql<number>`coalesce(max(${metas.orden}), -1) + 1` })
    .from(metas)
    .where(eq(metas.bodaId, bodaId));

  const filasDependencias = REGISTRO_CIVIL.pasos.flatMap((p) =>
    p.requiere.map((r) => ({ bodaId, accionId: ids.get(p.clave)!, requiereId: ids.get(r)! })),
  );

  try {
    await db.batch([
    db.insert(metas).values({ id: metaId, bodaId, titulo: REGISTRO_CIVIL.titulo, orden: siguiente }),
    ...(crear.length
      ? [
          db.insert(acciones).values(
            crear.map((p, i) => ({
              id: ids.get(p.clave)!,
              bodaId,
              titulo: p.titulo,
              cuestaTiempo: p.tiempo ?? false,
              inicioSemanas: p.inicio,
              duracionSemanas: p.dura,
              esHito: p.hito ?? false,
              metaId,
              orden: 1000 + i, // al final del contador de llegada
            })),
          ),
        ]
      : []),
    ...[...reutilizar].map(([clave, id]) => {
      const paso = REGISTRO_CIVIL.pasos.find((p) => p.clave === clave)!;
      const actual = existentes.find((e) => e.id === id)!;
      // Lo que la pareja ya decidió (las semanas) se respeta; lo que falta se
      // completa con la plantilla, si no quedaría fuera del camino.
      const sinFecha = actual.inicioSemanas === null;
      return db
        .update(acciones)
        .set({
          metaId,
          esHito: paso.hito ?? false,
          ...(sinFecha ? { inicioSemanas: paso.inicio, duracionSemanas: paso.dura } : {}),
          actualizadaEl: new Date(),
        })
        .where(and(eq(acciones.id, id), eq(acciones.bodaId, bodaId)));
    }),
    db.insert(dependencias).values(filasDependencias).onConflictDoNothing(),
    ]);
  } catch (e) {
    // Otra persona la aplicó al mismo tiempo: el índice único lo frenó y el
    // batch no dejó nada a medias.
    if (esDuplicado(e)) return { error: "Ya tienen la meta Registro civil." };
    throw e;
  }

  revalidatePath("/mi-boda");
  return {};
}
