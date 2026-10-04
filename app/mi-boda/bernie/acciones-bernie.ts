"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import { acciones, conexionesBernie, gastosBernie, pagos } from "@/db/schema";
import { desconectarBernie, sincronizarBernie, type ResultadoSync } from "@/lib/bernie/sincronizar";
import { DEMO } from "@/lib/demo";

/**
 * Igual que en acciones-servidor: la boda sale de la sesión de Clerk, nunca
 * del cliente. La demo no tiene integración (docs §9).
 */
async function bodaActiva() {
  const { orgId, userId } = await auth();
  if (!userId) throw new Error("Sin sesión");
  if (!orgId) throw new Error("Sin boda activa");
  if (orgId === DEMO.orgId) throw new Error("No disponible en la demo");
  return { bodaId: orgId, userId };
}

function refrescar() {
  revalidatePath("/mi-boda/bernie");
  revalidatePath("/mi-boda");
}

const UNA_HORA_MS = 60 * 60 * 1000;

/** Datos de la bandeja y de la conexión, para la página. */
export async function listarBandeja() {
  const { orgId } = await auth();
  if (!orgId || orgId === DEMO.orgId) return null;
  const db = getDb();
  const [[conexion], gastos, accionesBoda] = await Promise.all([
    db
      .select({
        estado: conexionesBernie.estado,
        conectadaPorId: conexionesBernie.conectadaPorId,
        ultimaSyncEl: conexionesBernie.ultimaSyncEl,
        ultimoError: conexionesBernie.ultimoError,
        creadaEl: conexionesBernie.creadaEl,
      })
      .from(conexionesBernie)
      .where(eq(conexionesBernie.bodaId, orgId)),
    db
      .select()
      .from(gastosBernie)
      .where(eq(gastosBernie.bodaId, orgId))
      .orderBy(desc(gastosBernie.fecha), asc(gastosBernie.comercio)),
    db
      .select({ id: acciones.id, titulo: acciones.titulo, moneda: acciones.moneda })
      .from(acciones)
      .where(eq(acciones.bodaId, orgId))
      .orderBy(asc(acciones.titulo)),
  ]);

  return {
    conexion: conexion ?? null,
    porAsignar: gastos.filter((g) => !g.pagoId && !g.descartado),
    fueraDeBernie: gastos.filter((g) => g.pagoId && g.fueraDeBernie),
    descartados: gastos.filter((g) => !g.pagoId && g.descartado),
    acciones: accionesBoda,
    desactualizada:
      !!conexion && (!conexion.ultimaSyncEl || Date.now() - conexion.ultimaSyncEl.getTime() > UNA_HORA_MS),
  };
}

export async function sincronizarAhora(): Promise<ResultadoSync> {
  const { bodaId } = await bodaActiva();
  const resultado = await sincronizarBernie(bodaId);
  refrescar();
  return resultado;
}

export async function desconectar() {
  const { bodaId } = await bodaActiva();
  const r = await desconectarBernie(bodaId);
  refrescar();
  return r;
}

/**
 * Asignar un gasto a una acción crea su pago. Una sola sentencia: marca el
 * gasto como asignado solo si nadie lo asignó antes, y con esa misma fila
 * inserta el pago. Dos personas a la vez no pueden crear dos pagos.
 * (La FK de pago_id se comprueba al final de la sentencia, con el pago ya creado.)
 */
async function asignar(bodaId: string, gastoId: string, accionId: string) {
  const db = getDb();
  const [accion] = await db
    .select({ moneda: acciones.moneda })
    .from(acciones)
    .where(and(eq(acciones.id, accionId), eq(acciones.bodaId, bodaId)));
  if (!accion) throw new Error("Esa acción no es de esta boda");

  const [gasto] = await db
    .select({ moneda: gastosBernie.moneda })
    .from(gastosBernie)
    .where(and(eq(gastosBernie.id, gastoId), eq(gastosBernie.bodaId, bodaId)));
  if (!gasto) throw new Error("Ese gasto no es de esta boda");
  if (gasto.moneda !== accion.moneda) {
    throw new Error(`El gasto está en ${gasto.moneda} y la acción en ${accion.moneda}`);
  }

  const [conexion] = await db
    .select({ conectadaPorId: conexionesBernie.conectadaPorId })
    .from(conexionesBernie)
    .where(eq(conexionesBernie.bodaId, bodaId));

  const pagoId = crypto.randomUUID();
  const resultado = await db.execute(sql`
    with g as (
      update ${gastosBernie}
      set pago_id = ${pagoId}::uuid, actualizado_el = now()
      where id = ${gastoId}::uuid and boda_id = ${bodaId}::text and pago_id is null and not descartado
      returning monto, fecha, comercio
    )
    insert into ${pagos} (id, boda_id, accion_id, monto, pagado_por_id, fecha, nota)
    select ${pagoId}::uuid, ${bodaId}::text, ${accionId}::uuid, g.monto, ${conexion?.conectadaPorId ?? null}::text,
           g.fecha, g.comercio
    from g
    returning id
  `);
  if (resultado.rows.length === 0) throw new Error("Ese gasto ya fue asignado");
}

export async function asignarGasto(gastoId: string, accionId: string) {
  const { bodaId } = await bodaActiva();
  await asignar(bodaId, gastoId, accionId);
  refrescar();
}

/** Crea una acción con el nombre de la subcategoría (o del comercio) y le asigna el gasto. */
export async function crearAccionConGasto(gastoId: string) {
  const { bodaId } = await bodaActiva();
  const db = getDb();
  const [gasto] = await db
    .select()
    .from(gastosBernie)
    .where(and(eq(gastosBernie.id, gastoId), eq(gastosBernie.bodaId, bodaId), isNull(gastosBernie.pagoId)));
  if (!gasto) throw new Error("Ese gasto ya no está por asignar");

  const [{ siguiente }] = await db
    .select({ siguiente: sql<number>`coalesce(max(${acciones.orden}), -1) + 1` })
    .from(acciones)
    .where(and(eq(acciones.bodaId, bodaId), eq(acciones.momento, "antes")));

  const [accion] = await db
    .insert(acciones)
    .values({
      bodaId,
      titulo: (gasto.subcategoria || gasto.comercio).slice(0, 120),
      momento: "antes",
      estado: "haciendo",
      moneda: gasto.moneda,
      orden: siguiente,
    })
    .returning({ id: acciones.id });

  await asignar(bodaId, gastoId, accion.id);
  refrescar();
}

export async function descartarGasto(gastoId: string, descartado: boolean) {
  const { bodaId } = await bodaActiva();
  await getDb()
    .update(gastosBernie)
    .set({ descartado, actualizadoEl: new Date() })
    .where(and(eq(gastosBernie.id, gastoId), eq(gastosBernie.bodaId, bodaId), isNull(gastosBernie.pagoId)));
  refrescar();
}

/**
 * Un gasto asignado que ya no está en Bernie: quedarse con el pago (se olvida
 * el vínculo) o quitarlo (se borra el pago y el gasto).
 */
export async function resolverFueraDeBernie(gastoId: string, quitarPago: boolean) {
  const { bodaId } = await bodaActiva();
  const db = getDb();
  const [gasto] = await db
    .select({ pagoId: gastosBernie.pagoId })
    .from(gastosBernie)
    .where(and(eq(gastosBernie.id, gastoId), eq(gastosBernie.bodaId, bodaId), eq(gastosBernie.fueraDeBernie, true), isNotNull(gastosBernie.pagoId)));
  if (!gasto?.pagoId) return;

  await db.batch([
    db.delete(gastosBernie).where(and(eq(gastosBernie.id, gastoId), eq(gastosBernie.bodaId, bodaId))),
    ...(quitarPago ? [db.delete(pagos).where(and(eq(pagos.id, gasto.pagoId), eq(pagos.bodaId, bodaId)))] : []),
  ]);
  refrescar();
}
