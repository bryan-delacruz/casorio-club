import type { Metadata } from "next";
import { Camino } from "../_acciones/camino";
import {
  listarAcciones,
  listarDependencias,
  listarMiembros,
  obtenerBoda,
} from "../_acciones/acciones-servidor";
import { Vistas } from "../_acciones/vistas";

export const metadata: Metadata = { title: "El camino" };

export default async function CaminoPage() {
  const [acciones, miembros, dependencias, boda] = await Promise.all([
    listarAcciones(),
    listarMiembros(),
    listarDependencias(),
    obtenerBoda(),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-10">
      <Vistas />
      <div className="mt-8">
        <Camino
          acciones={acciones}
          miembros={miembros}
          dependencias={dependencias}
          fechaBoda={boda?.fecha ?? null}
        />
      </div>
    </main>
  );
}
