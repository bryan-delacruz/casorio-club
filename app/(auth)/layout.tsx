import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

/**
 * Entrar al club: el campo primary a pantalla completa y la tarjeta de Clerk
 * encima. La tarjeta la dibuja Clerk, no nosotros: envolverla en un Card
 * propio anidaba tarjeta dentro de tarjeta y duplicaba título y pie. Los
 * textos se cambian por localización, en lib/clerk-localization.ts.
 *
 * El margen lateral es px-5 (20px) y no px-6 a propósito: Clerk fija un ancho
 * mínimo de 320px en su tarjeta, y a 360px de pantalla px-6 solo deja 312, con
 * lo que la tarjeta desalineaba 8px respecto de la marca y el pie.
 *
 * El contenido se ancla arriba en vez de centrarse verticalmente, a propósito:
 * con justify-center la posición sale de (alto de ventana − alto del
 * contenido)/2, así que según el alto de la ventana cae en medio píxel y los
 * bordes horizontales se rasterizan borrosos. Anclado arriba es determinista.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-primary flex min-h-dvh flex-col items-center gap-7 px-5 pt-16 pb-12 sm:px-10">
      <Link href="/" className="w-full max-w-[25rem]">
        <Wordmark tone="inverted" />
      </Link>

      <main className="w-full max-w-[25rem]">{children}</main>

      <p className="text-primary-foreground/70 w-full max-w-[25rem] text-sm">
        Uno lo abre, los dos lo llevan.
      </p>
    </div>
  );
}
