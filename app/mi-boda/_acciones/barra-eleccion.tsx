"use client";

import { ChevronLeft, ChevronRight, Link2, Unlink, X } from "lucide-react";
import type { Accion } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { ELEGIDO, etiquetaSemana } from "./tipos";

/** Lo que la barra está pidiendo en cada momento (docs/dependencias.md §10.2). */
export type Modo = "elegido" | "unir" | "desunir";

/**
 * La barra de abajo: manipular el Camino con el dedo.
 *
 * Arrastrar no sirve en el celular —a 375 px una columna de semana mide
 * 16.75 px— y el menú ⋯ es un formulario disfrazado: no enseña el gráfico
 * mientras decides. Aquí se toca un bloque, queda elegido y resaltado, y las
 * acciones viven en botones de 44 px que mueven el gráfico a la vista.
 *
 * Unir y desunir piden el **segundo** toque sobre una fila entera, que mide
 * el ancho de la pantalla: lo contrario de apuntar a una barra de 16 px.
 *
 * Existe también en escritorio, y no solo por debajo de `sm`: es la única vía
 * para unir con algo de **otra meta**, porque el asa solo alcanza lo que tiene
 * flecha dibujada, y las flechas no cruzan grupos.
 */
export function BarraEleccion({
  accion,
  modo,
  puedeDesunir,
  onSemana,
  onModo,
  onCerrar,
}: {
  accion: Accion;
  modo: Modo;
  /** Hay al menos una unión directa que soltar. */
  puedeDesunir: boolean;
  onSemana: (semanas: number) => void;
  onModo: (modo: Modo) => void;
  onCerrar: () => void;
}) {
  const pidiendo = modo !== "elegido";

  return (
    // Por encima del z-40 de la barra de secciones y del botón Anotar: mientras
    // algo está elegido, esto manda. En el celular se apoya justo encima de la
    // barra de secciones; desde `sm` flota centrada abajo.
    // `data-eligiendo` no es decoración: el botón Anotar del celular flota a
    // 5rem del borde y asomaba 8 px por debajo de esta barra. Se aparta
    // mirando este atributo (ver `boton-anotar.tsx`).
    <div
      data-eligiendo
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 px-3 sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:-translate-x-1/2 sm:px-0"
    >
      <div
        role="region"
        aria-label={`Elegido: ${accion.titulo}`}
        className="bg-popover border-border mx-auto max-w-xl rounded-lg border p-2 shadow-lg"
      >
        {pidiendo ? (
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 px-1 text-sm">
              {modo === "unir" ? ELEGIDO.pidiendoUnir : ELEGIDO.pidiendoDesunir}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={() => onModo("elegido")}>
              {ELEGIDO.cancelar}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2 px-1">
              <p className="min-w-0 flex-1 truncate text-sm" title={accion.titulo}>
                {accion.titulo}
              </p>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {etiquetaSemana(accion.inicioSemanas)}
              </span>
              {/* `area-toque` le da los 44 px sin estirar la fila. */}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={onCerrar}
                aria-label={ELEGIDO.cerrar}
                /* El botón mide 24 px, no los 16 que supone la utilidad. */
                className="text-muted-foreground hover:text-foreground area-toque -mr-1 shrink-0 [--toque-tamano:24px]"
              >
                <X />
              </Button>
            </div>

            <div className="mt-1.5 flex items-center gap-1.5">
              {/* 44 px de lado, que es lo que pide un pulgar. Mueven una
                  semana exacta, que arrastrando con el dedo no se acierta.
                  Son `<Button variant="outline">` con el tamaño subido: el
                  foco, el hover y el borde salen del primitivo, no de clases
                  escritas a mano aquí. */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => onSemana(1)}
                aria-label={ELEGIDO.antes}
                title={ELEGIDO.antes}
                className="size-11 shrink-0 [&_svg]:size-5"
              >
                <ChevronLeft />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => onSemana(-1)}
                aria-label={ELEGIDO.despues}
                title={ELEGIDO.despues}
                className="size-11 shrink-0 [&_svg]:size-5"
              >
                <ChevronRight />
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="h-11 flex-1"
                onClick={() => onModo("unir")}
              >
                <Link2 /> {ELEGIDO.unir}
              </Button>
              {puedeDesunir && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 flex-1"
                  onClick={() => onModo("desunir")}
                >
                  <Unlink /> {ELEGIDO.desunir}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
