import type { Metadata } from "next";
import { clerkClient } from "@clerk/nextjs/server";
import { integracionDisponible } from "@/lib/bernie/config";
import { listarBandeja } from "./acciones-bernie";
import { Bandeja } from "./bandeja";

export const metadata: Metadata = { title: "Gastos de Bernie" };

/**
 * Gastos que llegan de Bernie Wallet y la conexión que los trae
 * (docs/integracion-bernie.md §8).
 */
export default async function BerniePage({
  searchParams,
}: {
  searchParams: Promise<{ conectado?: string; error?: string }>;
}) {
  const [datos, aviso] = await Promise.all([listarBandeja(), searchParams]);

  let conectadaPor: string | null = null;
  if (datos?.conexion) {
    const clerk = await clerkClient();
    const u = await clerk.users.getUser(datos.conexion.conectadaPorId).catch(() => null);
    conectadaPor = u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.primaryEmailAddress?.emailAddress || null : null;
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-14 sm:px-10">
      <h1 className="font-display text-foreground text-[2rem] leading-tight">Gastos de Bernie</h1>
      <p className="text-muted-foreground mt-2 mb-8 max-w-[60ch] leading-6">
        Lo que ya pagaron y registraron en Bernie Wallet llega aquí. Asigna cada gasto a su
        acción y se suma como pago, sin escribirlo dos veces.
      </p>

      <Bandeja
        disponible={integracionDisponible() && datos !== null}
        datos={datos}
        conectadaPor={conectadaPor}
        aviso={aviso.conectado ? "conectado" : (aviso.error ?? null)}
      />
    </main>
  );
}
