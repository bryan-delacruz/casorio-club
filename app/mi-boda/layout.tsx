import { auth } from "@clerk/nextjs/server";

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
  return <>{children}</>;
}
