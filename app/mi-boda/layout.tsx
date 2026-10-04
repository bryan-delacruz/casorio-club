import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { MenuPersona } from "@/components/menu-persona";
import { personaDe } from "@/lib/persona";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { DEMO } from "@/lib/demo";
import { and, count, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { gastosBernie } from "@/db/schema";
import { integracionDisponible } from "@/lib/bernie/config";

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
  const [porAsignar, yo] = await Promise.all([
    conBernie ? contarPorAsignar(orgId) : 0,
    currentUser(),
  ]);
  const correo = yo?.primaryEmailAddress?.emailAddress;

  return (
    <div className="flex min-h-dvh flex-col">
      {orgId === DEMO.orgId && (
        <p className="bg-secondary text-secondary-foreground px-5 py-2 text-center text-sm">
          Estás en una boda de ejemplo. Puedes cambiar lo que quieras: se
          reinicia sola cada día.
        </p>
      )}
      <header className="border-border flex flex-wrap items-center gap-x-4 gap-y-3 border-b px-5 py-4 sm:px-10">
        <Link href="/mi-boda">
          <Wordmark />
        </Link>

        {/* hidePersonal: aquí no existe la cuenta suelta, siempre hay una boda. */}
        <OrganizationSwitcher
          hidePersonal
          afterCreateOrganizationUrl="/mi-boda"
          afterSelectOrganizationUrl="/mi-boda"
        />

        <div className="ml-auto flex items-center gap-2">
          {conBernie && (
            <Button variant="ghost" size="lg" asChild>
              <Link href="/mi-boda/bernie">
                Gastos de Bernie
                {porAsignar > 0 && (
                  <span className="bg-primary text-primary-foreground ml-1.5 rounded-full px-1.5 text-xs tabular-nums">
                    {porAsignar}
                  </span>
                )}
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="lg" asChild>
            <Link href="/mi-boda/equipo">Quién está</Link>
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
