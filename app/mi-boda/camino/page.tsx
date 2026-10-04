import type { Metadata } from "next";
import { Camino, type Agrupar } from "../_acciones/camino";
import {
  listarAcciones,
  listarDependencias,
  listarMetas,
  listarMiembros,
  obtenerBoda,
} from "../_acciones/acciones-servidor";
import { Vistas } from "../_acciones/vistas";

export const metadata: Metadata = { title: "El camino" };

export default async function CaminoPage({
  searchParams,
}: {
  searchParams: Promise<{ por?: string }>;
}) {
  const [acciones, miembros, dependencias, boda, metas, { por }] = await Promise.all([
    listarAcciones(),
    listarMiembros(),
    listarDependencias(),
    obtenerBoda(),
    listarMetas(),
    searchParams,
  ]);
  // Por meta salvo que se pida otra cosa (docs/metas.md §4).
  const agrupar: Agrupar = por === "momento" ? "momento" : "meta";

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-10">
      <Vistas />
      <div className="mt-8">
        <Camino
          acciones={acciones}
          miembros={miembros}
          dependencias={dependencias}
          fechaBoda={boda?.fecha ?? null}
          metas={metas.map((m) => ({ id: m.id, titulo: m.titulo }))}
          agrupar={agrupar}
        />
      </div>
    </main>
  );
}
