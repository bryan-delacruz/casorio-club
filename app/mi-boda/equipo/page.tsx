import type { Metadata } from "next";
import { OrganizationProfile } from "@clerk/nextjs";

export const metadata: Metadata = { title: "Quién está" };

/**
 * Gestión de miembros e invitaciones. La pantalla entera la aporta Clerk:
 * invitar por correo, roles, revocar y salirse ya vienen resueltos, y el tema
 * shadcn hace que salga con la paleta. Construir esto a mano habría sido
 * escribir tokens de invitación, correos y aceptación para nada.
 */
export default function EquipoPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-14 sm:px-10">
      <h1 className="font-display text-foreground text-[2rem] leading-tight">
        Quién está en la boda
      </h1>
      <p className="text-muted-foreground mt-2 mb-8 max-w-[60ch] leading-6">
        Invita por correo a quien organiza contigo. Verá y editará lo mismo que
        tú.
      </p>

      <OrganizationProfile routing="hash" />
    </main>
  );
}
