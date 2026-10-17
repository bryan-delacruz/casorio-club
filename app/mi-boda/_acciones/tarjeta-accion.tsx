"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Check, Clock, Coins, Diamond } from "lucide-react";
import type { Estado } from "./acciones-servidor";
import type { Accion, Dependencia, Pago } from "@/db/schema";
import { AvatarPersona } from "@/components/avatar-persona";
import { cuentaDe, etiquetaDeDinero } from "@/lib/pagos";
import { MenuAccion } from "./menu-accion";
import {
  ESTADOS,
  REQUIERE,
  siguienteEstado,
  type Carril,
  type Destino,
  type MetaLite,
  type Miembro,
} from "./tipos";

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
  otras = [],
  metas = [],
  dependencias = [],
  requiere,
  titulos,
  destinos = [],
  destinoActual,
  onAlternar,
  onMover,
  onBorrar,
  arrastrable = true,
}: {
  accion: Accion;
  miembro?: Miembro;
  miembros?: Miembro[];
  pagos?: Pago[];
  otras?: Accion[];
  metas?: MetaLite[];
  /** Todas las de la boda: el diálogo del orden necesita el grafo entero. */
  dependencias?: Dependencia[];
  requiere?: Set<string>;
  titulos?: Map<string, string>;
  /** Los carriles y las ideas sueltas: a dónde se puede mandar esta tarjeta. */
  destinos?: Carril[];
  /** Dónde está ahora, para no ofrecerse a sí misma. */
  destinoActual?: Destino;
  onAlternar?: (id: string, estado: Estado) => void;
  onMover?: (id: string, destino: Destino) => void;
  onBorrar?: (id: string) => void;
  arrastrable?: boolean;
}) {
  // Draggable y no sortable: dentro de un carril no se reordena a mano, las
  // tarjetas van por semana (docs/metas.md §7).
  // `attributes` se descarta a propósito: trae role="button", tabIndex y un
  // aria-roledescription que prometen arrastrar con el teclado, y aquí no hay
  // KeyboardSensor. El camino sin ratón es el menú ⋯, que sí funciona.
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: accion.id,
    disabled: !arrastrable,
  });

  const [viendoPagos, setViendoPagos] = useState(false);
  const hecha = accion.estado === "hecho";
  const haciendo = accion.estado === "haciendo";
  const { pagado, falta, sinTotal } = cuentaDe(accion.monto, pagos);
  // Cuesta plata si tiene monto o tiene pagos: el pago es la prueba aunque
  // todavía no se sepa el total (docs/pagos.md §3.4). El texto decide
  // también si se dibuja la 💰: null es "no hay nada que decir".
  const dinero = etiquetaDeDinero(accion, pagos);
  const conMenu = arrastrable && Boolean(onMover || onBorrar);
  const meta = accion.metaId ? metas.find((m) => m.id === accion.metaId) : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      // La tarjeta entera es el asa, no una esquina.
      {...(arrastrable ? listeners : {})}
      className={`group bg-card border-border rounded-md border p-3 ${
        arrastrable ? "cursor-grab touch-none active:cursor-grabbing" : ""
      } ${isDragging ? "opacity-40" : ""} ${hecha ? "opacity-60" : ""} ${
        haciendo ? "border-primary/50" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          // Sin esto, tocar el círculo empezaría un arrastre en vez de marcar.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onAlternar?.(accion.id, siguienteEstado(accion.estado))}
          // El círculo avanza: por hacer, haciendo, hecho, y vuelta a empezar.
          // El menú tiene los tres estados escritos para saltar directo.
          aria-label={`${ESTADOS.find((e) => e.id === accion.estado)?.nombre}. Pasar a ${
            ESTADOS.find((e) => e.id === siguienteEstado(accion.estado))?.nombre
          }`}
          className={`focus-visible:ring-ring mt-0.5 grid size-4 shrink-0 cursor-pointer place-items-center rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
            hecha
              ? "border-primary bg-primary text-primary-foreground"
              : haciendo
                ? "border-primary"
                : "border-muted-foreground/45"
          }`}
        >
          {hecha && <Check className="size-3" strokeWidth={3} />}
          {haciendo && <span className="bg-primary size-1.5 rounded-full" />}
        </button>

        <p
          className={`min-w-0 flex-1 text-[0.9375rem] leading-5 ${
            hecha ? "text-muted-foreground line-through" : "text-foreground"
          }`}
        >
          {accion.titulo}
        </p>

        {conMenu && (
          <MenuAccion
            accion={accion}
            miembros={miembros}
            pagos={pagos}
            otras={otras}
            metas={metas}
            dependencias={dependencias}
            destinos={destinos}
            destinoActual={destinoActual}
            onAlternar={onAlternar}
            onMover={onMover}
            onBorrar={onBorrar}
            pagosAbiertos={viendoPagos}
            onPagosAbiertosChange={setViendoPagos}
            className="-mt-0.5 -mr-1 p-0.5"
          />
        )}
      </div>

      {(accion.cuestaTiempo || dinero || miembro || meta || accion.esHito) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-6">
          {meta && (
            <span className="bg-secondary text-secondary-foreground max-w-full truncate rounded-full px-2 py-0.5 text-xs">
              {meta.titulo}
            </span>
          )}
          {accion.esHito && (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Diamond className="size-3.5" /> día clave
            </span>
          )}
          {accion.cuestaTiempo && (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Clock className="size-3.5" /> tiempo
            </span>
          )}
          {dinero && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => conMenu && setViendoPagos(true)}
              disabled={!conMenu}
              className={`focus-visible:ring-ring flex items-center gap-1 rounded-sm text-xs outline-none focus-visible:ring-2 ${
                conMenu ? "cursor-pointer" : ""
              } ${
                // Resaltado solo cuando la cuenta está cerrada contra un
                // total: sin total, "hasta ahora" no es nada cerrado.
                !sinTotal && pagado > 0 && falta === 0
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Coins className="size-3.5" />
              {dinero}
            </button>
          )}
          {miembro && (
            <span className="text-muted-foreground ml-auto flex min-w-0 items-center gap-1.5 text-xs">
              <AvatarPersona persona={miembro} className="size-5" />
              <span className="truncate capitalize">
                {miembro.nombre.split(" ")[0]}
              </span>
            </span>
          )}
        </div>
      )}

      {requiere && requiere.size > 0 && titulos && (
        <p className="text-muted-foreground mt-2 pl-6 text-xs">
          {REQUIERE}{" "}
          {[...requiere]
            .map((id) => titulos.get(id))
            .filter(Boolean)
            .join(", ")}
        </p>
      )}

    </div>
  );
}
