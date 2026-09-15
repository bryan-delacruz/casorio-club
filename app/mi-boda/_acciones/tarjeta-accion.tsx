"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Clock, Coins, GripVertical } from "lucide-react";
import type { Accion } from "@/db/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type Miembro = { id: string; nombre: string; imagen: string | null };

const dinero = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 0,
});

/**
 * Una acción. Lo que exige se lee de un vistazo por sus marcas: reloj si
 * cuesta tiempo, moneda si cuesta plata, las dos si ambas. Esa lectura
 * inmediata es la gracia del tablero.
 */
export function TarjetaAccion({
  accion,
  miembro,
  onAlternar,
  arrastrable = true,
}: {
  accion: Accion;
  miembro?: Miembro;
  onAlternar?: (id: string, hecha: boolean) => void;
  arrastrable?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: accion.id, disabled: !arrastrable });

  const monto = accion.monto ? Number(accion.monto) : null;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`bg-card border-border rounded-md border p-3 ${
        isDragging ? "opacity-40" : ""
      } ${accion.hecha ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onAlternar?.(accion.id, !accion.hecha)}
          aria-label={accion.hecha ? "Marcar como pendiente" : "Marcar como hecha"}
          className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${
            accion.hecha
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/45"
          }`}
        >
          {accion.hecha && <Check className="size-3" strokeWidth={3} />}
        </button>

        <p
          className={`min-w-0 flex-1 text-[0.9375rem] leading-5 ${
            accion.hecha ? "text-muted-foreground line-through" : "text-foreground"
          }`}
        >
          {accion.titulo}
        </p>

        {arrastrable && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Mover"
            className="text-muted-foreground/50 hover:text-muted-foreground -mr-1 cursor-grab touch-none active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        )}
      </div>

      {(accion.cuestaTiempo || monto !== null || miembro) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-6">
          {accion.cuestaTiempo && (
            <span
              className="text-muted-foreground flex items-center gap-1 text-xs"
              title="Cuesta tiempo"
            >
              <Clock className="size-3.5" /> tiempo
            </span>
          )}
          {monto !== null && (
            <span
              className="text-muted-foreground flex items-center gap-1 text-xs"
              title="Cuesta dinero"
            >
              <Coins className="size-3.5" /> {dinero.format(monto)}
            </span>
          )}
          {miembro && (
            <span className="text-muted-foreground ml-auto flex items-center gap-1.5 text-xs">
              <Avatar className="size-4">
                {miembro.imagen && <AvatarImage src={miembro.imagen} alt="" />}
                <AvatarFallback className="text-[0.5rem]">
                  {miembro.nombre.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {miembro.nombre.split(" ")[0]}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
