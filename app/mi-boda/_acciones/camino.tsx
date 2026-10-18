"use client";

import Link from "next/link";
import { useLayoutEffect, useOptimistic, useRef, useState, useTransition } from "react";
import {
  DndContext,
  MouseSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Flag, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type { Accion, Dependencia, Pago } from "@/db/schema";
import { AvatarPersona } from "@/components/avatar-persona";
import {
  cadenaPrincipal,
  duracionDe,
  enCamino,
  finDe,
  inicioDe,
  listasParaEmpezar,
  metasQueEspera,
  ordenPorDependencia,
  faltanMetasDelPlan,
  resumenMeta,
  semanasHastaLaBoda,
} from "@/lib/metas";
import { prohibidas, semanaAlArrastrar, unidasA } from "@/lib/dependencias";
import { cuentaDe, pagosPorAccion } from "@/lib/pagos";
import {
  agregarDependencia,
  borrarAccion,
  cambiarEstado,
  ponerEnSemana,
  quitarDependencia,
  type Estado,
} from "./acciones-servidor";
import { BarraEleccion, type Modo } from "./barra-eleccion";
import { MenuAccion } from "./menu-accion";
import { CompartirHistoria } from "./compartir-historia";
import { EmpezarPlan } from "./empezar-plan";
import { TiraProximoHito } from "./tira-hito";
import {
  INVITA_META,
  NOMBRE_SIN_META,
  REQUIERE,
  SIN_META,
  soles,
  TODO_LO_ANOTADO,
  type MetaLite,
  type Miembro,
} from "./tipos";
import { RUTAS } from "./rutas";

function diaDeSemana(boda: string | null, semanas: number) {
  if (!boda) return null;
  const [a, m, d] = boda.split("-").map(Number);
  const dia = new Date(a, m - 1, d);
  dia.setDate(dia.getDate() - semanas * 7);
  return dia.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

type EnCamino = Accion & { inicioSemanas: number };

/**
 * Un grupo del camino: una meta, o lo que no es de ninguna. La barra resumen
 * es solo de la meta: lo que no la tiene no es un entregable (§5).
 */
type Grupo = {
  clave: string;
  titulo: string;
  meta: boolean;
  acciones: EnCamino[];
  /** Una línea debajo del título, cuando hay algo que explicar. */
  nota?: string;
  /** Las metas que esta espera, derivadas de las dependencias (§11.3). */
  despuesDe: string[];
};

export function Camino({
  acciones: iniciales,
  miembros,
  dependencias: dependenciasGuardadas,
  fechaBoda,
  metas,
  pagos,
}: {
  acciones: Accion[];
  miembros: Miembro[];
  dependencias: Dependencia[];
  fechaBoda: string | null;
  metas: MetaLite[];
  pagos: Pago[];
}) {
  // El estado se pinta antes de que el servidor conteste: la barra cambia de
  // color al instante y no parece que el menú no hizo nada. Es el mismo
  // patrón del Mapa, y la revalidación trae después la verdad.
  const [acciones, aplicar] = useOptimistic(
    iniciales,
    (actual: Accion[], cambio: { id: string; estado?: Estado; inicioSemanas?: number }) =>
      actual.map((a) => (a.id === cambio.id ? { ...a, ...cambio } : a)),
  );
  // Las flechas también se pintan antes de que el servidor conteste: una
  // flecha que tarda media pantalla en aparecer no se siente conectada al
  // arrastre. Todo lo que se deriva de aquí —cadena principal, "lista para
  // empezar", el orden de las metas— son funciones puras sobre esta lista, así
  // que el optimismo vale para las tres cosas a la vez.
  const [dependencias, aplicarDep] = useOptimistic(
    dependenciasGuardadas,
    (actual: Dependencia[], c: { quita?: boolean; accionId: string; requiereId: string }) =>
      c.quita
        ? actual.filter((d) => !(d.accionId === c.accionId && d.requiereId === c.requiereId))
        : [...actual, { bodaId: "", accionId: c.accionId, requiereId: c.requiereId }],
  );
  const [, iniciar] = useTransition();

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

  /** Mover un bloque por la línea del tiempo (docs/dependencias.md §10). */
  function alMoverSemana(id: string, semanas: number) {
    const suya = acciones.find((a) => a.id === id);
    if (!suya || suya.inicioSemanas === null || semanas === suya.inicioSemanas) return;
    iniciar(async () => {
      aplicar({ id, inicioSemanas: semanas });
      const { error } = await ponerEnSemana(id, semanas);
      if (error) toast.error(error);
    });
  }

  /** Unir dos bloques: `quien` pasa a requerir a `requisito` (§10.1). */
  function alUnir(quien: string, requisito: string) {
    iniciar(async () => {
      aplicarDep({ accionId: quien, requiereId: requisito });
      const { error } = await agregarDependencia(quien, requisito);
      if (error) toast.error(error);
    });
  }

  function alDesunir(quien: string, requisito: string) {
    iniciar(async () => {
      aplicarDep({ quita: true, accionId: quien, requiereId: requisito });
      const { error } = await quitarDependencia(quien, requisito);
      if (error) toast.error(error);
    });
  }

  const enCalendario: EnCamino[] = enCamino(acciones);
  const sueltas = acciones.filter((a) => a.inicioSemanas === null);
  const porId = new Map(acciones.map((a) => [a.id, a]));
  const gente = new Map(miembros.map((m) => [m.id, m]));
  const listas = listasParaEmpezar(acciones, dependencias);
  // Los totales suman lo que va costando, no el monto (docs/pagos.md §4.3).
  const pagosDe = pagosPorAccion(pagos);
  // El botón se ofrece mientras falte alguna meta del plan (docs/plantillas.md §8).
  const faltaPlan = faltanMetasDelPlan(metas);

  const requiereDe = new Map<string, string[]>();
  for (const d of dependencias) {
    requiereDe.set(d.accionId, [...(requiereDe.get(d.accionId) ?? []), d.requiereId]);
  }

  // El ancho real de una columna de semana, leído de la rejilla: `--col-semana`
  // vale 36 px desde `sm` y 0 en el celular, donde las columnas se reparten el
  // ancho con `1fr`. Sin el valor real el arrastre encajaría en la semana
  // equivocada justo en la pantalla más pequeña.
  const eje = useRef<HTMLDivElement>(null);
  const [anchoSemana, setAnchoSemana] = useState(36);
  useLayoutEffect(() => {
    const el = eje.current;
    if (!el) return;
    const medir = () => {
      const pistas = getComputedStyle(el).gridTemplateColumns.split(" ");
      const ancho = parseFloat(pistas[1] ?? "");
      if (Number.isFinite(ancho) && ancho > 0) setAnchoSemana(ancho);
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  // Solo ratón, a propósito, y medido: a 375 px una columna de semana mide
  // 16.75 px, así que con el dedo no se puede apuntar a una semana. Peor aún,
  // un arrastre táctil obligaría a poner `touch-action: none` en la barra, y
  // entonces un deslizamiento que empiece encima de una barra no haría nada:
  // ni la movería ni desplazaría el Gantt. En táctil la vía es el menú ⋯ →
  // "Cuándo", que además mueve exactamente una semana.
  const sensores = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 4 } }));

  const [arrastre, setArrastre] = useState<{ tipo: string; id: string } | null>(null);

  /**
   * La vía táctil (docs/dependencias.md §10.2): se toca un bloque, queda
   * elegido, y la barra de abajo mueve semanas y pide el segundo toque para
   * unir o desunir. El segundo toque es sobre una **fila entera**, no sobre
   * una barra de 16 px.
   */
  const [eleccion, setEleccion] = useState<{ id: string; modo: Modo } | null>(null);
  // La acción elegida puede haberse borrado desde el menú: entonces no hay
  // barra, y el estado viejo no estorba.
  const elegida = eleccion ? acciones.find((a) => a.id === eleccion.id) : undefined;
  const unidas = elegida ? unidasA(elegida.id, dependencias) : new Set<string>();

  /** A qué filas se puede tocar ahora, según lo que la barra esté pidiendo. */
  const objetivos =
    elegida && eleccion?.modo === "unir"
      ? new Set(
          enCamino(acciones)
            .filter((a) => a.id !== elegida.id)
            .map((a) => a.id)
            .filter((id) => !prohibidas(elegida.id, dependencias, "despues").has(id)),
        )
      : elegida && eleccion?.modo === "desunir"
        ? unidas
        : new Set<string>();

  function alTocarObjetivo(id: string) {
    if (!elegida || !eleccion) return;
    if (eleccion.modo === "unir") alUnir(id, elegida.id);
    if (eleccion.modo === "desunir") {
      // Da igual en qué sentido apunte la flecha: se suelta la que haya.
      const suya = dependencias.find(
        (d) =>
          (d.accionId === elegida.id && d.requiereId === id) ||
          (d.accionId === id && d.requiereId === elegida.id),
      );
      if (suya) alDesunir(suya.accionId, suya.requiereId);
    }
    setEleccion({ id: elegida.id, modo: "elegido" });
  }

  // Mientras se tira una flecha, los bloques que harían círculo no se ofrecen
  // como destino. Soltar y ver aparecer la flecha para que desaparezca con un
  // aviso es peor que no poder soltarla: el servidor sigue siendo el que manda
  // (§6), esto solo evita el parpadeo.
  const vedadas =
    arrastre?.tipo === "unir"
      ? prohibidas(arrastre.id, dependencias, "despues")
      : new Set<string>();

  /**
   * El bloque solo va de lado y encaja en la semana: dejarlo libre haría creer
   * que se puede dejar entre dos semanas, y la semana es la unidad.
   * Unir no mueve nada, así que ahí el transform pasa tal cual.
   */
  const porSemanas: Modifier = ({ transform, active }) => {
    if (active?.data.current?.tipo !== "mover") return transform;
    return { ...transform, y: 0, x: Math.round(transform.x / anchoSemana) * anchoSemana };
  };

  const titulos = new Map(acciones.map((a) => [a.id, a.titulo]));

  function alSoltar({ active, over, delta }: DragEndEvent) {
    setArrastre(null);
    const datos = active.data.current as { tipo?: string; id?: string } | undefined;
    if (!datos?.id) return;
    if (datos.tipo === "mover") {
      const suya = acciones.find((a) => a.id === datos.id);
      if (!suya || suya.inicioSemanas === null) return;
      alMoverSemana(suya.id, semanaAlArrastrar(suya.inicioSemanas, delta.x, anchoSemana));
      return;
    }
    if (datos.tipo === "unir" && over) {
      const destino = String(over.id).replace("barra:", "");
      if (destino !== datos.id && !vedadas.has(destino)) alUnir(destino, datos.id);
    }
  }

  const accesibilidad = {
    announcements: {
      onDragStart: ({ active }: { active: { id: string | number } }) => {
        const d = String(active.id);
        return d.startsWith("unir:")
          ? `Tirando una flecha desde «${titulos.get(d.replace("unir:", "")) ?? ""}».`
          : `Levantaste «${titulos.get(d.replace("mover:", "")) ?? ""}».`;
      },
      onDragOver: ({ over }: { over: { id: string | number } | null }) =>
        over
          ? `Encima de «${titulos.get(String(over.id).replace("barra:", "")) ?? ""}».`
          : "Fuera de los bloques.",
      onDragEnd: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) => {
        const d = String(active.id);
        if (d.startsWith("unir:")) {
          return over
            ? `«${titulos.get(String(over.id).replace("barra:", "")) ?? ""}» ahora espera a «${titulos.get(d.replace("unir:", "")) ?? ""}».`
            : "Soltaste la flecha fuera: no se unió nada.";
        }
        return `«${titulos.get(d.replace("mover:", "")) ?? ""}» quedó en su nueva semana.`;
      },
      onDragCancel: () => "Lo dejaste donde estaba.",
    },
  };


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
        {faltaPlan && <EmpezarPlan />}
        <CompartirHistoria />
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
            <Link href={RUTAS.mapa} className="text-foreground underline">
              Manda algo a un carril
            </Link>{" "}
            {faltaPlan ? "o empieza con un plan de boda." : "y aparecerá aquí."}
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

  // Una sola agrupación: por meta, en el orden derivado que ya trae la lista
  // (ordenarMetas en datos.ts, §11.3), y lo que no tiene meta al final
  // (docs/metas.md §5). Sin ninguna meta queda un solo grupo, con la
  // invitación a crear la primera.
  const sueltasDeMeta = ordenPorDependencia(
    enCalendario.filter((a) => !a.metaId || !metas.some((m) => m.id === a.metaId)),
    dependencias,
  );
  const grupos: Grupo[] =
    metas.length > 0
      ? [
          ...metas.map((m) => ({
            clave: m.id,
            titulo: m.titulo,
            meta: true,
            acciones: ordenPorDependencia(
              enCalendario.filter((a) => a.metaId === m.id),
              dependencias,
            ),
            // Con 60 acciones y un puñado de metas esto es una pasada por las
            // dependencias por meta: no vale precalcularlo en un mapa.
            despuesDe: metasQueEspera(m.id, acciones, dependencias, metas).map((x) => x.titulo),
          })),
          { clave: SIN_META, titulo: NOMBRE_SIN_META, meta: false, acciones: sueltasDeMeta, despuesDe: [] },
        ]
      : [
          {
            clave: SIN_META,
            titulo: TODO_LO_ANOTADO,
            meta: false,
            acciones: sueltasDeMeta,
            nota: INVITA_META,
            despuesDe: [],
          },
        ];

  return (
    <div className="space-y-6">
      <TiraProximoHito
        acciones={acciones}
        dependencias={dependencias}
        metas={metas}
        semanasHastaLaBoda={hoy}
      />

      {cabecera}

      <DndContext
        // Id fijo: sin esto dnd-kit genera uno distinto en servidor y cliente
        // (aria-describedby) y React avisa de desajuste de hidratación.
        id="camino-bloques"
        accessibility={accesibilidad}
        sensors={sensores}
        modifiers={[porSemanas]}
        onDragStart={({ active }: DragStartEvent) => {
          const d = active.data.current as { tipo?: string; id?: string } | undefined;
          setArrastre(d?.tipo && d.id ? { tipo: d.tipo, id: d.id } : null);
        }}
        onDragEnd={alSoltar}
        onDragCancel={() => setArrastre(null)}
      >
      <div className="overflow-x-auto pb-2 [--col-nombre:0px] [--col-semana:0px] [--fila-barra:2] [--nombre:1/-1] sm:[--col-nombre:11rem] sm:[--col-semana:2.25rem] sm:[--fila-barra:1] sm:[--nombre:1] lg:[--col-nombre:14rem]">
        <div style={{ minWidth: `calc(var(--col-nombre) + ${columnas} * var(--col-semana))` }}>
          {/* Eje. Lleva el ref porque sus pistas son las mismas que las de
              cada fila, y aquí no hay barras que lo tapen al medir. */}
          <div ref={eje} className="border-border text-muted-foreground grid items-end border-b pb-1.5 text-xs" style={rejilla}>
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
                    <span className="max-sm:hidden"> · {diaDeSemana(fechaBoda, semanas)}</span>
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
                pagosDe={pagosDe}
                acciones={acciones}
                miembros={miembros}
                metas={metas}
                arrastre={arrastre}
                vedadas={vedadas}
                elegida={elegida?.id}
                pidiendo={eleccion?.modo !== "elegido" ? (eleccion?.modo ?? null) : null}
                objetivos={objetivos}
                onElegir={(id) => setEleccion({ id, modo: "elegido" })}
                onTocarObjetivo={alTocarObjetivo}
                onAlternar={alAlternar}
                onBorrar={alBorrar}
                onMoverSemana={alMoverSemana}
                onDesunir={alDesunir}
              />
            ),
          )}
        </div>
      </div>
      </DndContext>

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
          <span className="ring-primary h-3 w-5 rounded-sm ring-2" /> Lo que no se puede atrasar
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-foreground/70 size-2.5 rotate-45" /> Día clave
        </span>
        <span className="flex items-center gap-1.5">
          <Sparkles className="text-primary size-3.5" /> Lista para empezar
        </span>
        {columnaHoy !== null && (
          <span className="flex items-center gap-1.5">
            <span className="border-foreground/30 h-3 border-l border-dashed" /> Hoy
          </span>
        )}
      </div>

      {elegida && eleccion && (
        <BarraEleccion
          accion={elegida}
          modo={eleccion.modo}
          puedeDesunir={unidas.size > 0}
          onSemana={(paso) =>
            elegida.inicioSemanas !== null &&
            alMoverSemana(elegida.id, elegida.inicioSemanas + paso)
          }
          onModo={(modo) => setEleccion({ id: elegida.id, modo })}
          onCerrar={() => setEleccion(null)}
        />
      )}

      {sueltas.length > 0 && (
        <div className="border-border rounded-lg border border-dashed p-4">
          <h3 className="font-display text-base">Todavía sin sitio</h3>
          <p className="text-muted-foreground mt-1 text-sm">{sueltas.map((a) => a.titulo).join(" · ")}</p>
        </div>
      )}
    </div>
  );
}

type Flecha = {
  d: string;
  cadena: boolean;
  choque: boolean;
  /** A quién une, para poder deshacerla con un clic (docs/dependencias.md §10.1). */
  quien: string;
  requisito: string;
  nombre: string;
};

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
  pagosDe,
  acciones,
  miembros,
  metas,
  arrastre,
  vedadas,
  elegida,
  pidiendo,
  objetivos,
  onElegir,
  onTocarObjetivo,
  onAlternar,
  onBorrar,
  onMoverSemana,
  onDesunir,
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
  pagosDe: Map<string, Pago[]>;
  /** Todas las de la boda: el diálogo del orden necesita el grafo entero. */
  acciones: Accion[];
  miembros: Miembro[];
  metas: MetaLite[];
  /** Qué se está arrastrando ahora, para resaltar los destinos posibles. */
  arrastre: { tipo: string; id: string } | null;
  /** Los bloques que harían círculo con lo que se está tirando (§6). */
  vedadas: Set<string>;
  /** Lo elegido con el dedo, resaltado en el gráfico (§10.2). */
  elegida?: string;
  /** La barra está pidiendo un segundo toque, o null. */
  pidiendo: Modo | null;
  /** Las filas que admiten ese segundo toque. */
  objetivos: Set<string>;
  onElegir: (id: string) => void;
  onTocarObjetivo: (id: string) => void;
  onAlternar: (id: string, estado: Estado) => void;
  onBorrar: (id: string) => void;
  onMoverSemana: (id: string, semanas: number) => void;
  onDesunir: (quien: string, requisito: string) => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [flechas, setFlechas] = useState<Flecha[]>([]);
  const ids = new Set(grupo.acciones.map((a) => a.id));
  const cadena = cadenaPrincipal(grupo.acciones, dependencias);
  // La barra resumen es solo de la meta: lo demás no es un entregable (§5).
  const resumen = grupo.meta ? resumenMeta(grupo.acciones, pagosDe) : null;
  // Solo las dependencias dentro del grupo se dibujan; las de otra meta se
  // nombran en el texto "↳ requiere …".
  const pares = dependencias.filter((d) => ids.has(d.accionId) && ids.has(d.requiereId));
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
          quien: p.accionId,
          requisito: p.requiereId,
          nombre: `${porId.get(p.accionId)?.titulo ?? ""} espera a ${porId.get(p.requiereId)?.titulo ?? ""}`,
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
            <div style={{ gridColumn: "var(--nombre)", gridRow: 1 }} className="sm:bg-background sticky left-0 z-20 min-w-0 pr-3">
              <div className="flex min-w-0 items-center gap-1.5">
                <Flag className="text-primary size-3.5 shrink-0" aria-hidden />
                <h3 title={grupo.titulo} className="font-display truncate text-base">{grupo.titulo}</h3>
              </div>
              {/* El orden lógico, hecho visible: a quién espera esta meta
                  (§11.3). Truncado, con el nombre completo en `title`. */}
              {grupo.despuesDe.length > 0 && (
                <p
                  title={`después de ${grupo.despuesDe.join(" y ")}`}
                  className="text-muted-foreground truncate text-xs"
                >
                  ↳ después de {grupo.despuesDe.join(" y ")}
                </p>
              )}
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
          <div className="bg-background sticky left-0 z-20 mb-1.5 w-fit">
            <h3 className="text-muted-foreground text-xs">{grupo.titulo}</h3>
            {grupo.nota && <p className="text-muted-foreground text-xs">{grupo.nota}</p>}
          </div>
        )}

        {grupo.acciones.map((a) => {
          const inicio = columnaDe(inicioDe(a));
          const span = Math.min(duracionDe(a), columnas - inicio + 1);
          const hecha = a.estado === "hecho";
          const haciendo = a.estado === "haciendo";
          const enCadena = cadena.has(a.id);
          const quien = a.responsableId ? gente.get(a.responsableId) : undefined;
          // Lo que va costando, sin palabras: aquí no cabe una frase (§4.3).
          const { costando } = cuentaDe(a.monto, pagosDe.get(a.id) ?? []);

          const esElegida = elegida === a.id;
          const esObjetivo = Boolean(pidiendo) && objetivos.has(a.id);

          const necesita = (requiereDe.get(a.id) ?? [])
            .map((id) => porId.get(id))
            .filter((x): x is Accion => Boolean(x));
          // Las de otro grupo no tienen flecha: se nombran en texto.
          const fuera = necesita.filter((r) => !ids.has(r.id));
          // Un requisito que termina después de que esto empieza es un choque.
          // La idea suelta no choca con nada: todavía no tiene cuándo.
          const choques = enCamino(necesita).filter(
            (r) => r.estado !== "hecho" && finDe(r) < inicioDe(a),
          );

          return (
            <div
              key={a.id}
              // La fila entera es el blanco del segundo toque: mide el ancho
              // de la pantalla, que es lo contrario de apuntar a una barra de
              // 16 px (docs/dependencias.md §10.2). Lo que no se puede tocar
              // se atenúa, para que se vea que la pregunta sigue abierta.
              {...(esObjetivo
                ? {
                    role: "button",
                    tabIndex: 0,
                    "aria-label": `${pidiendo === "unir" ? "Unir con" : "Soltar la unión con"} ${a.titulo}`,
                    onClick: () => onTocarObjetivo(a.id),
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onTocarObjetivo(a.id);
                      }
                    },
                  }
                : {})}
              className={`grid items-center gap-y-0.5 rounded ${
                esObjetivo ? "ring-primary/50 cursor-pointer ring-1" : ""
              } ${pidiendo && !esObjetivo && !esElegida ? "opacity-40" : ""} ${
                esElegida ? "ring-primary ring-2" : ""
              }`}
              style={rejilla}
            >
              {lineas}

              {/* En el celular el fondo cubre solo el texto: las flechas pasan
                  por detrás de las palabras sin cortarse en toda la fila. */}
              <div style={{ gridColumn: "var(--nombre)", gridRow: 1 }} className="sm:bg-background sticky left-0 z-20 min-w-0 pr-3">
                {/* El menú va con el nombre y no sobre la barra: una barra de
                    una semana mide 36 px y en el celular queda fuera de la
                    vista sin hacer scroll (docs/dependencias.md §9.1). */}
                <div className="max-sm:bg-background flex min-w-0 items-center gap-1 max-sm:w-fit max-sm:max-w-full">
                  <button
                    type="button"
                    // El nombre es el blanco del PRIMER toque, no la barra: una
                    // barra de una semana mide 16.75 px en el celular y el
                    // nombre ocupa su propia línea encima (§10.2).
                    // El title va aquí y no en la barra: es este texto el que
                    // se corta cuando el nombre no cabe en su columna.
                    title={a.titulo}
                    aria-pressed={esElegida}
                    onClick={(e) => {
                      if (esObjetivo) return;
                      e.stopPropagation();
                      onElegir(a.id);
                    }}
                    className={`focus-visible:ring-ring min-w-0 cursor-pointer truncate rounded-sm text-left text-sm outline-none focus-visible:ring-2 ${hecha ? "text-muted-foreground line-through" : ""}`}
                  >
                    {listas.has(a.id) && (
                      <Sparkles className="text-primary mr-1 inline size-3.5" aria-label="Lista para empezar" />
                    )}
                    {a.titulo}
                    {/* En el celular la barra es corta: el monto viaja con el nombre. */}
                    {costando > 0 && <span className="text-muted-foreground sm:hidden"> · {soles(costando)}</span>}
                  </button>
                  {/* 16 px de icono: el pseudo-elemento le da los 44 px de
                      área táctil sin agrandar el dibujo. Sin "Mover a": aquí
                      el carril es la meta, y la meta se cambia en Cambiar. */}
                  {/* Mientras la barra pide el segundo toque, el menú se apaga:
                      si no, un toque sobre ⋯ abriría opciones en vez de
                      contestar la pregunta que está en pantalla. */}
                  <MenuAccion
                    accion={a}
                    miembros={miembros}
                    pagos={pagosDe.get(a.id) ?? []}
                    otras={acciones}
                    metas={metas}
                    dependencias={dependencias}
                    onAlternar={onAlternar}
                    onBorrar={onBorrar}
                    onMoverSemana={onMoverSemana}
                    className={`relative shrink-0 before:absolute before:-inset-[14px] before:content-[''] ${
                      pidiendo ? "pointer-events-none opacity-30" : ""
                    }`}
                  />
                </div>
                {(fuera.length > 0 || choques.length > 0) && (
                  <p
                    className={`max-sm:bg-background truncate text-xs max-sm:w-fit max-sm:max-w-full ${choques.length > 0 ? "text-destructive" : "text-muted-foreground"}`}
                    title={necesita.map((r) => r.titulo).join(", ")}
                  >
                    {choques.length > 0 && <TriangleAlert className="mr-1 inline size-3" />}
                    {REQUIERE} {(choques.length > 0 ? choques : fuera).map((r) => r.titulo).join(", ")}
                  </p>
                )}
              </div>

              <Bloque
                accion={a}
                inicio={inicio}
                span={span}
                hecha={hecha}
                haciendo={haciendo}
                enCadena={enCadena}
                quien={quien}
                costando={costando}
                arrastre={arrastre}
                vedada={vedadas.has(a.id)}
              />
            </div>
          );
        })}

        {flechas.length > 0 && (
          // Ya no es `aria-hidden` del todo: las flechas se pueden quitar con
          // un clic, así que son contenido y no decoración. El `pointer-events`
          // se apaga en el lienzo y se enciende solo en cada flecha, para que
          // el lienzo no robe los clics de las barras que tiene debajo.
          <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-visible">
            <defs>
              <marker id={`punta-${grupo.clave}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>
            {flechas.map((f, i) => (
              // Mientras la barra pide el segundo toque, las flechas no
              // reciben clics: pulsar una quitaría una unión en vez de
              // contestar la pregunta que está en pantalla (§10.2).
              <g key={i} className={pidiendo ? "pointer-events-none" : "pointer-events-auto"}>
                {/* Un trazo invisible y ancho: la flecha mide 1 px y nadie
                    acierta a eso con el ratón, mucho menos con el dedo. */}
                <path
                  d={f.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`Quitar: ${f.nombre}`}
                  onClick={() => onDesunir(f.quien, f.requisito)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onDesunir(f.quien, f.requisito);
                    }
                  }}
                >
                  <title>{`${f.nombre}. Pulsa para quitar.`}</title>
                </path>
                <path
                  d={f.d}
                  fill="none"
                  markerEnd={`url(#punta-${grupo.clave})`}
                  className={`pointer-events-none ${f.choque ? "stroke-destructive" : f.cadena ? "stroke-primary" : "stroke-muted-foreground/50"}`}
                  strokeWidth={f.cadena ? 1.75 : 1}
                />
              </g>
            ))}
          </svg>
        )}
      </div>
    </section>
  );
}

/**
 * Un bloque del Gantt: la barra, o el rombo si es un día clave
 * (docs/dependencias.md §10, §10.1).
 *
 * Hace tres cosas a la vez, y por eso es un componente aparte: se arrastra de
 * lado para cambiar de semana, es destino de la flecha que viene de otro
 * bloque, y aloja el `Asa` desde la que se tira esa flecha. Los hooks de
 * `dnd-kit` necesitan un componente por bloque; en el `.map` no se pueden
 * llamar.
 */
function Bloque({
  accion: a,
  inicio,
  span,
  hecha,
  haciendo,
  enCadena,
  quien,
  costando,
  arrastre,
  vedada,
}: {
  accion: EnCamino;
  inicio: number;
  span: number;
  hecha: boolean;
  haciendo: boolean;
  enCadena: boolean;
  quien?: Miembro;
  costando: number;
  arrastre: { tipo: string; id: string } | null;
  /** Unirse a esto haría círculo: no se ofrece como destino (§6). */
  vedada: boolean;
}) {
  // `attributes` se descarta a propósito, igual que en la tarjeta del Mapa:
  // trae un aria-roledescription que promete arrastrar con el teclado, y aquí
  // no hay KeyboardSensor. Sin ratón se usa el menú ⋯ de la fila.
  const mover = useDraggable({ id: `mover:${a.id}`, data: { tipo: "mover", id: a.id } });
  const destino = useDroppable({ id: `barra:${a.id}` });

  const uniendo = arrastre?.tipo === "unir";
  const esOrigen = uniendo && arrastre.id === a.id;
  const disponible = uniendo && !esOrigen && !vedada;

  const estilo = {
    gridColumn: `${inicio + 1} / span ${a.esHito ? 1 : span}`,
    gridRow: "var(--fila-barra)",
    // Durante el arrastre el bloque se adelanta a todo: si quedara debajo de
    // una barra vecina parecería que se ha ido detrás del Gantt.
    transform: CSS.Translate.toString(mover.transform),
    zIndex: mover.isDragging ? 30 : undefined,
  };

  // Dos refs en el mismo nodo: el de soltar y el de arrastrar.
  const refs = (el: HTMLDivElement | null) => {
    destino.setNodeRef(el);
    mover.setNodeRef(el);
  };

  // Sin `touch-none`: el arrastre es de ratón, y ponerlo le quitaría al dedo
  // el desplazamiento horizontal del Gantt en cuanto tocara una barra.
  const comun = `group/bloque relative z-10 ${
    mover.isDragging ? "cursor-grabbing" : "sm:cursor-grab"
  } ${disponible ? "ring-primary/60 ring-2 ring-offset-1 ring-offset-background rounded" : ""} ${
    destino.isOver && disponible ? "ring-primary ring-2" : ""
  } ${esOrigen ? "opacity-60" : ""}`;

  if (a.esHito) {
    return (
      <div
        ref={refs}
        {...mover.listeners}
        data-barra={a.id}
        style={estilo}
        className={`${comun} flex h-5 items-center justify-center sm:h-7`}
        title={`${a.titulo} (día clave) · arrastra para cambiar de semana`}
      >
        <span
          className={`size-3 rotate-45 rounded-[2px] sm:size-3.5 ${
            hecha ? "bg-primary/40" : "bg-foreground/80"
          } ${enCadena ? "ring-primary ring-offset-background ring-2 ring-offset-1" : ""}`}
        />
        <Asa accion={a} />
      </div>
    );
  }

  return (
    <div
      ref={refs}
      {...mover.listeners}
      data-barra={a.id}
      style={estilo}
      title={`${a.titulo} · ${duracionDe(a)} ${duracionDe(a) === 1 ? "semana" : "semanas"} · arrastra para cambiar de semana`}
      className={`${comun} flex h-5 min-w-0 items-center gap-1.5 rounded px-1 sm:h-7 sm:px-2 ${
        hecha
          ? "bg-primary/15 text-muted-foreground"
          : haciendo
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-foreground"
      } ${enCadena ? "ring-primary ring-2" : ""}`}
    >
      {/* En una barra corta no cabe todo: el nombre ya está a la izquierda,
          así que se cae primero el monto y luego el título. */}
      {quien && <AvatarPersona persona={quien} className="size-4" />}
      {span >= 3 && <span className="truncate text-xs max-sm:hidden">{a.titulo}</span>}
      {costando > 0 && span >= 2 && (
        <span className="ml-auto shrink-0 text-xs tabular-nums max-sm:hidden">{soles(costando)}</span>
      )}
      <Asa accion={a} />
    </div>
  );
}

/**
 * El asa desde la que se tira la flecha, en el borde derecho del bloque.
 *
 * Componente propio y no un trozo de JSX guardado en una variable: el hook de
 * arrastre tiene que vivir donde se usa su ref.
 *
 * La dependencia es fin-a-inicio, así que el asa está donde esto **acaba** y
 * se suelta donde empieza lo que lo espera: se lee de izquierda a derecha, en
 * el mismo sentido que el eje. Solo desde `sm`: a 375 px una columna mide unos
 * 16 px y el asa taparía la barra entera. En el celular la ruta es el menú ⋯ →
 * "Qué va antes".
 */
function Asa({ accion }: { accion: EnCamino }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `unir:${accion.id}`,
    data: { tipo: "unir", id: accion.id },
  });
  return (
    <span
      ref={setNodeRef}
      {...listeners}
      // El asa vive DENTRO de la barra, que también arrastra: sin cortar aquí
      // el pointerdown, los dos arrastres se activan con el mismo gesto y el
      // bloque se iría de semana mientras se tira la flecha. Se corta después
      // de pasárselo al asa, no antes.
      onPointerDown={(e) => {
        listeners?.onPointerDown?.(e);
        e.stopPropagation();
      }}
      aria-label={`Tirar una flecha desde ${accion.titulo}`}
      title="Arrastra hasta lo que no puede empezar antes de esto"
      className={`border-background bg-primary absolute top-1/2 -right-1.5 z-20 size-3 -translate-y-1/2 cursor-crosshair rounded-full border opacity-0 transition-opacity max-sm:hidden group-hover/bloque:opacity-100 ${
        isDragging ? "opacity-100" : ""
      }`}
    />
  );
}
