import type { Metadata } from "next";
import { Camino, type Agrupar } from "../_acciones/camino";
import {
  listarAcciones,
  listarDependencias,
  listarMetas,
  listarMiembros,
  obtenerBoda,
} from "../_acciones/datos";
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
  // Por meta si la boda tiene metas; sin metas, todo caería en un solo grupo
  // "Sin meta", así que por momento (docs/metas.md §4). La URL manda si lo dice.
  const agrupar: Agrupar =
    por === "momento" || por === "meta" ? por : metas.length > 0 ? "meta" : "momento";

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-10">
      <div className="mb-8 max-sm:hidden">
        <Vistas />
      </div>
      <div>
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
