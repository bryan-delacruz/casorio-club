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
import type { Accion } from "@/db/schema";
import { alternarHecha, moverAccion, type Momento } from "./acciones-servidor";
import { NuevaAccion, type Miembro } from "./nueva-accion-reexport";
import { TarjetaAccion } from "./tarjeta-accion";

const CARRILES: { id: Momento; titulo: string; pie: string }[] = [
  { id: "antes", titulo: "Antes", pie: "todo lo que hay que tener listo" },
  { id: "el_dia", titulo: "El día", pie: "lo que pasa el mismo día" },
  { id: "despues", titulo: "Después", pie: "lo que queda pendiente al volver" },
];

function Carril({
  id,
  children,
  className = "",
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`${className} rounded-lg transition-colors ${
        isOver ? "bg-accent/60" : ""
      }`}
    >
      {children}
    </div>
  );
}

export function Mapa({
  iniciales,
  miembros,
}: {
  iniciales: Accion[];
  miembros: Miembro[];
}) {
  const [, iniciar] = useTransition();
  const [arrastrando, setArrastrando] = useState<Accion | null>(null);

  // Optimista: la tarjeta se mueve en cuanto la sueltas, sin esperar al servidor.
  const [lista, aplicar] = useOptimistic(
    iniciales,
    (actual: Accion[], cambio: { id: string; momento?: Momento; hecha?: boolean }) =>
      actual.map((a) => (a.id === cambio.id ? { ...a, ...cambio } : a)),
  );

  const porMomento = (m: Momento) => lista.filter((a) => a.momento === m);
  const ideas = porMomento("idea");
  const porId = new Map(miembros.map((m) => [m.id, m]));

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  function alSoltar(e: DragEndEvent) {
    setArrastrando(null);
    const id = String(e.active.id);
    const destino = e.over?.id as Momento | undefined;
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

  function alAlternar(id: string, hecha: boolean) {
    iniciar(async () => {
      aplicar({ id, hecha });
      try {
        await alternarHecha(id, hecha);
      } catch {
        toast.error("No se pudo actualizar.");
      }
    });
  }

  return (
    <DndContext
      sensors={sensores}
      onDragStart={(e: DragStartEvent) =>
        setArrastrando(lista.find((a) => a.id === e.active.id) ?? null)
      }
      onDragEnd={alSoltar}
      onDragCancel={() => setArrastrando(null)}
    >
      {/* Bandeja de ideas: lo que todavía no sabes dónde va. */}
      <Carril id="idea" className="border-border border border-dashed p-4">
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
                onAlternar={alAlternar}
              />
            ))}
          </div>
        </SortableContext>
        <div className="mt-2">
          <NuevaAccion momento="idea" miembros={miembros} etiqueta="ideas sueltas" />
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
            <Carril key={c.id} id={c.id} className="bg-muted/40 p-4">
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
                      onAlternar={alAlternar}
                    />
                  ))}
                </div>
              </SortableContext>

              <div className="mt-2">
                <NuevaAccion
                  momento={c.id}
                  miembros={miembros}
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
