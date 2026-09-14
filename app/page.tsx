import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { Expediente } from "@/components/expediente";

const seLleva = [
  {
    titulo: "Trámites y papeleos",
    detalle:
      "Cada requisito de la municipalidad, quién lo consigue y qué falta.",
  },
  {
    titulo: "Pendientes",
    detalle: "Lo que hay que hacer, con nombre y fecha, no en la cabeza.",
  },
  {
    titulo: "Compras",
    detalle: "Qué falta comprar, a qué proveedor y por cuánto.",
  },
  {
    titulo: "Gastos",
    detalle: "Lo que llevan gastado y lo que todavía hay que pagar.",
  },
  {
    titulo: "Línea de tiempo",
    detalle: "Antes del matrimonio, el día mismo y lo que viene después.",
  },
];

export default async function Home() {
  // Core 3 retiró <SignedIn>/<SignedOut>; el estado se lee en el servidor.
  const { userId } = await auth();
  const dentro = Boolean(userId);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-6 sm:px-10">
        <Wordmark />
        <nav className="flex items-center gap-1 sm:gap-2">
          {dentro ? (
            <Button size="lg" asChild>
              <Link href="/mi-boda">Ir a mi boda</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="lg" asChild>
                <Link href="/entrar">Entrar</Link>
              </Button>
              <Button size="lg" className="hidden sm:inline-flex" asChild>
                <Link href="/crear-cuenta">Crear cuenta</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl gap-14 px-6 pt-10 pb-20 sm:px-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center lg:gap-20 lg:pt-16 lg:pb-28">
          <div>
            <h1 className="font-display text-foreground max-w-[13ch] text-[clamp(2.75rem,6.5vw,4.5rem)] leading-[1.03]">
              Primero la carpeta, después la fiesta.
            </h1>
            <p className="text-muted-foreground mt-6 max-w-[46ch] text-lg leading-7">
              Casarse por civil es juntar papeles, hacer colas y no olvidarse de
              nada. Casorio Club es donde los dos llevan esa lista, y ven lo
              mismo sin tener que preguntarse.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Button size="lg" className="h-10 px-5 text-[0.9375rem]" asChild>
                <Link href={dentro ? "/mi-boda" : "/crear-cuenta"}>
                  {dentro ? "Ir a mi boda" : "Abrir nuestra carpeta"}
                </Link>
              </Button>
              {!dentro && (
                <span className="text-muted-foreground text-sm">
                  Gratis, y se comparte con quien organiza contigo.
                </span>
              )}
            </div>
          </div>

          <Expediente />
        </section>

        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10 lg:py-20">
            <h2 className="font-display text-2xl">Lo que se lleva aquí</h2>
            <dl className="mt-10 grid gap-x-12 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
              {seLleva.map(({ titulo, detalle }) => (
                <div key={titulo}>
                  <dt className="font-display text-lg">{titulo}</dt>
                  <dd className="mt-1 max-w-[44ch] leading-relaxed opacity-70">
                    {detalle}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
    </div>
  );
}
