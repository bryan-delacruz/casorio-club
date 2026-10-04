import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { configBernie } from "@/lib/bernie/config";
import { cookieDeFlujo } from "@/lib/bernie/flujo";
import { challengeS256, nuevoState, nuevoVerificador } from "@/lib/bernie/pkce";
import { DEMO } from "@/lib/demo";

export const runtime = "nodejs";

/**
 * Empieza "Conectar con Bernie Wallet" (OAuth 2.1 + PKCE, docs §5): guarda
 * state y verificador en la cookie cifrada y manda a la pantalla de permiso.
 */
export async function GET(request: NextRequest) {
  const { userId, orgId } = await auth();
  const origen = request.nextUrl.origin;
  if (!userId) return NextResponse.redirect(`${origen}/entrar`);
  if (!orgId) return NextResponse.redirect(`${origen}/elegir-boda`);

  const config = configBernie();
  if (!config || orgId === DEMO.orgId) {
    return NextResponse.redirect(`${origen}/mi-boda/bernie?error=no_disponible`);
  }

  const state = nuevoState();
  const verificador = nuevoVerificador();
  const destino = new URL(config.authorizeUrl);
  destino.search = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: `${origen}/api/bernie/callback`,
    code_challenge: challengeS256(verificador),
    code_challenge_method: "S256",
    state,
    scope: "email",
  }).toString();

  const res = NextResponse.redirect(destino);
  res.cookies.set(cookieDeFlujo({ state, verificador, bodaId: orgId, userId }));
  return res;
}
