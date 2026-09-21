"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { Accion, Dependencia } from "@/db/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Momento } from "./acciones-servidor";
import { FechaBoda } from "./fecha-boda";
import { soles, type Miembro } from "./tipos";

/**
 * Dónde cae una acción cuando nadie lo ha dicho.
 *
 * Contado en semanas desde la boda: positivo antes, cero el mismo día,
 * negativo después. Así el diagrama tiene algo que dibujar desde el primer
 * día, y la barra sale punteada para no hacer pasar la suposición por dato.
 */
const POR_DEFECTO: Record<string, number> = { antes: 8, el_dia: 0, despues: -2 };

const GRUPOS: { id: Momento; titulo: string }[] = [
  { id: "antes", titulo: "Antes" },
  { id: "el_dia", titulo: "El día" },
  { id: "despues", titulo: "Después" },
];

const inicioDe = (a: Accion) => a.inicioSemanas ?? POR_DEFECTO[a.momento] ?? 0;
const duracionDe = (a: Accion) => Math.max(1, a.duracionSemanas);
/** El final, también contado hacia atrás: empezar en 12 y durar 4 acaba en 8. */
const finDe = (a: Accion) => inicioDe(a) - duracionDe(a) + 1;

function diaDeSemana(boda: string | null, semanas: number) {
  if (!boda) return null;
  const [a, m, d] = boda.split("-").map(Number);
  const dia = new Date(a, m - 1, d);
  dia.setDate(dia.getDate() - semanas * 7);
  return dia.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

/** A cuántas semanas de la boda estamos hoy. Null si no hay fecha. */
function semanasHastaLaBoda(boda: string | null) {
  if (!boda) return null;
  const [a, m, d] = boda.split("-").map(Number);
  const dias = (new Date(a, m - 1, d).getTime() - Date.now()) / 86_400_000;
  return Math.round(dias / 7);
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

  // El eje va de lo más lejano antes de la boda a lo más tardío después, con
  // un respiro a cada lado para que ninguna barra muera contra el borde.
  const primera = Math.max(...enCalendario.map(inicioDe)) + 1;
  const ultima = Math.min(...enCalendario.map(finDe), 0) - 1;
  const columnas = primera - ultima + 1;
  const columnaDe = (semanas: number) => primera - semanas + 1;

  const marcas = new Set<number>([0]);
  for (let s = 0; s <= primera; s += 4) marcas.add(s);
  for (let s = -4; s >= ultima; s -= 4) marcas.add(s);

  const hoy = semanasHastaLaBoda(fechaBoda);
  const columnaHoy =
    hoy !== null && hoy <= primera && hoy >= ultima ? columnaDe(hoy) : null;

  const rejilla = {
    gridTemplateColumns: `11rem repeat(${columnas}, minmax(2.25rem, 1fr))`,
  };

  /** Las líneas verticales de fondo, iguales en cada fila. */
  const lineas = Array.from({ length: columnas }, (_, i) => {
    const semanas = primera - i;
    const esBoda = semanas === 0;
    const esHoy = columnaHoy !== null && i + 1 === columnaHoy;
    if (!marcas.has(semanas) && !esHoy) return null;
    return (
      <div
        key={`linea-${i}`}
        aria-hidden
        style={{ gridColumn: i + 2, gridRow: 1 }}
        className={`h-full ${
          esBoda
            ? "border-primary/40 border-l"
            : esHoy
              ? "border-foreground/30 border-l border-dashed"
              : "border-border/60 border-l"
        }`}
      />
    );
  });

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
        <div style={{ minWidth: `${11 + columnas * 2.25}rem` }}>
          {/* Eje */}
          <div
            className="border-border text-muted-foreground grid items-end border-b pb-1.5 text-xs"
            style={rejilla}
          >
            <span className="bg-background sticky left-0 z-20" />
            {[...marcas]
              .sort((a, b) => b - a)
              .map((semanas) => (
                <span
                  key={semanas}
                  // Colocada a mano en su semana: dejar que el grid las fuera
                  // acomodando solas las apilaba todas a la izquierda.
                  style={{ gridColumn: `${columnaDe(semanas) + 1} / span 4` }}
                  className={`whitespace-nowrap pl-1 ${
                    semanas === 0 ? "text-foreground" : ""
                  }`}
                >
                  {semanas === 0
                    ? "la boda"
                    : semanas > 0
                      ? `${semanas} sem`
                      : `+${-semanas}`}
                  {diaDeSemana(fechaBoda, semanas) && (
                    <span className="text-muted-foreground/70">
                      {" "}
                      · {diaDeSemana(fechaBoda, semanas)}
                    </span>
                  )}
                </span>
              ))}
          </div>

          {GRUPOS.map((g) => {
            const suyas = enCalendario
              .filter((a) => a.momento === g.id)
              .sort((a, b) => inicioDe(b) - inicioDe(a));
            if (suyas.length === 0) return null;

            return (
              <section key={g.id} className="mt-4">
                <h3 className="bg-background text-muted-foreground sticky left-0 z-20 mb-1.5 w-fit text-xs tracking-wide uppercase">
                  {g.titulo}
                </h3>

                <div className="space-y-1">
                  {suyas.map((a) => {
                    const inicio = columnaDe(inicioDe(a));
                    const span = Math.min(duracionDe(a), columnas - inicio + 1);
                    const supuesta = a.inicioSemanas === null;
                    const hecha = a.estado === "hecho";
                    const haciendo = a.estado === "haciendo";
                    const quien = a.responsableId
                      ? gente.get(a.responsableId)
                      : undefined;

                    const necesita = (requiereDe.get(a.id) ?? [])
                      .map((id) => porId.get(id))
                      .filter((x): x is Accion => Boolean(x));

                    // Un requisito que termina después de que esto empieza es
                    // un choque: no puedes empezar algo que espera a otra cosa.
                    const choques = necesita.filter(
                      (r) =>
                        r.momento !== "idea" &&
                        r.estado !== "hecho" &&
                        finDe(r) < inicioDe(a),
                    );

                    return (
                      <div key={a.id} className="grid items-center" style={rejilla}>
                        {lineas}

                        <div
                          style={{ gridColumn: 1, gridRow: 1 }}
                          className="bg-background sticky left-0 z-20 min-w-0 pr-3"
                        >
                          <p
                            className={`truncate text-sm ${
                              hecha ? "text-muted-foreground line-through" : ""
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
                              title={necesita.map((r) => r.titulo).join(", ")}
                            >
                              {choques.length > 0 && (
                                <TriangleAlert className="mr-1 inline size-3" />
                              )}
                              ↳ {necesita.map((r) => r.titulo).join(", ")}
                            </p>
                          )}
                        </div>

                        <div
                          style={{
                            gridColumn: `${inicio + 1} / span ${span}`,
                            gridRow: 1,
                          }}
                          title={`${a.titulo} · ${duracionDe(a)} ${
                            duracionDe(a) === 1 ? "semana" : "semanas"
                          }${supuesta ? " (supuesto)" : ""}`}
                          className={`z-10 flex h-7 min-w-0 items-center gap-1.5 rounded px-2 ${
                            supuesta
                              ? "border-muted-foreground/40 text-muted-foreground border border-dashed"
                              : hecha
                                ? "bg-primary/15 text-muted-foreground"
                                : haciendo
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-foreground"
                          }`}
                        >
                          {/* En una barra de una o dos semanas no cabe todo.
                              El nombre completo está en la columna fija de la
                              izquierda, así que aquí se cae primero el monto y
                              luego el título. */}
                          {quien && (
                            <Avatar className="size-4 shrink-0">
                              {quien.imagen && (
                                <AvatarImage src={quien.imagen} alt="" />
                              )}
                              <AvatarFallback className="text-[0.5rem]">
                                {quien.nombre.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          {span >= 3 && (
                            <span className="truncate text-xs">{a.titulo}</span>
                          )}
                          {a.monto && span >= 2 && (
                            <span className="ml-auto shrink-0 text-xs tabular-nums">
                              {soles(Number(a.monto))}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="bg-secondary h-3 w-5 rounded-sm" /> Por hacer
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-primary h-3 w-5 rounded-sm" /> Haciendo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-primary/15 h-3 w-5 rounded-sm" /> Hecho
        </span>
        <span className="flex items-center gap-1.5">
          <span className="border-muted-foreground/40 h-3 w-5 rounded-sm border border-dashed" />
          Sin semanas puestas
        </span>
        {columnaHoy !== null && (
          <span className="flex items-center gap-1.5">
            <span className="border-foreground/30 h-3 border-l border-dashed" /> Hoy
          </span>
        )}
      </div>

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
