"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { Accion, Dependencia } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { candidatas, type GrupoCandidatas, type Lado } from "@/lib/dependencias";
import { guardarDependenciasDe } from "./acciones-servidor";
import {
  DIALOGO,
  etiquetaSemana,
  NOMBRE_SIN_META,
  ORDEN,
  PIE,
  type MetaLite,
} from "./tipos";

/** Cuándo aparece el buscador: cuando la lista ya no se abarca de un vistazo. */
const PARA_BUSCAR = 6;

/**
 * El orden de una acción: qué va antes y qué va después
 * (docs/dependencias.md §4).
 *
 * Va controlado desde fuera porque lo abre un menú, y un diálogo dentro de un
 * menú se desmonta cuando el menú se cierra.
 *
 * Las dos listas se guardan **juntas**, en una sola escritura: media edición
 * guardada y la otra media rechazada por círculo era el defecto del
 * formulario, que avisaba "lo demás quedó guardado" (§6).
 */
export function OrdenAccion({
  accion,
  otras,
  metas,
  dependencias,
  abierto,
  onAbiertoChange,
}: {
  accion: Accion;
  /** Todas las acciones de la boda, la propia incluida: se filtra dentro. */
  otras: Accion[];
  /** Ya en el orden derivado de `ordenarMetas` (docs/metas.md §11.3). */
  metas: MetaLite[];
  dependencias: Dependencia[];
  abierto: boolean;
  onAbiertoChange: (v: boolean) => void;
}) {
  const [antes, setAntes] = useState(
    () => new Set(dependencias.filter((d) => d.accionId === accion.id).map((d) => d.requiereId)),
  );
  const [despues, setDespues] = useState(
    () => new Set(dependencias.filter((d) => d.requiereId === accion.id).map((d) => d.accionId)),
  );
  const [enviando, iniciar] = useTransition();

  // Las prohibidas se calculan sobre lo GUARDADO, no sobre lo que se lleva
  // marcado: recalcular a cada clic iría deshabilitando filas bajo el dedo, y
  // el servidor rechaza el conjunto entero de todos modos (§6).
  const grupos = useMemo(
    () => ({
      antes: candidatas(accion.id, otras, dependencias, metas, "antes", NOMBRE_SIN_META),
      despues: candidatas(accion.id, otras, dependencias, metas, "despues", NOMBRE_SIN_META),
    }),
    [accion.id, otras, dependencias, metas],
  );

  const hayAlgoQueElegir = grupos.antes.length > 0;

  function guardar() {
    iniciar(async () => {
      try {
        const { error } = await guardarDependenciasDe(accion.id, [...antes], [...despues]);
        if (error) {
          toast.error(error);
          return;
        }
        onAbiertoChange(false);
        toast.success("Guardado.");
      } catch {
        // La acción devuelve `{ error }`, pero la sesión puede haber caducado
        // con el diálogo abierto y eso sí lanza. Sin esto, el rechazo tumba
        // la pantalla en vez de avisar, y el diálogo se queda abierto con lo
        // marcado para reintentar.
        toast.error("No se pudo guardar. Intenta otra vez.");
      }
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className={DIALOGO}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-normal">{ORDEN.titulo}</DialogTitle>
          <DialogDescription>{ORDEN.descripcion}</DialogDescription>
        </DialogHeader>

        <p className="text-muted-foreground truncate text-sm" title={accion.titulo}>
          {accion.titulo}
        </p>

        {hayAlgoQueElegir ? (
          <>
            <Lista
              etiqueta={ORDEN.antes}
              motivo={ORDEN.vedadaAntes}
              grupos={grupos.antes}
              marcadas={antes}
              setMarcadas={setAntes}
              lado="antes"
            />
            <Lista
              etiqueta={ORDEN.despues}
              motivo={ORDEN.vedadaDespues}
              grupos={grupos.despues}
              marcadas={despues}
              setMarcadas={setDespues}
              lado="despues"
            />
            <DialogFooter className={PIE}>
              <Button type="button" onClick={guardar} disabled={enviando}>
                {enviando ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <p className="text-muted-foreground py-2 text-sm">{ORDEN.nadaQueElegir}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Una de las dos listas. Las dos tienen la misma forma a propósito: son la
 * misma pregunta en dos sentidos, y dos diseños distintos harían pensar que
 * son dos cosas distintas.
 */
function Lista({
  etiqueta,
  motivo,
  grupos,
  marcadas,
  setMarcadas,
  lado,
}: {
  etiqueta: string;
  motivo: string;
  grupos: GrupoCandidatas<Accion>[];
  marcadas: Set<string>;
  setMarcadas: (f: (antes: Set<string>) => Set<string>) => void;
  lado: Lado;
}) {
  const [filtro, setFiltro] = useState("");
  const cuantas = grupos.reduce((s, g) => s + g.candidatas.length, 0);

  const busca = filtro.trim().toLocaleLowerCase("es");
  const vistos = busca
    ? grupos
        .map((g) => ({
          ...g,
          candidatas: g.candidatas.filter((c) =>
            c.accion.titulo.toLocaleLowerCase("es").includes(busca),
          ),
        }))
        .filter((g) => g.candidatas.length > 0)
    : grupos;

  // Con la forma de función y no `new Set(marcadas)`: marcar varias seguidas
  // leía el conjunto de antes y solo se quedaba la última.
  function alternar(id: string) {
    setMarcadas((antes) => {
      const copia = new Set(antes);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);
      return copia;
    });
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label>{etiqueta}</Label>
        {marcadas.size > 0 && (
          <button
            type="button"
            onClick={() => setMarcadas(() => new Set())}
            className="text-muted-foreground hover:text-foreground cursor-pointer text-xs"
          >
            Quitar {marcadas.size}
          </button>
        )}
      </div>

      {cuantas > PARA_BUSCAR && (
        <Input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder={ORDEN.buscar}
          className="h-8"
        />
      )}

      {/* relative: el Checkbox de Radix deja un <input> oculto absolute junto a
          la casilla. Sin un contenedor posicionado, ese input se ubica respecto
          del diálogo, escapa de esta lista con scroll y estira el diálogo. */}
      <div className="border-border relative max-h-40 overflow-y-auto rounded-md border">
        {vistos.length === 0 ? (
          <p className="text-muted-foreground px-3 py-2 text-sm">{ORDEN.sinResultados}</p>
        ) : (
          vistos.map((g) => (
            <div key={g.clave}>
              {/* La cabecera lleva el nombre de la meta una vez, para que no se
                  repita en cada fila. Pegajosa: con 24 acciones se pierde de
                  vista a quién pertenece lo que se está marcando. */}
              <p className="bg-muted/60 text-muted-foreground sticky top-0 z-10 truncate px-3 py-1 text-xs">
                {g.titulo}
              </p>
              {g.candidatas.map(({ accion: o, prohibida }) => (
                <label
                  key={o.id}
                  title={prohibida ? `${o.titulo} — ${motivo}` : o.titulo}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm ${
                    prohibida ? "opacity-50" : "hover:bg-muted/50 cursor-pointer"
                  }`}
                >
                  <Checkbox
                    checked={marcadas.has(o.id)}
                    disabled={prohibida}
                    onCheckedChange={() => alternar(o.id)}
                    aria-describedby={prohibida ? `${lado}-${o.id}-motivo` : undefined}
                  />
                  <span className="min-w-0 flex-1 truncate">{o.titulo}</span>
                  {prohibida ? (
                    <span
                      id={`${lado}-${o.id}-motivo`}
                      className="text-muted-foreground shrink-0 text-xs"
                    >
                      {motivo}
                    </span>
                  ) : (
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {etiquetaSemana(o.inicioSemanas)}
                    </span>
                  )}
                </label>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
