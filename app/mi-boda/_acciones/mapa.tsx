"use client";

import { useOptimistic, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import { toast } from "sonner";
import type { Accion, Dependencia, Pago } from "@/db/schema";
import {
  borrarAccion,
  cambiarEstado,
  moverAccion,
  type Estado,
  type Momento,
} from "./acciones-servidor";
import { NuevaAccion } from "./formulario-accion";
import { Reparto } from "./reparto";
import { TarjetaAccion } from "./tarjeta-accion";
import type { MetaLite, Miembro } from "./tipos";

const CARRILES: { id: Momento; titulo: string; pie: string }[] = [
  { id: "antes", titulo: "Antes", pie: "todo lo que hay que tener listo" },
  { id: "el_dia", titulo: "El día", pie: "lo que pasa el mismo día" },
  { id: "despues", titulo: "Después", pie: "lo que queda pendiente al volver" },
];

/**
 * Un carril.
 *
 * Mientras hay algo levantado, TODOS los carriles se anuncian con un borde
 * punteado, no solo el que tienes debajo. Antes solo se iluminaba el de
 * encima, que es justo cuando ya no necesitas saberlo: la pregunta "¿dónde
 * puedo soltar esto?" se hace al levantar, no al llegar.
 */
function Carril({
  id,
  children,
  className = "",
  hayArrastre,
  esOrigen,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  hayArrastre: boolean;
  esOrigen: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const disponible = hayArrastre && !esOrigen;
  return (
    <div
      ref={setNodeRef}
      className={`${className} rounded-lg transition-colors ${
        disponible ? "ring-primary/30 ring-2 ring-offset-2 ring-offset-background" : ""
      } ${isOver ? "bg-accent" : ""} ${hayArrastre && esOrigen ? "opacity-50" : ""}`}
    >
      {children}
    </div>
  );
}

export function Mapa({
  iniciales,
  miembros,
  pagos,
  dependencias,
  metas = [],
}: {
  iniciales: Accion[];
  miembros: Miembro[];
  pagos: Pago[];
  dependencias: Dependencia[];
  metas?: MetaLite[];
}) {
  const [, iniciar] = useTransition();
  const [arrastrando, setArrastrando] = useState<Accion | null>(null);

  // Optimista: la tarjeta se mueve en cuanto la sueltas, sin esperar al servidor.
  const [lista, aplicar] = useOptimistic(
    iniciales,
    (actual: Accion[], cambio: { id: string; momento?: Momento; estado?: Estado }) =>
      actual.map((a) => (a.id === cambio.id ? { ...a, ...cambio } : a)),
  );

  const porMomento = (m: Momento) => lista.filter((a) => a.momento === m);
  const ideas = porMomento("idea");
  const porId = new Map(miembros.map((m) => [m.id, m]));
  const titulos = new Map(lista.map((a) => [a.id, a.titulo]));

  const requiereDe = new Map<string, Set<string>>();
  for (const d of dependencias) {
    const suyas = requiereDe.get(d.accionId) ?? new Set<string>();
    suyas.add(d.requiereId);
    requiereDe.set(d.accionId, suyas);
  }

  const pagosDe = new Map<string, Pago[]>();
  for (const p of pagos) {
    const lote = pagosDe.get(p.accionId) ?? [];
    lote.push(p);
    pagosDe.set(p.accionId, lote);
  }

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const CARRIL_IDS = new Set<string>(["idea", "antes", "el_dia", "despues"]);

  function alSoltar(e: DragEndEvent) {
    setArrastrando(null);
    if (!e.over) return;
    const id = String(e.active.id);
    const sobre = String(e.over.id);

    /**
     * Cada tarjeta también es zona soltable, así que al soltar encima de una
     * tarjeta `over.id` es su UUID, no el carril. Y ese es el caso normal:
     * sueltas sobre un carril que ya tiene cosas. Hay que resolver a qué
     * carril pertenece lo que hay debajo.
     */
    const destino = (
      CARRIL_IDS.has(sobre) ? sobre : lista.find((a) => a.id === sobre)?.momento
    ) as Momento | undefined;
    if (!destino) return;

    const actual = lista.find((a) => a.id === id);
    if (!actual || actual.momento === destino) return;

    iniciar(async () => {
      aplicar({ id, momento: destino });
      try {
        await moverAccion(id, destino);
      } catch {
        toast.error("No se pudo mover.");
      }
    });
  }

  function alMover(id: string, momento: Momento) {
    iniciar(async () => {
      aplicar({ id, momento });
      try {
        await moverAccion(id, momento);
      } catch {
        toast.error("No se pudo mover.");
      }
    });
  }

  function alBorrar(id: string) {
    iniciar(async () => {
      try {
        await borrarAccion(id);
        toast.success("Borrado.");
      } catch {
        toast.error("No se pudo borrar.");
      }
    });
  }

  function alAlternar(id: string, estado: Estado) {
    iniciar(async () => {
      aplicar({ id, estado });
      try {
        await cambiarEstado(id, estado);
      } catch {
        toast.error("No se pudo actualizar.");
      }
    });
  }

  return (
    <DndContext
      // Id fijo: sin esto dnd-kit genera uno distinto en servidor y cliente
      // (aria-describedby) y React avisa de desajuste de hidratación.
      id="mapa-acciones"
      sensors={sensores}
      onDragStart={(e: DragStartEvent) =>
        setArrastrando(lista.find((a) => a.id === e.active.id) ?? null)
      }
      onDragEnd={alSoltar}
      onDragCancel={() => setArrastrando(null)}
    >
      <Reparto lista={lista} miembros={miembros} pagos={pagos} />

      {/* Bandeja de ideas: lo que todavía no sabes dónde va. */}
      <Carril
        id="idea"
        className="border-border border border-dashed p-4"
        hayArrastre={arrastrando !== null}
        esOrigen={arrastrando?.momento === "idea"}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg">Ideas sueltas</h2>
          <p className="text-muted-foreground text-sm">
            Anótalas aquí y arrástralas cuando sepas cuándo van.
          </p>
        </div>
        <SortableContext items={ideas.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ideas.map((a) => (
              <TarjetaAccion
                key={a.id}
                accion={a}
                miembro={a.responsableId ? porId.get(a.responsableId) : undefined}
                miembros={miembros}
                pagos={pagosDe.get(a.id)}
                otras={lista.filter((o) => o.id !== a.id)}
                metas={metas}
                requiere={requiereDe.get(a.id)}
                titulos={titulos}
                onAlternar={alAlternar}
                onMover={alMover}
                onBorrar={alBorrar}
              />
            ))}
          </div>
        </SortableContext>
        <div className="mt-2">
          <NuevaAccion momento="idea" miembros={miembros} metas={metas} etiqueta="ideas sueltas" />
        </div>
      </Carril>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {CARRILES.map((c) => {
          const items = porMomento(c.id);
          const conDinero = items.reduce(
            (s, a) => s + (a.monto ? Number(a.monto) : 0),
            0,
          );
          return (
            <Carril
              key={c.id}
              id={c.id}
              className="bg-muted/40 p-4"
              hayArrastre={arrastrando !== null}
              esOrigen={arrastrando?.momento === c.id}
            >
              <div>
                <h2 className="font-display text-lg">{c.titulo}</h2>
                <p className="text-muted-foreground text-sm">
                  {items.length === 0 ? c.pie : `${items.length} · S/ ${conDinero.toLocaleString("es-PE")}`}
                </p>
              </div>

              <SortableContext items={items.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                <div className="mt-4 space-y-2">
                  {items.map((a) => (
                    <TarjetaAccion
                      key={a.id}
                      accion={a}
                      miembro={a.responsableId ? porId.get(a.responsableId) : undefined}
                      miembros={miembros}
                      pagos={pagosDe.get(a.id)}
                      otras={lista.filter((o) => o.id !== a.id)}
                metas={metas}
                      requiere={requiereDe.get(a.id)}
                      titulos={titulos}
                      onAlternar={alAlternar}
                      onMover={alMover}
                      onBorrar={alBorrar}
                    />
                  ))}
                </div>
              </SortableContext>

              <div className="mt-2">
                <NuevaAccion
                  momento={c.id}
                  miembros={miembros}
                  metas={metas}
                  etiqueta={c.titulo.toLowerCase()}
                />
              </div>
            </Carril>
          );
        })}
      </div>

      <DragOverlay>
        {arrastrando && (
          <div className="rotate-1">
            <TarjetaAccion accion={arrastrando} arrastrable={false} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
