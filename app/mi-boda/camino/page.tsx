import type { Metadata } from "next";
import { Camino } from "../_acciones/camino";
import {
  listarAcciones,
  listarDependencias,
  listarMetas,
  listarMiembros,
  obtenerBoda,
} from "../_acciones/datos";
import { Vistas } from "../_acciones/vistas";
import { BotonAnotar } from "../_acciones/boton-anotar";

export const metadata: Metadata = { title: "El camino" };

export default async function CaminoPage() {
  // Una sola agrupación, por meta (docs/metas.md §5): no hay selector ni
  // `?por=`. Un enlace viejo con `?por=hito` simplemente se ignora.
  const [acciones, miembros, dependencias, boda, metas] = await Promise.all([
    listarAcciones(),
    listarMiembros(),
    listarDependencias(),
    obtenerBoda(),
    listarMetas(),
  ]);

  const metasLite = metas.map((m) => ({ id: m.id, titulo: m.titulo }));
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
          metas={metasLite}
        />
      </div>
      <BotonAnotar miembros={miembros} metas={metasLite} />
    </main>
  );
}
