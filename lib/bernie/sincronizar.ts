import "server-only";
import { and, eq, inArray, isNotNull, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "@/db";
import { conexionesBernie, gastosBernie, pagos, type ConexionBernie } from "@/db/schema";
import { cifrar, descifrar } from "./cifrado";
import { ErrorBernie, pedirCambios, refrescar, revocarEnBernie } from "./cliente";
import { planificar } from "./plan";

/**
 * Sincronización con Bernie (docs/integracion-bernie.md §6). La pueden disparar
 * a la vez un webhook, el botón y la apertura de la bandeja: el lease garantiza
 * que solo una corra por boda.
 */
const LEASE_MS = 90_000;
const MAX_PAGINAS = 25;

export type ResultadoSync =
  | { estado: "ok"; nuevos: number }
  | { estado: "ocupado" | "sin_conexion" | "revocada" }
  | { estado: "error"; mensaje: string };

async function tomarLease(bodaId: string): Promise<ConexionBernie | null> {
  const ahora = new Date();
  const [conexion] = await getDb()
    .update(conexionesBernie)
    .set({ sincronizandoHasta: new Date(ahora.getTime() + LEASE_MS) })
    .where(
      and(
        eq(conexionesBernie.bodaId, bodaId),
        or(eq(conexionesBernie.estado, "activa"), eq(conexionesBernie.estado, "error")),
        or(isNull(conexionesBernie.sincronizandoHasta), lt(conexionesBernie.sincronizandoHasta, ahora)),
      ),
    )
    .returning();
  return conexion ?? null;
}

/**
 * Access token fresco. Bernie rota el refresh token: el nuevo se guarda solo si
 * el guardado sigue siendo el que usamos (compare-and-set); si no, otra sync
 * ganó la carrera y esta se retira sin tocar nada.
 */
export async function accessTokenDe(conexion: ConexionBernie): Promise<string> {
  let tokens;
  try {
    tokens = await refrescar(descifrar(conexion.refreshToken));
  } catch (error) {
    if (error instanceof ErrorBernie && error.codigo === "invalid_grant") {
      const [actual] = await getDb()
        .select({ refreshToken: conexionesBernie.refreshToken })
        .from(conexionesBernie)
        .where(eq(conexionesBernie.bodaId, conexion.bodaId));
      // Cambió mientras tanto: lo rotó otra sync, no es una revocación.
      if (actual && actual.refreshToken !== conexion.refreshToken) throw new ErrorBernie("internal", "carrera");
    }
    throw error;
  }

  if (tokens.refreshToken) {
    const guardado = await getDb()
      .update(conexionesBernie)
      .set({ refreshToken: cifrar(tokens.refreshToken) })
      .where(and(eq(conexionesBernie.bodaId, conexion.bodaId), eq(conexionesBernie.refreshToken, conexion.refreshToken)))
      .returning({ bodaId: conexionesBernie.bodaId });
    if (guardado.length === 0) throw new ErrorBernie("internal", "carrera");
  }
  return tokens.accessToken;
}

/** Aplica una página de cambios y avanza el cursor en una sola transacción. */
async function aplicarPagina(
  bodaId: string,
  pagina: Awaited<ReturnType<typeof pedirCambios>>,
) {
  const db = getDb();
  const ids = [
    ...pagina.added.map((g) => g.id),
    ...pagina.modified.map((g) => g.id),
    ...pagina.removed,
  ];
  const existentes = new Map<string, string | null>();
  if (ids.length) {
    const filas = await db
      .select({ externoId: gastosBernie.externoId, pagoId: gastosBernie.pagoId })
      .from(gastosBernie)
      .where(and(eq(gastosBernie.bodaId, bodaId), inArray(gastosBernie.externoId, ids)));
    for (const f of filas) existentes.set(f.externoId, f.pagoId);
  }

  const plan = planificar(pagina, existentes);
  const ops: BatchItem<"pg">[] = [];

  if (plan.guardar.length) {
    ops.push(
      db
        .insert(gastosBernie)
        .values(plan.guardar.map((g) => ({ bodaId, ...g })))
        .onConflictDoUpdate({
          target: [gastosBernie.bodaId, gastosBernie.externoId],
          // descartado se respeta: si el usuario lo descartó, una edición no lo revive.
          set: {
            fecha: sql`excluded.fecha`,
            monto: sql`excluded.monto`,
            moneda: sql`excluded.moneda`,
            comercio: sql`excluded.comercio`,
            subcategoria: sql`excluded.subcategoria`,
            fueraDeBernie: false,
            actualizadoEl: new Date(),
          },
        }),
    );
  }
  for (const p of plan.actualizarPagos) {
    // Bernie es la fuente de verdad del monto y la fecha de lo que ya se asignó.
    ops.push(
      db
        .update(pagos)
        .set({ monto: p.monto, fecha: p.fecha })
        .where(and(eq(pagos.id, p.pagoId), eq(pagos.bodaId, bodaId))),
    );
  }
  if (plan.borrar.length) {
    ops.push(
      db
        .delete(gastosBernie)
        .where(and(eq(gastosBernie.bodaId, bodaId), inArray(gastosBernie.externoId, plan.borrar), isNull(gastosBernie.pagoId))),
    );
  }
  if (plan.marcarFuera.length) {
    ops.push(
      db
        .update(gastosBernie)
        .set({ fueraDeBernie: true, actualizadoEl: new Date() })
        .where(and(eq(gastosBernie.bodaId, bodaId), inArray(gastosBernie.externoId, plan.marcarFuera))),
    );
  }
  ops.push(db.update(conexionesBernie).set({ cursor: pagina.nextCursor }).where(eq(conexionesBernie.bodaId, bodaId)));

  await db.batch(ops as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  return { nuevos: plan.guardar.filter((g) => !existentes.has(g.externoId)).length, vistos: plan.guardar.map((g) => g.externoId) };
}

/**
 * Tras un cursor_reset se rehízo todo desde cero, y una sync inicial no trae
 * `removed`: lo que estaba en la bandeja y ya no vino, ya no se comparte.
 */
async function limpiarNoVistos(bodaId: string, vistos: Set<string>) {
  const db = getDb();
  const lista = [...vistos];
  const fuera = lista.length ? notInArray(gastosBernie.externoId, lista) : undefined;
  await db.batch([
    db.delete(gastosBernie).where(and(eq(gastosBernie.bodaId, bodaId), isNull(gastosBernie.pagoId), fuera)),
    db
      .update(gastosBernie)
      .set({ fueraDeBernie: true, actualizadoEl: new Date() })
      .where(and(eq(gastosBernie.bodaId, bodaId), isNotNull(gastosBernie.pagoId), fuera)),
  ]);
}

export async function sincronizarBernie(bodaId: string): Promise<ResultadoSync> {
  const conexion = await tomarLease(bodaId);
  if (!conexion) {
    const [existe] = await getDb()
      .select({ estado: conexionesBernie.estado })
      .from(conexionesBernie)
      .where(eq(conexionesBernie.bodaId, bodaId));
    if (!existe) return { estado: "sin_conexion" };
    return existe.estado === "revocada" ? { estado: "revocada" } : { estado: "ocupado" };
  }

  const db = getDb();
  const cerrar = (cambios: Partial<ConexionBernie>) =>
    db.update(conexionesBernie).set({ ...cambios, sincronizandoHasta: null }).where(eq(conexionesBernie.bodaId, bodaId));

  try {
    const accessToken = await accessTokenDe(conexion);
    let cursor = conexion.cursor;
    let nuevos = 0;
    let reinicio: Set<string> | null = null;

    for (let i = 0; i < MAX_PAGINAS; i++) {
      let pagina;
      try {
        pagina = await pedirCambios(accessToken, cursor);
      } catch (error) {
        // El cursor ya no sirve (cambiaron las categorías compartidas): de cero, una vez.
        if (error instanceof ErrorBernie && error.codigo === "cursor_reset" && !reinicio) {
          cursor = null;
          reinicio = new Set();
          continue;
        }
        throw error;
      }
      const aplicado = await aplicarPagina(bodaId, pagina);
      nuevos += aplicado.nuevos;
      aplicado.vistos.forEach((id) => reinicio?.add(id));
      cursor = pagina.nextCursor;
      if (!pagina.hasMore) {
        if (reinicio) await limpiarNoVistos(bodaId, reinicio);
        break;
      }
    }

    await cerrar({ estado: "activa", ultimaSyncEl: new Date(), ultimoError: null });
    return { estado: "ok", nuevos };
  } catch (error) {
    if (error instanceof ErrorBernie) {
      if (error.message === "carrera") {
        await cerrar({});
        return { estado: "ocupado" };
      }
      // El usuario desconectó desde Bernie o el permiso venció.
      if (["invalid_grant", "unauthorized", "not_connected"].includes(error.codigo)) {
        await cerrar({ estado: "revocada", ultimoError: "Bernie ya no da acceso. Vuelve a conectar." });
        return { estado: "revocada" };
      }
    }
    const mensaje =
      error instanceof ErrorBernie && error.codigo === "rate_limited"
        ? "Bernie pidió esperar un poco. Se reintentará en la próxima sincronización."
        : error instanceof ErrorBernie && error.codigo === "red"
          ? "No se pudo contactar a Bernie."
          : "No se pudo sincronizar con Bernie.";
    console.error(JSON.stringify({ event: "bernie_sync_error", bodaId, error: error instanceof Error ? error.message : String(error) }));
    await cerrar({ estado: "error", ultimoError: mensaje });
    return { estado: "error", mensaje };
  }
}

/**
 * Desconectar desde Casorio (§7.1): pide a Bernie que revoque y borra la
 * conexión y la bandeja sin asignar. Los pagos ya asignados se quedan.
 * Si Bernie no responde, se desconecta igual localmente.
 */
export async function desconectarBernie(bodaId: string): Promise<{ revocadaEnBernie: boolean }> {
  const db = getDb();
  const [conexion] = await db.select().from(conexionesBernie).where(eq(conexionesBernie.bodaId, bodaId));
  if (!conexion) return { revocadaEnBernie: true };

  let revocadaEnBernie = false;
  if (conexion.estado !== "revocada") {
    try {
      await revocarEnBernie(await accessTokenDe(conexion));
      revocadaEnBernie = true;
    } catch (error) {
      console.error(JSON.stringify({ event: "bernie_revoke_error", bodaId, error: error instanceof Error ? error.message : String(error) }));
    }
  } else {
    revocadaEnBernie = true;
  }

  await db.batch([
    db.delete(gastosBernie).where(and(eq(gastosBernie.bodaId, bodaId), isNull(gastosBernie.pagoId))),
    db.delete(conexionesBernie).where(eq(conexionesBernie.bodaId, bodaId)),
  ]);
  return { revocadaEnBernie };
}
