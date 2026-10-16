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
import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import type { Accion, Dependencia, Pago } from "@/db/schema";
import { AvatarPersona } from "@/components/avatar-persona";
import {
  enCamino,
  faltanSemanas,
  ordenPorSemana,
  queTocaAhora,
  REGISTRO_CIVIL,
  resumenMeta,
  semanaPorDefecto,
} from "@/lib/metas";
import { borrarAccion, cambiarEstado, moverAccion, type Estado } from "./acciones-servidor";
import { EmpezarRegistroCivil } from "./empezar-registro-civil";
import { EditarAccion, NuevaAccion } from "./formulario-accion";
import { Reparto } from "./reparto";
import { TarjetaAccion } from "./tarjeta-accion";
import { TiraProximoHito } from "./tira-hito";
import {
  ESTADOS,
  IDEAS,
  INVITA_META,
  NOMBRE_IDEAS,
  siguienteEstado,
  SIN_META,
  soles,
  type Carril as CarrilLista,
  type Destino,
  type MetaLite,
  type Miembro,
} from "./tipos";

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
        disponible ? "ring-primary ring-2 ring-offset-2 ring-offset-background" : ""
      } ${isOver ? "bg-accent" : ""} ${hayArrastre && esOrigen ? "opacity-50" : ""}`}
    >
      {children}
    </div>
  );
}

/** "esta semana", "la semana que viene", "hace 2 semanas". Nada sin fecha. */
function cuandoToca(semana: number, semanasHastaLaBoda: number | null) {
  const faltan = faltanSemanas(semanasHastaLaBoda, semana);
  if (faltan === null) return null;
  if (faltan === 0) return "esta semana";
  if (faltan === 1) return "la semana que viene";
  if (faltan > 1) return `en ${faltan} semanas`;
  const pasadas = -faltan;
  return `hace ${pasadas} ${pasadas === 1 ? "semana" : "semanas"}`;
}

/**
 * Una línea de la banda: el mismo círculo de estado que la tarjeta para
 * marcarla hecha sin salir de aquí, y el título abre el formulario.
 */
function LineaBanda({
  accion,
  meta,
  miembro,
  miembros,
  metas,
  otras,
  requiere,
  semanasHastaLaBoda,
  onAlternar,
}: {
  accion: Accion;
  meta?: MetaLite;
  miembro?: Miembro;
  miembros: Miembro[];
  metas: MetaLite[];
  otras: Accion[];
  requiere: Set<string>;
  semanasHastaLaBoda: number | null;
  onAlternar: (id: string, estado: Estado) => void;
}) {
  const [editando, setEditando] = useState(false);
  const haciendo = accion.estado === "haciendo";
  const toca = accion.inicioSemanas === null ? null : cuandoToca(accion.inicioSemanas, semanasHastaLaBoda);

  return (
    <div className="flex items-start gap-2 py-1.5">
      <button
        type="button"
        onClick={() => onAlternar(accion.id, siguienteEstado(accion.estado))}
        aria-label={`${ESTADOS.find((e) => e.id === accion.estado)?.nombre}. Pasar a ${
          ESTADOS.find((e) => e.id === siguienteEstado(accion.estado))?.nombre
        }`}
        /* 16 px y es la acción principal de la banda: el pseudo-elemento le da
           los 44 px de área táctil sin agrandar el círculo. */
        className={`focus-visible:ring-ring relative mt-1 grid size-4 shrink-0 cursor-pointer place-items-center rounded-full border outline-none before:absolute before:-inset-[14px] before:content-[''] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          haciendo ? "border-primary" : "border-muted-foreground/45"
        }`}
      >
        {haciendo && <span className="bg-primary size-1.5 rounded-full" />}
        {accion.estado === "hecho" && <Check className="size-3" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="focus-visible:ring-ring cursor-pointer rounded-sm text-left text-[0.9375rem] leading-5 outline-none focus-visible:ring-2"
        >
          {accion.titulo}
        </button>
        {(meta || toca) && (
          <p className="text-muted-foreground text-xs">
            {meta?.titulo}
            {meta && toca && " · "}
            {toca}
          </p>
        )}
      </div>

      {miembro && <AvatarPersona persona={miembro} className="mt-0.5 size-5 shrink-0" />}

      {editando && (
        <EditarAccion
          accion={accion}
          miembros={miembros}
          metas={metas}
          otras={otras}
          requiere={requiere}
          abierto={editando}
          onAbiertoChange={setEditando}
        />
      )}
    </div>
  );
}

export function Mapa({
  iniciales,
  miembros,
  pagos,
  dependencias,
  metas = [],
  carriles,
  semanasHastaLaBoda = null,
}: {
  iniciales: Accion[];
  miembros: Miembro[];
  pagos: Pago[];
  dependencias: Dependencia[];
  metas?: MetaLite[];
  /**
   * Los carriles ya resueltos por el servidor (docs/metas.md §7): las metas
   * de la boda y "Sin meta", o el carril único "Todo lo anotado" si todavía
   * no hay ninguna meta. El cliente no decide la estructura del tablero.
   */
  carriles: CarrilLista[];
  /** Cuántas semanas faltan para la boda. Null si todavía no hay fecha. */
  semanasHastaLaBoda?: number | null;
}) {
  const [, iniciar] = useTransition();
  const [arrastrando, setArrastrando] = useState<Accion | null>(null);

  /**
   * Optimista: la tarjeta se mueve en cuanto la sueltas, sin esperar al
   * servidor. Lo que cambia es la meta, que no recalcula ningún corte de
   * tiempo, así que la tarjeta no puede saltar dos veces (docs/metas.md
   * §7.1). La banda "Qué toca ahora" se recalcula con esta misma lista: por
   * eso vive aquí dentro y no en el servidor (§14.10).
   */
  const [lista, aplicar] = useOptimistic(
    iniciales,
    (
      actual: Accion[],
      cambio: { id: string; inicioSemanas?: number | null; metaId?: string | null; estado?: Estado },
    ) => actual.map((a) => (a.id === cambio.id ? { ...a, ...cambio } : a)),
  );

  const ideas = lista.filter((a) => a.inicioSemanas === null);
  const hayMetas = carriles.some((c) => c.esMeta);
  const tieneRegistro = metas.some((m) => m.titulo === REGISTRO_CIVIL.titulo);

  /** De qué meta es una acción, con "Sin meta" para la que no tiene (§7). */
  const metaDe = (a: Accion): Destino =>
    a.metaId && carriles.some((c) => c.id === a.metaId) ? a.metaId : SIN_META;

  /** En qué carril cae: la bandeja si es idea suelta, si no el de su meta. */
  const carrilDe = (a: Accion): Destino => (a.inicioSemanas === null ? IDEAS : metaDe(a));

  const grupos = carriles.map((c) => ({
    ...c,
    acciones: ordenPorSemana(enCamino(lista).filter((a) => carrilDe(a) === c.id)),
    // El avance y el monto son de la meta entera, ideas sueltas incluidas: el
    // carril enseña lo que ya tiene cuándo, pero la meta es todo (§3, §7).
    resumen: resumenMeta(lista.filter((a) => metaDe(a) === c.id)),
  }));

  const destinos: CarrilLista[] = [
    ...carriles,
    { id: IDEAS, nombre: NOMBRE_IDEAS, esMeta: false },
  ];

  const porId = new Map(miembros.map((m) => [m.id, m]));
  const porMeta = new Map(metas.map((m) => [m.id, m]));
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

  /**
   * Mover es escribir la meta (docs/metas.md §7). La semana solo cambia al
   * sacar algo de las ideas sueltas, y la decide la misma función pura que
   * usa el servidor, así el optimismo no miente.
   */
  function mover(id: string, destino: Destino) {
    const accion = lista.find((a) => a.id === id);
    if (!accion) return;
    if (destino !== IDEAS && !carriles.some((c) => c.id === destino)) return;
    if (carrilDe(accion) === destino) return;

    const cambio =
      destino === IDEAS
        ? { id, inicioSemanas: null }
        : {
            id,
            metaId: destino === SIN_META ? null : destino,
            inicioSemanas:
              accion.inicioSemanas ??
              semanaPorDefecto({
                hitoSemana: null,
                semanasHastaLaBoda,
                duracion: accion.duracionSemanas,
              }),
          };

    iniciar(async () => {
      aplicar(cambio);
      try {
        const r = await moverAccion(id, destino);
        if (r.error) toast.error(r.error);
      } catch {
        toast.error("No se pudo mover.");
      }
    });
  }

  function alSoltar(e: DragEndEvent) {
    setArrastrando(null);
    if (!e.over) return;
    const id = String(e.active.id);
    const sobre = String(e.over.id);
    // Los carriles son las únicas zonas soltables; si algún día una tarjeta
    // vuelve a serlo, se resuelve a qué carril pertenece lo que hay debajo.
    const otra = lista.find((a) => a.id === sobre);
    const destino =
      sobre === IDEAS || carriles.some((c) => c.id === sobre) ? sobre : otra ? carrilDe(otra) : null;
    if (!destino) return;
    mover(id, destino);
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

  /** Las tarjetas de un carril, con todo lo que necesitan para editarse. */
  const tarjetas = (items: Accion[], destinoActual: Destino) =>
    items.map((a) => (
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
        destinos={destinos}
        destinoActual={destinoActual}
        onAlternar={alAlternar}
        onMover={mover}
        onBorrar={alBorrar}
      />
    ));

  const nombreDe = (id: string) =>
    destinos.find((d) => d.id === id)?.nombre ?? "otro sitio";

  /**
   * Lo que oye quien usa lector de pantalla. dnd-kit los trae en inglés, y
   * sus instrucciones de teclado además serían mentira: no hay KeyboardSensor
   * (mover sin arrastrar es el menú ⋯ de la tarjeta).
   */
  const accesibilidad = {
    screenReaderInstructions: { draggable: "" },
    announcements: {
      onDragStart: ({ active }: { active: { id: string | number } }) =>
        `Levantaste «${titulos.get(String(active.id)) ?? ""}».`,
      onDragOver: ({ over }: { over: { id: string | number } | null }) =>
        over ? `Encima de ${nombreDe(String(over.id))}.` : "Fuera de los carriles.",
      onDragEnd: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) =>
        over
          ? `«${titulos.get(String(active.id)) ?? ""}» quedó en ${nombreDe(String(over.id))}.`
          : "Lo soltaste fuera: se quedó donde estaba.",
      onDragCancel: ({ active }: { active: { id: string | number } }) =>
        `Dejaste «${titulos.get(String(active.id)) ?? ""}» donde estaba.`,
    },
  };

  const carrilArrastrado = arrastrando ? carrilDe(arrastrando) : null;

  // La banda (docs/metas.md §5.2): todas las candidatas, para saber cuántas
  // quedan fuera; en pantalla, cinco.
  const candidatas = queTocaAhora(lista, dependencias, semanasHastaLaBoda, lista.length);
  const banda = candidatas.slice(0, 5);
  const nadaEnElCamino = lista.every((a) => a.inicioSemanas === null);

  /** La semana con la que nace algo anotado desde un carril (§8). */
  const semanaNueva = semanaPorDefecto({ hitoSemana: null, semanasHastaLaBoda, duracion: 1 });

  return (
    <DndContext
      // Id fijo: sin esto dnd-kit genera uno distinto en servidor y cliente
      // (aria-describedby) y React avisa de desajuste de hidratación.
      id="mapa-acciones"
      accessibility={accesibilidad}
      sensors={sensores}
      onDragStart={(e: DragStartEvent) =>
        setArrastrando(lista.find((a) => a.id === e.active.id) ?? null)
      }
      onDragEnd={alSoltar}
      onDragCancel={() => setArrastrando(null)}
    >
      {/* Qué toca ahora: lo primero de la portada, porque es la pregunta con
          la que se abre la app un lunes por la noche (docs/metas.md §5.2). */}
      <section className="bg-muted/40 rounded-lg p-4">
        <h2 className="font-display text-lg">Qué toca ahora</h2>
        {nadaEnElCamino ? (
          <div className="mt-2 space-y-3">
            <p className="text-muted-foreground text-sm">Todavía no hay nada con fecha.</p>
            {!tieneRegistro && <EmpezarRegistroCivil />}
          </div>
        ) : banda.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Nada urgente. Lo que sigue espera a otra cosa.
          </p>
        ) : (
          <div className="divide-border/60 mt-1 divide-y">
            {banda.map((a) => (
              <LineaBanda
                key={a.id}
                accion={a}
                meta={a.metaId ? porMeta.get(a.metaId) : undefined}
                miembro={a.responsableId ? porId.get(a.responsableId) : undefined}
                miembros={miembros}
                metas={metas}
                otras={lista.filter((o) => o.id !== a.id)}
                requiere={requiereDe.get(a.id) ?? new Set()}
                semanasHastaLaBoda={semanasHastaLaBoda}
                onAlternar={alAlternar}
              />
            ))}
            {candidatas.length > banda.length && (
              <p className="text-muted-foreground pt-2 text-sm">
                y {candidatas.length - banda.length} más abajo
              </p>
            )}
          </div>
        )}
      </section>

      {/* La tira del próximo hito, debajo de la banda (docs/metas.md §5.3). */}
      <div className="mt-4">
        <TiraProximoHito
          acciones={lista}
          dependencias={dependencias}
          metas={metas}
          semanasHastaLaBoda={semanasHastaLaBoda}
          invita
        />
      </div>

      {/* Un carril por meta, apilados: su número lo decide la pareja, así que
          una rejilla de tres columnas se rompería a partir del cuarto. */}
      <div className="mt-6 space-y-4">
        {grupos.map((g) => {
          const { resumen } = g;
          return (
            <Carril
              key={g.id}
              id={g.id}
              className="bg-muted/40 p-4"
              hayArrastre={arrastrando !== null}
              esOrigen={carrilArrastrado === g.id}
            >
              <div>
                <h2 className="font-display text-lg">{g.nombre}</h2>
                <p className="text-muted-foreground text-sm">
                  {g.acciones.length === 0
                    ? g.esMeta
                      ? "arrastra aquí lo que sea de esta meta"
                      : "arrastra aquí lo que no es de ninguna meta"
                    : `${g.acciones.length}${resumen.monto > 0 ? ` · ${soles(resumen.monto)}` : ""} · ${
                        resumen.hechas
                      } de ${resumen.total} hechas`}
                </p>
                {/* Sin ninguna meta, el carril único no explica por qué está
                    solo (docs/metas.md §7). */}
                {!hayMetas && <p className="text-muted-foreground text-sm">{INVITA_META}</p>}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {tarjetas(g.acciones, g.id)}
              </div>

              <div className="mt-2">
                <NuevaAccion
                  semanaInicial={semanaNueva}
                  metaInicial={g.esMeta ? g.id : null}
                  miembros={miembros}
                  metas={metas}
                  etiqueta={g.nombre}
                />
              </div>
            </Carril>
          );
        })}
      </div>

      {/* Bandeja de ideas: lo que todavía no sabes cuándo va. Baja del todo
          junto al Reparto para que los carriles se vean de un vistazo (§7). */}
      <div className="mt-6">
        <Carril
          id={IDEAS}
          className="border-border border border-dashed p-4"
          hayArrastre={arrastrando !== null}
          esOrigen={carrilArrastrado === IDEAS}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg">{NOMBRE_IDEAS}</h2>
            <p className="text-muted-foreground text-sm">
              Anótalas aquí y arrástralas cuando sepas cuándo van.
            </p>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tarjetas(ideas, IDEAS)}
          </div>
          <div className="mt-2">
            {/* Sin semanas: lo nuevo nace aquí mismo, como idea suelta. */}
            <NuevaAccion miembros={miembros} metas={metas} etiqueta={NOMBRE_IDEAS} />
          </div>
        </Carril>
      </div>

      <div className="mt-6">
        <Reparto lista={lista} miembros={miembros} pagos={pagos} />
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
