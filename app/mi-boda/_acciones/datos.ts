import "server-only";
import { cache } from "react";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import { acciones, bodas, dependencias, gastosBernie, metas, pagos, type Pago } from "@/db/schema";
import { integracionDisponible } from "@/lib/bernie/config";
import { inicialesDe } from "@/lib/persona";

/**
 * Lecturas de la boda activa para los Server Components.
 *
 * Viven aquí y no en acciones-servidor.ts: todo lo que exporta un archivo
 * "use server" se publica como un endpoint POST invocable desde el cliente, y
 * una lectura no necesita serlo. `cache` evita repetir la consulta si el
 * layout y la página piden lo mismo en una misma petición.
 */

/** La fecha de la boda, si ya la decidieron. */
export const obtenerBoda = cache(async () => {
  const { orgId } = await auth();
  if (!orgId) return null;
  const [fila] = await getDb().select().from(bodas).where(eq(bodas.id, orgId));
  return fila ?? null;
});

export const listarDependencias = cache(async () => {
  const { orgId } = await auth();
  if (!orgId) return [];
  return getDb()
    .select()
    .from(dependencias)
    .where(eq(dependencias.bodaId, orgId));
});

/**
 * Las lecturas toleran no tener sesión y devuelven vacío; las escrituras no.
 *
 * Next renderiza el layout y la página en paralelo, así que esta consulta
 * puede ejecutarse antes de que `auth.protect()` del layout redirija. Lanzar
 * ahí producía un 500 en una petición que de todos modos se descarta. Una
 * escritura, en cambio, nunca debe pasar sin sesión.
 */
export const listarAcciones = cache(async () => {
  const { orgId } = await auth();
  if (!orgId) return [];
  const bodaId = orgId;
  return getDb()
    .select()
    .from(acciones)
    .where(eq(acciones.bodaId, bodaId))
    .orderBy(asc(acciones.momento), asc(acciones.orden), asc(acciones.creadaEl));
});

/** La gente de esta boda, para elegir responsable. */
export const listarMiembros = cache(async () => {
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
      iniciales: inicialesDe(u?.firstName, u?.lastName, deCorreo ?? ""),
    };
  });
});

/** Todos los pagos de la boda. La página los reparte por acción. */
export const listarPagos = cache(async (): Promise<Pago[]> => {
  const { orgId } = await auth();
  if (!orgId) return [];
  // Pagos que vinieron de Bernie, para el badge, en paralelo con los pagos. Si
  // las tablas de la integración aún no existen, simplemente no hay badge.
  const [filas, deBernie] = await Promise.all([
    getDb()
      .select()
      .from(pagos)
      .where(eq(pagos.bodaId, orgId))
      .orderBy(asc(pagos.fecha), asc(pagos.creadoEl)),
    integracionDisponible()
      ? getDb()
          .select({ pagoId: gastosBernie.pagoId })
          .from(gastosBernie)
          .where(and(eq(gastosBernie.bodaId, orgId), isNotNull(gastosBernie.pagoId)))
          .then((r) => new Set(r.map((x) => x.pagoId)))
          .catch(() => new Set<string | null>())
      : null,
  ]);
  if (!deBernie) return filas;
  return filas.map((p) => ({ ...p, deBernie: deBernie.has(p.id) }));
});

export const listarMetas = cache(async () => {
  const { orgId } = await auth();
  if (!orgId) return [];
  return getDb()
    .select()
    .from(metas)
    .where(eq(metas.bodaId, orgId))
    .orderBy(asc(metas.orden), asc(metas.creadaEl));
});
