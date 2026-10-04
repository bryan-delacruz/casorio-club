import "server-only";
import { cache } from "react";
import { asc, desc, eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import { acciones, conexionesBernie, gastosBernie } from "@/db/schema";
import { DEMO } from "@/lib/demo";

// Lectura para el Server Component; fuera de acciones-bernie.ts para no
// publicarla como Server Action (ver _acciones/datos.ts).

const UNA_HORA_MS = 60 * 60 * 1000;

/** Datos de la bandeja y de la conexión, para la página. */
export const listarBandeja = cache(async () => {
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
});
