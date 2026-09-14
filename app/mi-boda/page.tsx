import type { Metadata } from "next";
import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Mi boda" };

export default async function MiBodaPage() {
  const { orgId } = await auth();
  const user = await currentUser();
  const nombre = user?.firstName ?? "";

  // Cuántos son en esta boda: es el dato que justifica invitar.
  let miembros = 1;
  let invitacionesPendientes = 0;
  if (orgId) {
    const clerk = await clerkClient();
    const [lista, pendientes] = await Promise.all([
      clerk.organizations.getOrganizationMembershipList({
        organizationId: orgId,
        limit: 20,
      }),
      clerk.organizations.getOrganizationInvitationList({
        organizationId: orgId,
        status: ["pending"],
      }),
    ]);
    miembros = lista.totalCount;
    invitacionesPendientes = pendientes.totalCount;
  }

  const solo = miembros === 1 && invitacionesPendientes === 0;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-14 sm:px-10">
      <h1 className="font-display text-foreground text-[2.5rem] leading-tight">
        {nombre ? `Hola, ${nombre}` : "Hola"}
      </h1>
      <p className="text-muted-foreground mt-3 max-w-[60ch] leading-relaxed">
        {solo
          ? "Tu boda ya está abierta, pero la estás llevando solo. Trae a quien la organiza contigo y verán lo mismo."
          : "Tu boda está abierta y compartida. Todavía no hay nada anotado."}
      </p>

      <Card className="mt-10">
        <CardHeader>
          <CardTitle className="font-display text-lg font-normal">
            {solo ? "Todavía están solos aquí" : "Ya son varios"}
          </CardTitle>
          <CardDescription>
            {miembros === 1 ? "1 persona" : `${miembros} personas`}
            {invitacionesPendientes > 0 &&
              ` · ${invitacionesPendientes} invitación${
                invitacionesPendientes === 1 ? "" : "es"
              } sin aceptar`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Quien entre a esta boda ve y edita lo mismo que tú: los trámites,
            los pendientes, las compras y los gastos.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild>
            <Link href="/mi-boda/equipo">
              {solo ? "Invitar a alguien" : "Ver quién está"}
            </Link>
          </Button>
        </CardFooter>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-display text-lg font-normal">
            Aún no hay nada anotado
          </CardTitle>
          <CardDescription>
            Aquí van los trámites, pendientes, compras, gastos y la línea de
            tiempo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Falta conectar la base de datos para poder guardarlos.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
