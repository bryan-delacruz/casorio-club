"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Clock, Coins, MoreHorizontal, Trash2 } from "lucide-react";
import type { Accion } from "@/db/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Momento } from "./acciones-servidor";

export type Miembro = { id: string; nombre: string; imagen: string | null };

export const DESTINOS: { id: Momento; nombre: string }[] = [
  { id: "antes", nombre: "Antes" },
  { id: "el_dia", nombre: "El día" },
  { id: "despues", nombre: "Después" },
  { id: "idea", nombre: "Ideas sueltas" },
];

const dinero = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 0,
});

/**
 * Una acción.
 *
 * Arrastrar NO es el camino principal: la tarjeta entera agarra, pero
 * también hay un menú con los destinos escritos. Quien no pueda arrastrar
 * —teclado, lector de pantalla, un dedo en el bus— tiene que poder mover
 * una tarjeta igual, y en el móvil elegir por nombre suele ser más rápido.
 */
export function TarjetaAccion({
  accion,
  miembro,
  onAlternar,
  onMover,
  onBorrar,
  arrastrable = true,
}: {
  accion: Accion;
  miembro?: Miembro;
  onAlternar?: (id: string, hecha: boolean) => void;
  onMover?: (id: string, momento: Momento) => void;
  onBorrar?: (id: string) => void;
  arrastrable?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: accion.id, disabled: !arrastrable });

  const monto = accion.monto ? Number(accion.monto) : null;
  const otros = DESTINOS.filter((d) => d.id !== accion.momento);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // La tarjeta entera es el asa, no una esquina.
      {...(arrastrable ? { ...attributes, ...listeners } : {})}
      className={`group bg-card border-border rounded-md border p-3 ${
        arrastrable ? "cursor-grab touch-none active:cursor-grabbing" : ""
      } ${isDragging ? "opacity-40" : ""} ${accion.hecha ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          // Sin esto, tocar el círculo empezaría un arrastre en vez de marcar.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onAlternar?.(accion.id, !accion.hecha)}
          aria-label={accion.hecha ? "Marcar como pendiente" : "Marcar como hecha"}
          className={`mt-0.5 grid size-4 shrink-0 cursor-pointer place-items-center rounded-full border ${
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

        {arrastrable && (onMover || onBorrar) && (
          <DropdownMenu>
            <DropdownMenuTrigger
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Opciones"
              className="text-muted-foreground/50 hover:text-foreground focus-visible:text-foreground -mt-0.5 -mr-1 cursor-pointer rounded p-0.5"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Mover a</DropdownMenuLabel>
              {otros.map((d) => (
                <DropdownMenuItem
                  key={d.id}
                  onSelect={() => onMover?.(accion.id, d.id)}
                >
                  {d.nombre}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => onBorrar?.(accion.id)}
              >
                <Trash2 /> Borrar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {(accion.cuestaTiempo || monto !== null || miembro) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-6">
          {accion.cuestaTiempo && (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Clock className="size-3.5" /> tiempo
            </span>
          )}
          {monto !== null && (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Coins className="size-3.5" /> {dinero.format(monto)}
            </span>
          )}
          {miembro && (
            <span className="text-muted-foreground ml-auto flex min-w-0 items-center gap-1.5 text-xs">
              <Avatar className="size-4">
                {miembro.imagen && <AvatarImage src={miembro.imagen} alt="" />}
                <AvatarFallback className="text-[0.5rem]">
                  {miembro.nombre.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate capitalize">
                {miembro.nombre.split(" ")[0]}
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
