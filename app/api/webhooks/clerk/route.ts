import { after, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { getDb } from "@/db";
import { conexionesBernie, gastosBernie } from "@/db/schema";
import { desconectarBernie } from "@/lib/bernie/sincronizar";

export const runtime = "nodejs";

/**
 * Eventos de Clerk que afectan a la integración con Bernie (docs §7):
 * - quien conectó sale de la boda → sus gastos no deben seguir entrando;
 * - la boda se borra → se desconecta y se borra lo que vino de Bernie.
 */
export async function POST(request: NextRequest) {
  let evento;
  try {
    evento = await verifyWebhook(request);
  } catch {
    return new Response(null, { status: 400 });
  }

  if (evento.type === "organizationMembership.deleted") {
    const bodaId = evento.data.organization.id;
    const userId = evento.data.public_user_data.user_id;
    after(async () => {
      const [conexion] = await getDb()
        .select({ bodaId: conexionesBernie.bodaId })
        .from(conexionesBernie)
        .where(and(eq(conexionesBernie.bodaId, bodaId), eq(conexionesBernie.conectadaPorId, userId)));
      if (conexion) await desconectarBernie(bodaId);
    });
  }

  if (evento.type === "organization.deleted" && evento.data.id) {
    const bodaId = evento.data.id;
    after(async () => {
      await desconectarBernie(bodaId);
      await getDb().delete(gastosBernie).where(eq(gastosBernie.bodaId, bodaId));
    });
  }

  return Response.json({ recibido: true });
}
