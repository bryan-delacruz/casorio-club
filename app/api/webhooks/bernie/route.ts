import { after } from "next/server";
import { eq, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { conexionesBernie, webhooksRecibidos } from "@/db/schema";
import { verificarWebhook } from "@/lib/bernie/firma";
import { sincronizarBernie } from "@/lib/bernie/sincronizar";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Avisos de Bernie (docs §7). Son delgados: no traen gastos, solo dicen
 * "hay cambios" o "te desconectaron". Se responde 200 de inmediato y el
 * trabajo corre después (after), como pide Standard Webhooks.
 */
export async function POST(request: Request) {
  const secreto = process.env.BERNIE_WEBHOOK_SECRET;
  if (!secreto) return new Response(null, { status: 503 });

  const cuerpo = await request.text();
  const firma = verificarWebhook(
    secreto,
    {
      id: request.headers.get("webhook-id"),
      timestamp: request.headers.get("webhook-timestamp"),
      firma: request.headers.get("webhook-signature"),
    },
    cuerpo,
  );
  if (!firma.ok) return new Response(null, { status: 401 });

  let evento: { type?: unknown; data?: { userId?: unknown } };
  try {
    evento = JSON.parse(cuerpo);
  } catch {
    return new Response(null, { status: 400 });
  }
  const userId = evento.data?.userId;
  if (typeof userId !== "string" || !UUID.test(userId)) return new Response(null, { status: 400 });

  // Entrega "al menos una vez": el mismo webhook-id puede llegar dos veces.
  const nuevo = await getDb()
    .insert(webhooksRecibidos)
    .values({ webhookId: request.headers.get("webhook-id")! })
    .onConflictDoNothing()
    .returning();
  if (nuevo.length === 0) return Response.json({ duplicado: true });

  after(async () => {
    const db = getDb();
    const bodas = await db
      .select({ bodaId: conexionesBernie.bodaId })
      .from(conexionesBernie)
      .where(eq(conexionesBernie.bernieUserId, userId));

    for (const { bodaId } of bodas) {
      if (evento.type === "expenses.sync_available") {
        await sincronizarBernie(bodaId).catch(() => null);
      } else if (evento.type === "grant.revoked") {
        await db
          .update(conexionesBernie)
          .set({ estado: "revocada", ultimoError: "Se desconectó desde Bernie." })
          .where(eq(conexionesBernie.bodaId, bodaId));
      }
    }
    // Los ids viejos ya no sirven para deduplicar: Bernie no reintenta más de 24 h.
    await db.delete(webhooksRecibidos).where(lt(webhooksRecibidos.recibidoEl, new Date(Date.now() - 7 * 86_400_000)));
  });

  return Response.json({ recibido: true });
}
