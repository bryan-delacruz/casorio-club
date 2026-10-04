import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import { conexionesBernie } from "@/db/schema";
import { cifrar } from "@/lib/bernie/cifrado";
import { canjearCodigo, claimsDelToken } from "@/lib/bernie/cliente";
import { COOKIE_FLUJO, leerFlujo } from "@/lib/bernie/flujo";
import { mismoState } from "@/lib/bernie/pkce";
import { sincronizarBernie } from "@/lib/bernie/sincronizar";

export const runtime = "nodejs";

/** Vuelta desde Bernie (docs §5): valida, canjea el código y guarda la conexión. */
export async function GET(request: NextRequest) {
  const origen = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;
  const flujo = leerFlujo(request.cookies.get(COOKIE_FLUJO)?.value);

  const volver = (consulta: string) => {
    const res = NextResponse.redirect(`${origen}/mi-boda/bernie?${consulta}`);
    res.cookies.set({ name: COOKIE_FLUJO, value: "", path: "/api/bernie", maxAge: 0 });
    return res;
  };

  const { userId, orgId } = await auth();
  // Misma persona, misma boda y mismo state con que empezó el flujo: si no, es
  // un callback ajeno (CSRF) o una pestaña vieja.
  const state = params.get("state");
  if (!flujo || !state || !mismoState(flujo.state, state) || flujo.userId !== userId || flujo.bodaId !== orgId) {
    return volver("error=flujo");
  }
  if (params.get("error")) {
    return volver(params.get("error") === "access_denied" ? "error=cancelado" : "error=bernie");
  }
  const codigo = params.get("code");
  if (!codigo) return volver("error=bernie");

  try {
    const tokens = await canjearCodigo(codigo, flujo.verificador, `${origen}/api/bernie/callback`);
    if (!tokens.refreshToken) throw new Error("Bernie no entregó refresh token");
    const { sub } = claimsDelToken(tokens.accessToken);

    const valores = {
      conectadaPorId: flujo.userId,
      bernieUserId: sub,
      refreshToken: cifrar(tokens.refreshToken),
      cursor: null,
      estado: "activa" as const,
      sincronizandoHasta: null,
      ultimoError: null,
    };
    await getDb()
      .insert(conexionesBernie)
      .values({ bodaId: flujo.bodaId, ...valores })
      .onConflictDoUpdate({ target: conexionesBernie.bodaId, set: valores });
  } catch (error) {
    console.error(JSON.stringify({ event: "bernie_callback_error", error: error instanceof Error ? error.message : String(error) }));
    return volver("error=bernie");
  }

  // La primera sync aquí mismo: el usuario llega a una bandeja ya llena.
  await sincronizarBernie(flujo.bodaId).catch(() => null);
  return volver("conectado=1");
}
