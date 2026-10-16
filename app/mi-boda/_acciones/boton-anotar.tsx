"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NuevaAccion } from "./formulario-accion";
import { NOMBRE_IDEAS, type MetaLite, type Miembro } from "./tipos";

/**
 * En el celular, anotar es lo que más se hace y no debería pedir bajar hasta
 * Ideas sueltas: queda al alcance del pulgar, justo encima de la barra.
 * Lo nuevo cae en ideas, como el "Añadir" de ese carril.
 *
 * Va centrado y no en la esquina derecha: ahí tapaba el ⋯ de las tarjetas,
 * que en el celular es la única entrada a "Mover a". En el centro solo puede
 * quedar debajo el chip del monto, que también está en ese mismo menú.
 */
export function BotonAnotar({ miembros, metas }: { miembros: Miembro[]; metas: MetaLite[] }) {
  return (
    <>
      {/* Reserva su alto al final de la página: así lo último no queda debajo. */}
      <div aria-hidden className="h-16 sm:hidden" />
      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2 sm:hidden">
        <NuevaAccion
          miembros={miembros}
          metas={metas}
          etiqueta={NOMBRE_IDEAS}
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
