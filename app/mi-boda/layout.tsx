import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { MenuPersona } from "@/components/menu-persona";
import { personaDe } from "@/lib/persona";
import { NavInferior } from "./_acciones/nav-inferior";
import { RUTAS } from "./_acciones/rutas";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { DEMO } from "@/lib/demo";
import { and, count, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { gastosBernie } from "@/db/schema";
import { integracionDisponible } from "@/lib/bernie/config";
import { cuentaRegresiva } from "@/lib/fecha-boda";
import { hoyEnLima } from "@/lib/historia";
import { FechaBoda } from "./_acciones/fecha-boda";
import { obtenerBoda } from "./_acciones/datos";

/**
 * Puerta de la zona privada. Al vivir en el layout, protege esta ruta y todo
 * lo que se cuelgue debajo, sin depender de que un patrón de rutas acierte.
 */
export default async function MiBodaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { orgId } = await auth.protect();

  // La bandeja de Bernie se ofrece solo si la integración está configurada y
  // no es la boda demo (docs/integracion-bernie.md §9).
  const conBernie = !!orgId && orgId !== DEMO.orgId && integracionDisponible();
  const [porAsignar, yo, boda] = await Promise.all([
    conBernie ? contarPorAsignar(orgId) : 0,
    currentUser(),
    obtenerBoda(),
  ]);
  const fecha = boda?.fecha ?? null;
  const correo = yo?.primaryEmailAddress?.emailAddress;

  return (
    <div className="flex min-h-dvh flex-col max-sm:pb-[calc(4rem+env(safe-area-inset-bottom))]">
      {orgId === DEMO.orgId && (
        <p className="bg-secondary text-secondary-foreground px-5 py-2 text-center text-sm">
          Estás en una boda de ejemplo. Puedes cambiar lo que quieras: se
          reinicia sola cada día.
        </p>
      )}
      <header className="border-border flex flex-wrap items-center gap-x-4 gap-y-3 border-b px-5 py-4 sm:px-10">
        <Link href={RUTAS.mapa}>
          <Wordmark />
        </Link>

        {/* hidePersonal: aquí no existe la cuenta suelta, siempre hay una boda.
            En el celular baja a su propia fila: arriba quedan marca y avatar. */}
        <div className="flex items-center gap-2 max-sm:order-last max-sm:w-full">
          {/* En el celular el switcher es lo que cede: su nombre se recorta
              antes que empujar la cuenta regresiva fuera de la pantalla. */}
          <div className="max-sm:min-w-0 max-sm:flex-1 max-sm:overflow-hidden">
            <OrganizationSwitcher
              hidePersonal
              afterCreateOrganizationUrl={RUTAS.mapa}
              afterSelectOrganizationUrl={RUTAS.mapa}
            />
          </div>
          {/* En el celular la cuenta se mete en esta fila: una tercera
              empujaría el contenido fuera de la primera pantalla. */}
          <div className="ml-auto shrink-0 sm:hidden">
            <FechaBoda fecha={fecha} cuenta={cuentaRegresiva(fecha, hoyEnLima())} />
          </div>
        </div>

        {/* La fecha es el único control de la app: vive en la cabecera y se
            ve desde cualquier ruta de /mi-boda (docs/fecha-de-la-boda.md §4.1). */}
        <div className="ml-auto flex items-center gap-2">
          <div className="max-sm:hidden">
            <FechaBoda fecha={fecha} cuenta={cuentaRegresiva(fecha, hoyEnLima())} />
          </div>
          {/* En el celular estos dos viven en la barra de abajo. */}
          {conBernie && (
            <Button variant="ghost" size="lg" className="max-sm:hidden" asChild>
              <Link href={RUTAS.gastos}>
                Gastos de Bernie
                {porAsignar > 0 && (
                  <span className="bg-primary text-primary-foreground ml-1.5 rounded-full px-1.5 text-xs tabular-nums">
                    {porAsignar}
                  </span>
                )}
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="lg" className="max-sm:hidden" asChild>
            <Link href={RUTAS.equipo}>Quién está</Link>
          </Button>
          {yo && (
            <MenuPersona
              persona={personaDe({
                id: yo.id,
                firstName: yo.firstName,
                lastName: yo.lastName,
                identifier: correo,
                hasImage: yo.hasImage,
                imageUrl: yo.imageUrl,
              })}
              correo={correo}
            />
          )}
        </div>
      </header>

      {children}

      <NavInferior conBernie={conBernie} porAsignar={porAsignar} />
    </div>
  );
}

async function contarPorAsignar(bodaId: string) {
  // Sin la tabla todavía (migración pendiente) la cabecera no debe romperse.
  try {
    const [fila] = await getDb()
      .select({ n: count() })
      .from(gastosBernie)
      .where(and(eq(gastosBernie.bodaId, bodaId), isNull(gastosBernie.pagoId), eq(gastosBernie.descartado, false)));
    return fila?.n ?? 0;
  } catch {
    return 0;
  }
}
