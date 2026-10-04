"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NuevaAccion } from "./formulario-accion";
import type { MetaLite, Miembro } from "./tipos";

/**
 * En el celular, anotar es lo que más se hace y no debería pedir bajar hasta
 * Ideas sueltas: queda al alcance del pulgar, justo encima de la barra.
 * Lo nuevo cae en ideas, como el "Añadir" de ese carril.
 */
export function BotonAnotar({ miembros, metas }: { miembros: Miembro[]; metas: MetaLite[] }) {
  return (
    <>
      {/* Reserva su alto al final de la página: así lo último no queda debajo. */}
      <div aria-hidden className="h-16 sm:hidden" />
      <div className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 sm:hidden">
      <NuevaAccion
        momento="idea"
        miembros={miembros}
        metas={metas}
        etiqueta="ideas sueltas"
        disparador={
          <Button size="lg" className="h-12 rounded-full pr-5 pl-4 shadow-lg shadow-black/15">
            <Plus className="size-5" aria-hidden /> Anotar
          </Button>
        }
        />
      </div>
    </>
  );
}
