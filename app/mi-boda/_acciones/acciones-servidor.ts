"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, sql } from "drizzle-orm";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import { acciones } from "@/db/schema";

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

export async function crearAccion(datos: {
  titulo: string;
  momento: Momento;
  cuestaTiempo: boolean;
  monto: string | null;
  responsableId: string | null;
  notas: string | null;
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
    orden: siguiente,
  });

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
