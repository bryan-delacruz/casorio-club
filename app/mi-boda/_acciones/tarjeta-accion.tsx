"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Clock, Coins, MoreHorizontal, Pencil, Trash2, Wallet } from "lucide-react";
import type { Accion, Pago } from "@/db/schema";
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
import { EditarAccion } from "./formulario-accion";
import { PagosAccion } from "./pagos-accion";
import { cuentaDe, DESTINOS, soles, type Miembro } from "./tipos";

export type { Miembro } from "./tipos";

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
  miembros = [],
  pagos = [],
  onAlternar,
  onMover,
  onBorrar,
  arrastrable = true,
}: {
  accion: Accion;
  miembro?: Miembro;
  miembros?: Miembro[];
  pagos?: Pago[];
  onAlternar?: (id: string, hecha: boolean) => void;
  onMover?: (id: string, momento: Momento) => void;
  onBorrar?: (id: string) => void;
  arrastrable?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: accion.id, disabled: !arrastrable });
  const [editando, setEditando] = useState(false);
  const [viendoPagos, setViendoPagos] = useState(false);

  const { total, pagado, falta } = cuentaDe(accion.monto, pagos);
  const conMonto = accion.monto !== null;
  const otros = DESTINOS.filter((d) => d.id !== accion.momento);
  const conMenu = arrastrable && (onMover || onBorrar);

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

        {conMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Opciones"
              className="text-muted-foreground/50 hover:text-foreground focus-visible:text-foreground -mt-0.5 -mr-1 cursor-pointer rounded p-0.5"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditando(true)}>
                <Pencil /> Cambiar
              </DropdownMenuItem>
              {conMonto && (
                <DropdownMenuItem onSelect={() => setViendoPagos(true)}>
                  <Wallet /> Pagos
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
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

      {(accion.cuestaTiempo || conMonto || miembro) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-6">
          {accion.cuestaTiempo && (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Clock className="size-3.5" /> tiempo
            </span>
          )}
          {conMonto && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => conMenu && setViendoPagos(true)}
              disabled={!conMenu}
              className={`flex items-center gap-1 text-xs ${
                conMenu ? "cursor-pointer" : ""
              } ${
                pagado > 0 && falta === 0
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Coins className="size-3.5" />
              {pagado === 0
                ? soles(total)
                : falta === 0
                  ? `${soles(total)} pagado`
                  : `faltan ${soles(falta)} de ${soles(total)}`}
            </button>
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

      {/* Fuera del menú: dentro se desmontaría al cerrarse el menú. Se monta
          solo mientras está abierto para que los campos partan del valor
          guardado cada vez. */}
      {conMenu && editando && (
        <EditarAccion
          accion={accion}
          miembros={miembros}
          abierto={editando}
          onAbiertoChange={setEditando}
        />
      )}
      {conMenu && viendoPagos && (
        <PagosAccion
          accion={accion}
          pagos={pagos}
          miembros={miembros}
          abierto={viendoPagos}
          onAbiertoChange={setViendoPagos}
        />
      )}
    </div>
  );
}
