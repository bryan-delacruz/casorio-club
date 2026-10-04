import type { Metadata } from "next";
import Link from "next/link";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { Mapa } from "./_acciones/mapa";
import { Vistas } from "./_acciones/vistas";
import {
  listarAcciones,
  listarDependencias,
  listarMetas,
  listarMiembros,
  listarPagos,
} from "./_acciones/datos";

export const metadata: Metadata = { title: "Mi boda" };

export default async function MiBodaPage() {
  const { orgId } = await auth();
  const user = await currentUser();
  const nombre = user?.firstName ?? "";

  const [acciones, miembros, pagos, dependencias, metas] = await Promise.all([
    listarAcciones(),
    listarMiembros(),
    listarPagos(),
    listarDependencias(),
    listarMetas(),
  ]);

  let invitacionesPendientes = 0;
  if (orgId) {
    const clerk = await clerkClient();
    const pendientes =
      await clerk.organizations.getOrganizationInvitationList({
        organizationId: orgId,
        status: ["pending"],
      });
    invitacionesPendientes = pendientes.totalCount;
  }

  const solo = miembros.length === 1 && invitacionesPendientes === 0;
  const hechas = acciones.filter((a) => a.estado === "hecho").length;
  const haciendo = acciones.filter((a) => a.estado === "haciendo").length;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-10">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="font-display text-foreground text-[2rem] leading-tight">
            {nombre ? `Hola, ${nombre}` : "Hola"}
          </h1>
          <p className="text-muted-foreground mt-1.5 max-w-[60ch] leading-6">
            {acciones.length === 0
              ? "Empieza por anotar lo que se les venga a la cabeza. Ya decidirán después cuándo va cada cosa."
              : `${hechas} de ${acciones.length} hechas${
                  haciendo > 0 ? `, ${haciendo} en marcha` : ""
                }.`}
          </p>
        </div>

        {solo && (
          <Button variant="outline" size="lg" asChild>
            <Link href="/mi-boda/equipo">Invitar a alguien</Link>
          </Button>
        )}
      </div>

      <div className="mt-7">
        <Vistas />
      </div>

      <div className="mt-6">
        <Mapa
          iniciales={acciones}
          miembros={miembros}
          pagos={pagos}
          dependencias={dependencias}
          metas={metas.map((m) => ({ id: m.id, titulo: m.titulo }))}
        />
      </div>
    </main>
  );
}
