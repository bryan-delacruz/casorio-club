"use client";

import { useState } from "react";
import { ArrowDownUp, MoreHorizontal, Pencil, Trash2, Wallet } from "lucide-react";
import type { Accion, Dependencia, Pago } from "@/db/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Estado } from "./acciones-servidor";
import { EditarAccion } from "./formulario-accion";
import { OrdenAccion } from "./orden-accion";
import { PagosAccion } from "./pagos-accion";
import { ESTADOS, ORDEN, type Carril, type Destino, type MetaLite, type Miembro } from "./tipos";

/**
 * El menú ⋯ de una acción, con sus tres diálogos
 * (docs/dependencias.md §9.1).
 *
 * Uno solo para las dos pantallas: la tarjeta del Mapa y la fila del Camino
 * ofrecen lo mismo, y dos copias se habrían desincronizado en el primer
 * cambio. La única diferencia es "Mover a", que solo existe donde hay
 * carriles: en el Camino el carril es la meta y la meta se cambia en Cambiar.
 *
 * Los diálogos se montan **fuera** del menú: dentro se desmontarían al
 * cerrarse el menú. Se montan solo mientras están abiertos para que los
 * campos partan del valor guardado cada vez.
 */
export function MenuAccion({
  accion,
  miembros = [],
  pagos = [],
  otras = [],
  metas = [],
  dependencias = [],
  destinos = [],
  destinoActual,
  onAlternar,
  onMover,
  onBorrar,
  pagosAbiertos,
  onPagosAbiertosChange,
  className = "",
}: {
  accion: Accion;
  miembros?: Miembro[];
  pagos?: Pago[];
  /** Todas las de la boda, la propia incluida: el orden la filtra dentro. */
  otras?: Accion[];
  metas?: MetaLite[];
  dependencias?: Dependencia[];
  /** Los carriles del Mapa. Vacío en el Camino: allí no hay "Mover a". */
  destinos?: Carril[];
  destinoActual?: Destino;
  onAlternar?: (id: string, estado: Estado) => void;
  onMover?: (id: string, destino: Destino) => void;
  onBorrar?: (id: string) => void;
  /**
   * Los pagos, controlados desde fuera. La tarjeta del Mapa tiene un atajo
   * propio —el chip de la plata— que abre este mismo diálogo, y montarlo dos
   * veces daría dos formularios sobre los mismos pagos. Sin estas dos props,
   * el menú lo lleva por su cuenta, que es lo que hace el Camino.
   */
  pagosAbiertos?: boolean;
  onPagosAbiertosChange?: (v: boolean) => void;
  className?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [pagosPropios, setPagosPropios] = useState(false);
  const [viendoOrden, setViendoOrden] = useState(false);
  const viendoPagos = pagosAbiertos ?? pagosPropios;
  const setViendoPagos = onPagosAbiertosChange ?? setPagosPropios;
  const otros = destinos.filter((d) => d.id !== destinoActual);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          // Sin esto, abrir el menú empezaría un arrastre.
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Opciones de ${accion.titulo}`}
          className={`text-muted-foreground/60 hover:text-foreground focus-visible:text-foreground focus-visible:ring-ring cursor-pointer rounded outline-none focus-visible:ring-2 ${className}`}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditando(true)}>
            <Pencil /> Cambiar
          </DropdownMenuItem>
          {/* Siempre: es la única puerta para empezar a pagar algo cuyo total
              todavía no se sabe (docs/pagos.md §3.4). */}
          <DropdownMenuItem onSelect={() => setViendoPagos(true)}>
            <Wallet /> Pagos
          </DropdownMenuItem>
          {/* El orden se arma aquí y no al fondo del formulario: se revisa
              mucho después de anotar (docs/dependencias.md §1). */}
          <DropdownMenuItem onSelect={() => setViendoOrden(true)}>
            <ArrowDownUp /> {ORDEN.menu}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Estado</DropdownMenuLabel>
          {ESTADOS.filter((e) => e.id !== accion.estado).map((e) => (
            <DropdownMenuItem key={e.id} onSelect={() => onAlternar?.(accion.id, e.id)}>
              {e.nombre}
            </DropdownMenuItem>
          ))}
          {otros.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Mover a</DropdownMenuLabel>
            </>
          )}
          {otros.map((d) => (
            <DropdownMenuItem key={d.id} onSelect={() => onMover?.(accion.id, d.id)}>
              {d.nombre}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => onBorrar?.(accion.id)}>
            <Trash2 /> Borrar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {editando && (
        <EditarAccion
          accion={accion}
          miembros={miembros}
          metas={metas}
          abierto={editando}
          onAbiertoChange={setEditando}
        />
      )}
      {viendoPagos && (
        <PagosAccion
          accion={accion}
          pagos={pagos}
          miembros={miembros}
          abierto={viendoPagos}
          onAbiertoChange={setViendoPagos}
        />
      )}
      {viendoOrden && (
        <OrdenAccion
          accion={accion}
          otras={otras}
          metas={metas}
          dependencias={dependencias}
          abierto={viendoOrden}
          onAbiertoChange={setViendoOrden}
        />
      )}
    </>
  );
}
