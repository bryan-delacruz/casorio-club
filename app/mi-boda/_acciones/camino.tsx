"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { Flag, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type { Accion, Dependencia } from "@/db/schema";
import { AvatarPersona } from "@/components/avatar-persona";
import { Button } from "@/components/ui/button";
import {
  cadenaPrincipal,
  duracionDe,
  finDe,
  inicioDe,
  listasParaEmpezar,
  ordenPorDependencia,
  REGISTRO_CIVIL,
  resumenMeta,
} from "@/lib/metas";
import { empezarRegistroCivil, type Momento } from "./acciones-servidor";
import { CompartirHistoria } from "./compartir-historia";
import { FechaBoda } from "./fecha-boda";
import { soles, type MetaLite, type Miembro } from "./tipos";

export type Agrupar = "meta" | "momento";

const MOMENTOS: { id: Momento; titulo: string }[] = [
  { id: "antes", titulo: "Antes" },
  { id: "el_dia", titulo: "El día" },
  { id: "despues", titulo: "Después" },
];

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

type Grupo = { clave: string; titulo: string; meta: boolean; acciones: Accion[] };

export function Camino({
  acciones,
  miembros,
  dependencias,
  fechaBoda,
  metas,
  agrupar,
}: {
  acciones: Accion[];
  miembros: Miembro[];
  dependencias: Dependencia[];
  fechaBoda: string | null;
  metas: MetaLite[];
  agrupar: Agrupar;
}) {
  const enCalendario = acciones.filter((a) => a.momento !== "idea");
  const sueltas = acciones.filter((a) => a.momento === "idea");
  const porId = new Map(acciones.map((a) => [a.id, a]));
  const gente = new Map(miembros.map((m) => [m.id, m]));
  const listas = listasParaEmpezar(acciones, dependencias);
  const tieneRegistro = metas.some((m) => m.titulo === REGISTRO_CIVIL.titulo);

  const requiereDe = new Map<string, string[]>();
  for (const d of dependencias) {
    requiereDe.set(d.accionId, [...(requiereDe.get(d.accionId) ?? []), d.requiereId]);
  }

  const cabecera = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-display text-xl">El camino</h2>
        <p className="text-muted-foreground text-sm">
          {fechaBoda
            ? "Cada barra es cuándo toca ocuparse de esa cosa."
            : "Pon la fecha y las semanas se vuelven días del calendario."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!tieneRegistro && <EmpezarRegistroCivil />}
        <CompartirHistoria />
        <FechaBoda fecha={fechaBoda} />
      </div>
    </div>
  );

  if (enCalendario.length === 0) {
    return (
      <div className="space-y-6">
        {cabecera}
        <div className="border-border rounded-lg border border-dashed p-10 text-center">
          <p className="text-muted-foreground">
            Todavía no hay nada con fecha.{" "}
            <Link href="/mi-boda" className="text-foreground underline">
              Manda algo a un carril
            </Link>{" "}
            {tieneRegistro ? "y aparecerá aquí." : "o empieza con la meta Registro civil."}
          </p>
        </div>
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
  const columnaHoy = hoy !== null && hoy <= primera && hoy >= ultima ? columnaDe(hoy) : null;

  // En el celular el nombre va en su propia línea encima de la barra y la
  // meta entera cabe a lo ancho (columna de nombres en 0 y semanas sin mínimo);
  // desde `sm` vuelve la columna de nombres a la izquierda. Las variables las
  // define el contenedor de abajo.
  const rejilla = {
    gridTemplateColumns: `var(--col-nombre) repeat(${columnas}, minmax(var(--col-semana), 1fr))`,
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
        style={{ gridColumn: i + 2, gridRow: "var(--fila-barra)" }}
        className={`h-full ${
          esBoda
            ? "border-primary/70 border-l-2"
            : esHoy
              ? "border-foreground/30 border-l border-dashed"
              : "border-border/60 border-l"
        }`}
      />
    );
  });

  // Grupos: por meta (en su orden, y "Sin meta" al final) o por momento.
  const grupos: Grupo[] =
    agrupar === "meta"
      ? [
          ...metas.map((m) => ({
            clave: m.id,
            titulo: m.titulo,
            meta: true,
            acciones: ordenPorDependencia(
              enCalendario.filter((a) => a.metaId === m.id),
              dependencias,
            ),
          })),
          {
            clave: "sin-meta",
            titulo: "Sin meta",
            meta: false,
            acciones: ordenPorDependencia(
              enCalendario.filter((a) => !a.metaId || !metas.some((m) => m.id === a.metaId)),
              dependencias,
            ),
          },
        ]
      : MOMENTOS.map((g) => ({
          clave: g.id,
          titulo: g.titulo,
          meta: false,
          acciones: enCalendario
            .filter((a) => a.momento === g.id)
            .sort((a, b) => inicioDe(b) - inicioDe(a)),
        }));

  return (
    <div className="space-y-6">
      {cabecera}

      <nav aria-label="Agrupar el camino" className="border-border inline-flex rounded-md border p-0.5 text-sm">
        {(["meta", "momento"] as const).map((op) => (
          <Link
            key={op}
            href={`/mi-boda/camino?por=${op}`}
            aria-current={agrupar === op ? "page" : undefined}
            className={`rounded-sm px-3 py-1 ${
              agrupar === op ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Por {op}
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto pb-2 [--col-nombre:0px] [--col-semana:0px] [--fila-barra:2] [--nombre:1/-1] sm:[--col-nombre:11rem] sm:[--col-semana:2.25rem] sm:[--fila-barra:1] sm:[--nombre:1]">
        <div style={{ minWidth: `calc(var(--col-nombre) + ${columnas} * var(--col-semana))` }}>
          {/* Eje */}
          <div className="border-border text-muted-foreground grid items-end border-b pb-1.5 text-xs" style={rejilla}>
            <span className="bg-background sticky left-0 z-20" />
            {[...marcas]
              .sort((a, b) => b - a)
              .map((semanas) => (
                <span
                  key={semanas}
                  // Colocada a mano en su semana: dejar que el grid las fuera
                  // acomodando solas las apilaba todas a la izquierda.
                  style={{ gridColumn: `${columnaDe(semanas) + 1} / span 4` }}
                  className={`pl-1 whitespace-nowrap ${semanas === 0 ? "text-primary font-medium" : ""}`}
                >
                  {semanas === 0 ? "la boda" : semanas > 0 ? `${semanas} sem` : `+${-semanas}`}
                  {diaDeSemana(fechaBoda, semanas) && (
                    <span className="text-muted-foreground/70 max-sm:hidden"> · {diaDeSemana(fechaBoda, semanas)}</span>
                  )}
                </span>
              ))}
          </div>

          {grupos.map((g) =>
            g.acciones.length === 0 ? null : (
              <Seccion
                key={g.clave}
                grupo={g}
                dependencias={dependencias}
                requiereDe={requiereDe}
                porId={porId}
                gente={gente}
                listas={listas}
                rejilla={rejilla}
                lineas={lineas}
                columnas={columnas}
                columnaDe={columnaDe}
              />
            ),
          )}
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
          <span className="ring-primary h-3 w-5 rounded-sm ring-2" /> Cadena principal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-foreground/70 size-2.5 rotate-45" /> Hito
        </span>
        <span className="flex items-center gap-1.5">
          <Sparkles className="text-primary size-3.5" /> Lista para empezar
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
          <p className="text-muted-foreground mt-1 text-sm">{sueltas.map((a) => a.titulo).join(" · ")}</p>
        </div>
      )}
    </div>
  );
}

type Flecha = { d: string; cadena: boolean; choque: boolean };

/**
 * Un grupo del camino. En modo meta abre con la barra resumen (rango y
 * avance) y dibuja flechas de dependencia entre sus barras. Las flechas se
 * miden sobre el DOM real: la rejilla se estira con la pantalla, así que
 * calcular posiciones a mano se desalinearía.
 */
function Seccion({
  grupo,
  dependencias,
  requiereDe,
  porId,
  gente,
  listas,
  rejilla,
  lineas,
  columnas,
  columnaDe,
}: {
  grupo: Grupo;
  dependencias: Dependencia[];
  requiereDe: Map<string, string[]>;
  porId: Map<string, Accion>;
  gente: Map<string, Miembro>;
  listas: Set<string>;
  rejilla: React.CSSProperties;
  lineas: React.ReactNode;
  columnas: number;
  columnaDe: (semanas: number) => number;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [flechas, setFlechas] = useState<Flecha[]>([]);
  const ids = new Set(grupo.acciones.map((a) => a.id));
  const cadena = grupo.meta ? cadenaPrincipal(grupo.acciones, dependencias) : new Set<string>();
  const resumen = grupo.meta ? resumenMeta(grupo.acciones) : null;
  // Solo las dependencias dentro del grupo se dibujan; las demás quedan en texto.
  const pares = grupo.meta
    ? dependencias.filter((d) => ids.has(d.accionId) && ids.has(d.requiereId))
    : [];
  // Claves estables para el efecto: `pares` y `grupo.acciones` son arrays
  // nuevos en cada render y, como dependencia, medirían y re-renderizarían en bucle.
  const clavePares = pares.map((p) => `${p.requiereId}>${p.accionId}`).join(",");
  const claveBarras = grupo.acciones
    .map((a) => `${a.id}:${a.inicioSemanas}:${a.duracionSemanas}:${a.esHito}:${a.estado}`)
    .join("|");

  useLayoutEffect(() => {
    const raiz = contenedor.current;
    if (!raiz || pares.length === 0) {
      setFlechas([]);
      return;
    }
    function medir() {
      const base = raiz!.getBoundingClientRect();
      const caja = (id: string) => raiz!.querySelector<HTMLElement>(`[data-barra="${id}"]`)?.getBoundingClientRect();
      const nuevas: Flecha[] = [];
      for (const p of pares) {
        const desde = caja(p.requiereId);
        const hasta = caja(p.accionId);
        if (!desde || !hasta) continue;
        const x1 = desde.right - base.left;
        const y1 = desde.top + desde.height / 2 - base.top;
        const x2 = hasta.left - base.left;
        const y2 = hasta.top + hasta.height / 2 - base.top;
        // Codo: sale a la derecha del requisito, baja y entra por la izquierda.
        const codo = Math.max(x1 + 6, Math.min(x2 - 6, x1 + 14));
        nuevas.push({
          d: `M ${x1} ${y1} H ${codo} V ${y2} H ${x2 - 2}`,
          cadena: cadena.has(p.requiereId) && cadena.has(p.accionId),
          choque: x2 < x1 - 1,
        });
      }
      setFlechas(nuevas);
    }
    medir();
    // El observador avisa también durante la hidratación; se mide en el
    // siguiente frame y solo mientras la sección sigue montada.
    let vivo = true;
    let frame = 0;
    const observador = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (vivo) medir();
      });
    });
    observador.observe(raiz);
    return () => {
      vivo = false;
      cancelAnimationFrame(frame);
      observador.disconnect();
    };
    // clavePares y claveBarras resumen `pares`, `cadena` y la geometría.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clavePares, claveBarras]);

  const hechas = resumen?.hechas ?? 0;
  const avance = resumen && resumen.total ? hechas / resumen.total : 0;

  return (
    <section className="mt-5">
      <div ref={contenedor} className="relative space-y-2.5 sm:space-y-1">
        {resumen && resumen.inicio !== null && resumen.fin !== null ? (
          // Barra resumen de la meta: su rango completo y cuánto va hecho.
          <div className="grid items-center gap-y-1" style={rejilla}>
            {lineas}
            <div style={{ gridColumn: "var(--nombre)", gridRow: 1 }} className="sm:bg-background sticky left-0 z-20 flex min-w-0 items-center gap-1.5 pr-3">
              <Flag className="text-primary size-3.5 shrink-0" aria-hidden />
              <h3 className="font-display truncate text-base">{grupo.titulo}</h3>
            </div>
            <div
              style={{
                gridColumn: `${columnaDe(resumen.inicio) + 1} / span ${Math.min(resumen.inicio - resumen.fin + 1, columnas)}`,
                gridRow: "var(--fila-barra)",
              }}
              className="bg-primary/10 ring-primary/30 relative z-10 flex h-6 items-center overflow-hidden rounded ring-1"
              title={`${grupo.titulo}: ${hechas} de ${resumen.total} hechas`}
            >
              <span aria-hidden className="bg-primary/25 absolute inset-y-0 left-0" style={{ width: `${avance * 100}%` }} />
              <span className="relative px-2 text-xs whitespace-nowrap">
                {hechas} de {resumen.total} hechas
                {resumen.monto > 0 && <span className="text-muted-foreground"> · {soles(resumen.monto)}</span>}
              </span>
            </div>
          </div>
        ) : (
          <h3 className="bg-background text-muted-foreground sticky left-0 z-20 mb-1.5 w-fit text-xs">{grupo.titulo}</h3>
        )}

        {grupo.acciones.map((a) => {
          const inicio = columnaDe(inicioDe(a));
          const span = Math.min(duracionDe(a), columnas - inicio + 1);
          const supuesta = a.inicioSemanas === null;
          const hecha = a.estado === "hecho";
          const haciendo = a.estado === "haciendo";
          const enCadena = cadena.has(a.id);
          const quien = a.responsableId ? gente.get(a.responsableId) : undefined;

          const necesita = (requiereDe.get(a.id) ?? [])
            .map((id) => porId.get(id))
            .filter((x): x is Accion => Boolean(x));
          // Las de otro grupo no tienen flecha: se nombran en texto.
          const fuera = necesita.filter((r) => !ids.has(r.id) || !grupo.meta);
          // Un requisito que termina después de que esto empieza es un choque.
          const choques = necesita.filter((r) => r.momento !== "idea" && r.estado !== "hecho" && finDe(r) < inicioDe(a));

          return (
            <div key={a.id} className="grid items-center gap-y-0.5" style={rejilla}>
              {lineas}

              {/* En el celular el fondo cubre solo el texto: las flechas pasan
                  por detrás de las palabras sin cortarse en toda la fila. */}
              <div style={{ gridColumn: "var(--nombre)", gridRow: 1 }} className="sm:bg-background sticky left-0 z-20 min-w-0 pr-3">
                <p className={`max-sm:bg-background truncate text-sm max-sm:w-fit max-sm:max-w-full ${hecha ? "text-muted-foreground line-through" : ""}`}>
                  {listas.has(a.id) && (
                    <Sparkles className="text-primary mr-1 inline size-3.5" aria-label="Lista para empezar" />
                  )}
                  {a.titulo}
                  {/* En el celular la barra es corta: el monto viaja con el nombre. */}
                  {a.monto && <span className="text-muted-foreground sm:hidden"> · {soles(Number(a.monto))}</span>}
                </p>
                {(fuera.length > 0 || choques.length > 0) && (
                  <p
                    className={`max-sm:bg-background truncate text-xs max-sm:w-fit max-sm:max-w-full ${choques.length > 0 ? "text-destructive" : "text-muted-foreground"}`}
                    title={necesita.map((r) => r.titulo).join(", ")}
                  >
                    {choques.length > 0 && <TriangleAlert className="mr-1 inline size-3" />}
                    ↳ {(choques.length > 0 ? choques : fuera).map((r) => r.titulo).join(", ")}
                  </p>
                )}
              </div>

              {a.esHito ? (
                // Hito: un día, no un periodo.
                <div
                  data-barra={a.id}
                  style={{ gridColumn: `${inicio + 1} / span 1`, gridRow: "var(--fila-barra)" }}
                  className="z-10 flex h-5 items-center justify-center sm:h-7"
                  title={`${a.titulo} (hito)`}
                >
                  <span
                    className={`size-3 rotate-45 sm:size-3.5 rounded-[2px] ${
                      hecha ? "bg-primary/40" : "bg-foreground/80"
                    } ${enCadena ? "ring-primary ring-2 ring-offset-1 ring-offset-background" : ""}`}
                  />
                </div>
              ) : (
                <div
                  data-barra={a.id}
                  style={{ gridColumn: `${inicio + 1} / span ${span}`, gridRow: "var(--fila-barra)" }}
                  title={`${a.titulo} · ${duracionDe(a)} ${duracionDe(a) === 1 ? "semana" : "semanas"}${
                    supuesta ? " (supuesto)" : ""
                  }`}
                  className={`z-10 flex h-5 min-w-0 items-center gap-1.5 rounded px-1 sm:h-7 sm:px-2 ${
                    supuesta
                      ? "border-muted-foreground/40 text-muted-foreground border border-dashed"
                      : hecha
                        ? "bg-primary/15 text-muted-foreground"
                        : haciendo
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground"
                  } ${enCadena ? "ring-primary ring-2" : ""}`}
                >
                  {/* En una barra corta no cabe todo: el nombre ya está a la
                      izquierda, así que se cae primero el monto y luego el título. */}
                  {quien && (
                    <AvatarPersona persona={quien} className="size-4" />
                  )}
                  {span >= 3 && <span className="truncate text-xs max-sm:hidden">{a.titulo}</span>}
                  {a.monto && span >= 2 && (
                    <span className="ml-auto shrink-0 text-xs tabular-nums max-sm:hidden">{soles(Number(a.monto))}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {flechas.length > 0 && (
          <svg aria-hidden className="pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-visible">
            <defs>
              <marker id={`punta-${grupo.clave}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>
            {flechas.map((f, i) => (
              <path
                key={i}
                d={f.d}
                fill="none"
                markerEnd={`url(#punta-${grupo.clave})`}
                className={f.choque ? "stroke-destructive" : f.cadena ? "stroke-primary" : "stroke-muted-foreground/50"}
                strokeWidth={f.cadena ? 1.75 : 1}
              />
            ))}
          </svg>
        )}
      </div>
    </section>
  );
}

/** La plantilla "Registro civil" (docs/metas.md §3). */
function EmpezarRegistroCivil() {
  const [enviando, iniciar] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={enviando}
      onClick={() =>
        iniciar(async () => {
          try {
            const r = await empezarRegistroCivil();
            if (r.error) toast.error(r.error);
            else toast.success("Meta Registro civil creada con sus pasos.");
          } catch {
            toast.error("No se pudo crear. Intenta otra vez.");
          }
        })
      }
    >
      <Flag className="size-4" />
      {enviando ? "Creando…" : "Empezar con Registro civil"}
    </Button>
  );
}
