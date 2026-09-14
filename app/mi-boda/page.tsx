import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { Wordmark } from "@/components/wordmark";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Mi boda" };

export default async function MiBodaPage() {
  const user = await currentUser();
  const nombre = user?.firstName ?? "";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border flex items-center justify-between border-b px-6 py-4 sm:px-10">
        <Wordmark />
        <UserButton />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 sm:px-10">
        <h1 className="font-display text-foreground text-[2.5rem] leading-tight">
          {nombre ? `Hola, ${nombre}` : "Hola"}
        </h1>
        <p className="text-muted-foreground mt-3 max-w-[60ch] leading-relaxed">
          Tu cuenta ya está lista. Todavía no hay nada anotado: el siguiente
          paso es crear la boda y traer a quien la organiza contigo.
        </p>

        <Card className="mt-10">
          <CardHeader>
            <CardTitle className="font-display text-lg font-normal">
              Aún no hay una boda abierta
            </CardTitle>
            <CardDescription>
              Cuando la creen, aquí van los trámites, pendientes, compras,
              gastos y la línea de tiempo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Falta conectar la base de datos para poder guardar la boda e
              invitar a alguien.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
