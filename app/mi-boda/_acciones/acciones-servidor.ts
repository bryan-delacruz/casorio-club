"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import { acciones, bodas, dependencias, pagos } from "@/db/schema";

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

export type Momento = "idea" | "antes" | "el_dia" | "despues";

/** La fecha de la boda, si ya la decidieron. */
export async function obtenerBoda() {
  const { orgId } = await auth();
  if (!orgId) return null;
  const [fila] = await getDb().select().from(bodas).where(eq(bodas.id, orgId));
  return fila ?? null;
}

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

export async function listarDependencias() {
  const { orgId } = await auth();
  if (!orgId) return [];
  return getDb()
    .select()
    .from(dependencias)
    .where(eq(dependencias.bodaId, orgId));
}

/**
 * "A necesita B". Rechaza el ciclo: si B ya depende de A, directa o por una
 * cadena, aceptarlo dejaría dos tareas esperándose para siempre.
 */
export async function anadirDependencia(accionId: string, requiereId: string) {
  const { bodaId } = await bodaActiva();
  if (accionId === requiereId) throw new Error("Una acción no se necesita a sí misma");

  const suyas = await getDb()
    .select({ id: acciones.id })
    .from(acciones)
    .where(and(eq(acciones.bodaId, bodaId), inArray(acciones.id, [accionId, requiereId])));
  if (suyas.length !== 2) throw new Error("Esa acción no es de esta boda");

  const todas = await getDb()
    .select()
    .from(dependencias)
    .where(eq(dependencias.bodaId, bodaId));

  // ¿Se llega de requiereId a accionId siguiendo las flechas que ya existen?
  const porQuien = new Map<string, string[]>();
  for (const d of todas) {
    porQuien.set(d.accionId, [...(porQuien.get(d.accionId) ?? []), d.requiereId]);
  }
  const vistos = new Set<string>();
  const pila = [requiereId];
  while (pila.length) {
    const actual = pila.pop()!;
    if (actual === accionId) throw new Error("Eso haría un círculo");
    if (vistos.has(actual)) continue;
    vistos.add(actual);
    pila.push(...(porQuien.get(actual) ?? []));
  }

  await getDb()
    .insert(dependencias)
    .values({ bodaId, accionId, requiereId })
    .onConflictDoNothing();

  revalidatePath("/mi-boda");
}

export async function quitarDependencia(accionId: string, requiereId: string) {
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
  revalidatePath("/mi-boda");
}

/**
 * Las lecturas toleran no tener sesión y devuelven vacío; las escrituras no.
 *
 * Next renderiza el layout y la página en paralelo, así que esta consulta
 * puede ejecutarse antes de que `auth.protect()` del layout redirija. Lanzar
 * ahí producía un 500 en una petición que de todos modos se descarta. Una
 * escritura, en cambio, nunca debe pasar sin sesión.
 */
export async function listarAcciones() {
  const { orgId } = await auth();
  if (!orgId) return [];
  const bodaId = orgId;
  return getDb()
    .select()
    .from(acciones)
    .where(eq(acciones.bodaId, bodaId))
    .orderBy(asc(acciones.momento), asc(acciones.orden), asc(acciones.creadaEl));
}

/** La gente de esta boda, para elegir responsable. */
export async function listarMiembros() {
  const { orgId } = await auth();
  if (!orgId) return [];
  const bodaId = orgId;
  const clerk = await clerkClient();
  const { data } = await clerk.organizations.getOrganizationMembershipList({
    organizationId: bodaId,
    limit: 20,
  });
  return data.map((m) => {
    const u = m.publicUserData;
    const propio = [u?.firstName, u?.lastName].filter(Boolean).join(" ");
    // Sin nombre puesto, Clerk devuelve el correo. Mostrarlo entero desborda
    // la tarjeta, así que se usa la parte de antes de la arroba.
    const deCorreo = u?.identifier?.includes("@")
      ? u.identifier.split("@")[0].replace(/[._-]+/g, " ")
      : u?.identifier;
    return {
      id: u?.userId ?? "",
      nombre: propio || deCorreo || "Alguien",
      imagen: u?.imageUrl ?? null,
    };
  });
}

/** Todos los pagos de la boda. La página los reparte por acción. */
export async function listarPagos() {
  const { orgId } = await auth();
  if (!orgId) return [];
  return getDb()
    .select()
    .from(pagos)
    .where(eq(pagos.bodaId, orgId))
    .orderBy(asc(pagos.fecha), asc(pagos.creadoEl));
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
  momento: Momento;
  cuestaTiempo: boolean;
  monto: string | null;
  responsableId: string | null;
  notas: string | null;
  inicioSemanas: number | null;
  duracionSemanas: number;
}) {
  const { bodaId } = await bodaActiva();
  const titulo = datos.titulo.trim();
  if (!titulo) throw new Error("Falta el título");

  // Va al final de su carril.
  const [{ siguiente }] = await getDb()
    .select({ siguiente: sql<number>`coalesce(max(${acciones.orden}), -1) + 1` })
    .from(acciones)
    .where(and(eq(acciones.bodaId, bodaId), eq(acciones.momento, datos.momento)));

  await getDb().insert(acciones).values({
    bodaId,
    titulo,
    momento: datos.momento,
    cuestaTiempo: datos.cuestaTiempo,
    monto: datos.monto,
    responsableId: datos.responsableId,
    notas: datos.notas,
    inicioSemanas: datos.inicioSemanas,
    duracionSemanas: datos.duracionSemanas,
    orden: siguiente,
  });

  revalidatePath("/mi-boda");
}

/**
 * Editar no toca `momento` ni `orden`: mover es cosa del menú y del arrastre.
 * Si el formulario también moviera, habría dos caminos que recalculan el orden
 * del carril y se pisarían.
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
  },
) {
  const { bodaId } = await bodaActiva();
  const titulo = datos.titulo.trim();
  if (!titulo) throw new Error("Falta el título");

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
      actualizadaEl: new Date(),
    })
    .where(and(eq(acciones.id, id), eq(acciones.bodaId, bodaId)));

  revalidatePath("/mi-boda");
}

export async function moverAccion(id: string, momento: Momento) {
  const { bodaId } = await bodaActiva();
  const [{ siguiente }] = await getDb()
    .select({ siguiente: sql<number>`coalesce(max(${acciones.orden}), -1) + 1` })
    .from(acciones)
    .where(and(eq(acciones.bodaId, bodaId), eq(acciones.momento, momento)));

  await getDb()
    .update(acciones)
    .set({ momento, orden: siguiente, actualizadaEl: new Date() })
    .where(and(eq(acciones.id, id), eq(acciones.bodaId, bodaId)));

  revalidatePath("/mi-boda");
}

export async function alternarHecha(id: string, hecha: boolean) {
  const { bodaId } = await bodaActiva();
  await getDb()
    .update(acciones)
    .set({ hecha, actualizadaEl: new Date() })
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
