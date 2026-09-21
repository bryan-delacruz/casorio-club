"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { Accion, Dependencia } from "@/db/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FechaBoda } from "./fecha-boda";
import { soles, type Miembro } from "./tipos";

/**
 * Dónde cae una acción cuando nadie lo ha dicho.
 *
 * Contado en semanas desde la boda: positivo antes, cero el mismo día,
 * negativo después. Así el diagrama tiene algo que dibujar desde el primer
 * día, y la barra sale punteada para no hacer pasar la suposición por dato.
 */
const POR_DEFECTO: Record<string, number> = {
  antes: 8,
  el_dia: 0,
  despues: -2,
};

const inicioDe = (a: Accion) => a.inicioSemanas ?? POR_DEFECTO[a.momento] ?? 0;
const duracionDe = (a: Accion) => Math.max(1, a.duracionSemanas);
/** El final, también contado hacia atrás: empezar en 12 y durar 4 acaba en 8. */
const finDe = (a: Accion) => inicioDe(a) - duracionDe(a) + 1;

function fechaDeSemana(boda: string | null, semanas: number) {
  if (!boda) return null;
  const [a, m, d] = boda.split("-").map(Number);
  const dia = new Date(a, m - 1, d);
  dia.setDate(dia.getDate() - semanas * 7);
  return dia.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

export function Camino({
  acciones,
  miembros,
  dependencias,
  fechaBoda,
}: {
  acciones: Accion[];
  miembros: Miembro[];
  dependencias: Dependencia[];
  fechaBoda: string | null;
}) {
  const enCalendario = acciones.filter((a) => a.momento !== "idea");
  const sueltas = acciones.filter((a) => a.momento === "idea");

  const porId = new Map(acciones.map((a) => [a.id, a]));
  const gente = new Map(miembros.map((m) => [m.id, m]));

  const requiereDe = new Map<string, string[]>();
  for (const d of dependencias) {
    requiereDe.set(d.accionId, [...(requiereDe.get(d.accionId) ?? []), d.requiereId]);
  }

  if (enCalendario.length === 0) {
    return (
      <div className="border-border rounded-lg border border-dashed p-10 text-center">
        <p className="text-muted-foreground">
          Todavía no hay nada con fecha.{" "}
          <Link href="/mi-boda" className="text-foreground underline">
            Manda algo a un carril
          </Link>{" "}
          y aparecerá aquí.
        </p>
      </div>
    );
  }

  // El eje va de lo más lejano antes de la boda a lo más tardío después.
  const primera = Math.max(...enCalendario.map(inicioDe));
  const ultima = Math.min(...enCalendario.map(finDe), 0);
  const columnas = primera - ultima + 1;
  const columnaDe = (semanas: number) => primera - semanas + 1;

  const filas = [...enCalendario].sort((a, b) => inicioDe(b) - inicioDe(a));

  // Marcas del eje: cada cuatro semanas, más la boda.
  const marcas: number[] = [];
  for (let s = primera; s >= ultima; s -= 4) marcas.push(s);
  if (!marcas.includes(0) && 0 <= primera && 0 >= ultima) marcas.push(0);
  marcas.sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">El camino</h2>
          <p className="text-muted-foreground text-sm">
            {fechaBoda
              ? "Cada barra es cuándo toca ocuparse de esa cosa."
              : "Pon la fecha y las semanas se vuelven días del calendario."}
          </p>
        </div>
        <FechaBoda fecha={fechaBoda} />
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="min-w-140">
          {/* Eje */}
          <div
            className="border-border text-muted-foreground grid items-end gap-x-px border-b pb-1.5 text-xs"
            style={{
              gridTemplateColumns: `9.5rem repeat(${columnas}, minmax(0.75rem, 1fr))`,
            }}
          >
            <span className="bg-background sticky left-0 z-10" />
            {marcas.map((semanas) => (
              <span
                key={semanas}
                // Colocada a mano en su semana: dejar que el grid las fuera
                // acomodando solas las apilaba todas a la izquierda.
                style={{ gridColumn: `${columnaDe(semanas) + 1} / span 4` }}
                className={`whitespace-nowrap ${
                  semanas === 0 ? "text-foreground" : ""
                }`}
              >
                {semanas === 0
                  ? "la boda"
                  : semanas > 0
                    ? `${semanas} sem`
                    : `+${-semanas}`}
                {fechaDeSemana(fechaBoda, semanas) && (
                  <span className="text-muted-foreground/70">
                    {" "}
                    · {fechaDeSemana(fechaBoda, semanas)}
                  </span>
                )}
              </span>
            ))}
          </div>

          {/* Filas */}
          <div className="mt-1.5 space-y-1">
            {filas.map((a) => {
              const inicio = columnaDe(inicioDe(a));
              const span = Math.min(duracionDe(a), columnas - inicio + 1);
              const supuesta = a.inicioSemanas === null;
              const quien = a.responsableId ? gente.get(a.responsableId) : undefined;
              const necesita = (requiereDe.get(a.id) ?? [])
                .map((id) => porId.get(id))
                .filter((x): x is Accion => Boolean(x));

              // Un requisito que termina después de que esto empieza es un
              // choque: no puedes empezar algo que espera a otra cosa.
              const choques = necesita.filter(
                (r) => r.momento !== "idea" && finDe(r) < inicioDe(a),
              );

              return (
                <div
                  key={a.id}
                  className="grid items-center gap-x-px"
                  style={{
                    gridTemplateColumns: `9.5rem repeat(${columnas}, minmax(0.75rem, 1fr))`,
                  }}
                >
                  <div className="bg-background sticky left-0 z-10 min-w-0 pr-3">
                    <p
                      className={`truncate text-sm ${
                        a.hecha ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      {a.titulo}
                    </p>
                    {necesita.length > 0 && (
                      <p
                        className={`truncate text-xs ${
                          choques.length > 0
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {choques.length > 0 && (
                          <TriangleAlert className="mr-1 inline size-3" />
                        )}
                        ↳ {necesita.map((r) => r.titulo).join(", ")}
                      </p>
                    )}
                  </div>

                  <div
                    style={{ gridColumn: `${inicio + 1} / span ${span}` }}
                    title={`${a.titulo} · ${duracionDe(a)} ${duracionDe(a) === 1 ? "semana" : "semanas"}`}
                    className={`flex h-7 min-w-0 items-center gap-1.5 rounded px-2 ${
                      a.hecha
                        ? "bg-secondary text-muted-foreground"
                        : supuesta
                          ? "border-primary/40 text-primary border border-dashed"
                          : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {quien && (
                      <Avatar className="size-4 shrink-0">
                        {quien.imagen && <AvatarImage src={quien.imagen} alt="" />}
                        <AvatarFallback className="text-[0.5rem]">
                          {quien.nombre.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    {a.monto && (
                      <span className="truncate text-xs tabular-nums">
                        {soles(Number(a.monto))}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        Las barras punteadas son una suposición por el carril donde está la
        acción. Ponle semanas desde{" "}
        <Link href="/mi-boda" className="underline">
          el mapa
        </Link>{" "}
        para fijarlas.
      </p>

      {sueltas.length > 0 && (
        <div className="border-border rounded-lg border border-dashed p-4">
          <h3 className="font-display text-base">Todavía sin sitio</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {sueltas.map((a) => a.titulo).join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}
