import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";

/**
 * Puerta de la zona privada. Al vivir en el layout, protege esta ruta y todo
 * lo que se cuelgue debajo, sin depender de que un patrón de rutas acierte.
 */
export default async function MiBodaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await auth.protect();

  return (
    <div className="flex min-h-dvh flex-col">
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
          <Button variant="ghost" size="lg" asChild>
            <Link href="/mi-boda/equipo">Quién está</Link>
          </Button>
          <UserButton />
        </div>
      </header>

      {children}
    </div>
  );
}
