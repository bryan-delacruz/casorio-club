import type { Metadata } from "next";
import Link from "next/link";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { Mapa } from "./_acciones/mapa";
import { Vistas } from "./_acciones/vistas";
import { RUTAS } from "./_acciones/rutas";
import { BotonAnotar } from "./_acciones/boton-anotar";
import { semanasHastaLaBoda } from "@/lib/metas";
import {
  NOMBRE_SIN_META,
  SIN_META,
  TODO_LO_ANOTADO,
  type Carril,
} from "./_acciones/tipos";
import {
  listarAcciones,
  listarDependencias,
  listarMetas,
  listarMiembros,
  listarPagos,
  obtenerBoda,
} from "./_acciones/datos";

export const metadata: Metadata = { title: "Mi boda" };

export default async function MiBodaPage() {
  const { orgId } = await auth();
  const user = await currentUser();
  const nombre = user?.firstName ?? "";

  const [acciones, miembros, pagos, dependencias, metas, boda] = await Promise.all([
    listarAcciones(),
    listarMiembros(),
    listarPagos(),
    listarDependencias(),
    listarMetas(),
    obtenerBoda(),
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

  const metasLite = metas.map((m) => ({ id: m.id, titulo: m.titulo }));

  /**
   * Los carriles del Mapa (docs/metas.md §7): una meta cada uno, en el orden
   * que la pareja les dio, y "Sin meta" al final. Sin ninguna meta queda un
   * carril único, "Todo lo anotado". Lo resuelve el servidor, que ya sabe si
   * la boda tiene metas, para que el cliente no decida la estructura.
   */
  const carriles: Carril[] =
    metasLite.length > 0
      ? [
          ...metasLite.map((m) => ({ id: m.id, nombre: m.titulo, esMeta: true })),
          { id: SIN_META, nombre: NOMBRE_SIN_META, esMeta: false },
        ]
      : [{ id: SIN_META, nombre: TODO_LO_ANOTADO, esMeta: false }];

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
            <Link href={RUTAS.equipo}>Invitar a alguien</Link>
          </Button>
        )}
      </div>

      <div className="mt-7 max-sm:hidden">
        <Vistas />
      </div>

      <div className="mt-6">
        <Mapa
          iniciales={acciones}
          miembros={miembros}
          pagos={pagos}
          dependencias={dependencias}
          metas={metasLite}
          carriles={carriles}
          // Se cuenta en el servidor: en el cliente, "hoy" puede caer en otra
          // semana que en el render del servidor y la hidratación avisaría.
          semanasHastaLaBoda={semanasHastaLaBoda(boda?.fecha ?? null)}
        />
      </div>
      <BotonAnotar miembros={miembros} metas={metasLite} />
    </main>
  );
}
