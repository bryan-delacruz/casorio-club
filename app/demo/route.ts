import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { DEMO, reiniciarDemoSiHaceFalta } from "@/lib/demo";

/**
 * "Probar la demo": entra como Ana a la boda de ejemplo con un token de un
 * solo uso de Clerk, sin contraseña.
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (userId) {
    return NextResponse.redirect(new URL("/mi-boda", request.url));
  }

  const clerk = await clerkClient();

  // Si alguien se salió de la boda de ejemplo, se la devuelve.
  const { data: suyas } = await clerk.users.getOrganizationMembershipList({
    userId: DEMO.visitanteId,
  });
  if (!suyas.some((m) => m.organization.id === DEMO.orgId)) {
    await clerk.organizations.createOrganizationMembership({
      organizationId: DEMO.orgId,
      userId: DEMO.visitanteId,
      role: "org:member",
    });
  }

  await reiniciarDemoSiHaceFalta();

  const { token } = await clerk.signInTokens.createSignInToken({
    userId: DEMO.visitanteId,
    expiresInSeconds: 60,
  });

  const entrar = new URL("/entrar", request.url);
  entrar.searchParams.set("__clerk_ticket", token);
  return NextResponse.redirect(entrar);
}
