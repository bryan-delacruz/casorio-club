"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { Info, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Accion } from "@/db/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  borrarMeta,
  crearAccion,
  crearMeta,
  editarAccion,
} from "./acciones-servidor";
import { DIALOGO, PIE, SIN_META, type MetaLite, type Miembro } from "./tipos";

/**
 * Cuándo cae la acción respecto de la boda. No se guarda en ninguna parte: es
 * solo el signo de `inicioSemanas`, para poder teclear el número en positivo,
 * que es como habla la gente ("un mes después", no "−4") (docs/metas.md §8).
 */
export type Cuando = "antes" | "el_dia" | "despues";

const CUANDOS: { id: Cuando; nombre: string }[] = [
  { id: "antes", nombre: "Antes" },
  { id: "el_dia", nombre: "El día" },
  { id: "despues", nombre: "Después" },
];

/**
 * Qué es un hito, donde se decide (docs/metas.md §8.1): define, da ejemplos,
 * da contraejemplos y dice las consecuencias.
 *
 * Popover y no tooltip porque un tooltip no tiene ruta táctil. El icono lleva
 * `aria-label` y su área de toque crece con el mismo pseudo-elemento que el
 * control "Cuándo": 44 px de alto y 35 px de ancho, porque hacia la izquierda
 * solo se come el hueco de 6 px — más invadiría la palabra "día clave" y tocarla
 * abriría la ayuda en vez de mover el interruptor.
 */
function AyudaHito() {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Qué es un día clave"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring relative cursor-pointer rounded-full outline-none before:absolute before:-top-[0.9375rem] before:-right-[0.9375rem] before:-bottom-[0.9375rem] before:-left-1.5 before:content-[''] focus-visible:ring-2"
      >
        <Info className="size-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={16} className="max-w-[calc(100vw-3rem)]">
        <p className="font-medium">Un día clave marca un día, no un trabajo.</p>
        <p className="text-muted-foreground">
          El caso claro es la ceremonia civil: un día concreto que parte tu boda en antes y
          después.
        </p>
        <p className="text-muted-foreground">
          No son días clave las cosas que te toman tiempo: juntar las partidas, esperar el
          certificado médico, elegir a los testigos. Esas duran, y por eso llevan semanas.
        </p>
        <div className="text-muted-foreground">
          <p>Si lo marcas:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>aparece arriba con su cuenta regresiva;</li>
            <li>en el camino se dibuja como un rombo;</li>
            <li>desaparece &ldquo;Cuántas dura&rdquo;, porque un día clave no dura.</li>
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Sin semanas no hay opción marcada: la acción es una idea suelta. */
export const cuandoDe = (semanas: number | null | undefined): Cuando | null =>
  semanas === null || semanas === undefined
    ? null
    : semanas > 0
      ? "antes"
      : semanas === 0
        ? "el_dia"
        : "despues";

const SIN_RESPONSABLE = "sin-responsable";
const NUEVA_META = "nueva-meta";

/**
 * Un solo formulario para anotar y para corregir.
 *
 * Son el mismo puñado de campos, así que separarlos en dos componentes
 * garantizaría que uno se quede atrás cuando el modelo crezca.
 */
function Campos({
  accion,
  semanaInicial,
  cuando,
  setCuando,
  miembros,
  metas,
  meta,
  setMeta,
  cuestaTiempo,
  setCuestaTiempo,
  cuestaDinero,
  setCuestaDinero,
  esHito,
  setEsHito,
}: {
  accion?: Accion;
  /** La semana con la que llega el formulario; null = idea suelta. */
  semanaInicial: number | null;
  cuando: Cuando | null;
  setCuando: (v: Cuando | null) => void;
  miembros: Miembro[];
  metas: MetaLite[];
  meta: string;
  setMeta: (v: string) => void;
  cuestaTiempo: boolean;
  setCuestaTiempo: (v: boolean) => void;
  cuestaDinero: boolean;
  setCuestaDinero: (v: boolean) => void;
  esHito: boolean;
  setEsHito: (v: boolean) => void;
}) {
  // El número se teclea siempre en positivo: el signo lo pone "Cuándo".
  const [semanas, setSemanas] = useState(
    semanaInicial === null ? "" : String(Math.abs(semanaInicial)),
  );
  // El mismo día de la boda no se cuenta en semanas.
  const elDia = cuando === "el_dia";
  const sinSitio = !elDia && semanas.trim() === "";

  /**
   * Las dos mitades del control dicen lo mismo o mienten: desmarcar la opción
   * borra el número (queda en ideas sueltas, que es lo que anuncia la línea
   * de abajo) y teclear un número marca "Antes", que es como se lee.
   */
  function elegir(id: Cuando) {
    if (cuando !== id) return setCuando(id);
    setCuando(null);
    setSemanas("");
  }
  function escribirSemanas(valor: string) {
    setSemanas(valor);
    if (valor.trim() !== "" && cuando === null) setCuando("antes");
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="titulo">Qué hay que hacer</Label>
        <Input
          id="titulo"
          name="titulo"
          placeholder="Sacar la partida de nacimiento"
          defaultValue={accion?.titulo ?? ""}
          // Solo al anotar algo nuevo: al editar, en el celular abriría el
          // teclado y taparía el formulario antes de que elijas qué cambiar.
          autoFocus={!accion}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="meta">Meta</Label>
          <Select name="meta" value={meta} onValueChange={setMeta}>
            <SelectTrigger id="meta" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_META}>Sin meta</SelectItem>
              {metas.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.titulo}
                </SelectItem>
              ))}
              <SelectSeparator />
              <SelectItem value={NUEVA_META}>+ Nueva meta…</SelectItem>
            </SelectContent>
          </Select>
          {meta === NUEVA_META && (
            <Input
              name="metaNueva"
              placeholder="Ahorro, ceremonia, recepción…"
              maxLength={60}
              aria-label="Nombre de la meta nueva"
              required
            />
          )}
        </div>

        <div className="min-w-0 space-y-2">
          <Label htmlFor="responsable">Quién responde</Label>
          <Select name="responsable" defaultValue={accion?.responsableId ?? SIN_RESPONSABLE}>
            <SelectTrigger id="responsable" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_RESPONSABLE}>Todavía nadie</SelectItem>
              {miembros.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tres interruptores en una fila: antes eran tres renglones. */}
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch checked={cuestaTiempo} onCheckedChange={setCuestaTiempo} />
          Cuesta tiempo
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch checked={cuestaDinero} onCheckedChange={setCuestaDinero} />
          Cuesta dinero
        </label>
        {/* El disparador va fuera del <label>: dentro, tocarlo cambiaría el
            interruptor (docs/metas.md §8.1). */}
        <div className="flex items-center gap-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch checked={esHito} onCheckedChange={setEsHito} />
            Es un día clave
          </label>
          <AyudaHito />
        </div>
      </div>

      {/* Quien enciende sin leer nada también se lleva la consecuencia. */}
      {esHito && (
        <p className="text-muted-foreground text-xs">
          Un día clave no dura: marca el día. Lo verás arriba con su cuenta regresiva.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="semanas">Cuándo</Label>
        <div className="flex flex-wrap items-center gap-2">
          {/* Tres opciones y ninguna obligatoria: sin semanas la acción se
              queda en ideas sueltas. Volver a tocar la marcada la desmarca y
              borra el número, para que no se guarde algo que ya no se ve. */}
          <div role="group" aria-label="Cuándo" className="border-border inline-flex rounded-md border p-0.5">
            {CUANDOS.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={cuando === c.id}
                onClick={() => elegir(c.id)}
                className={`focus-visible:ring-ring relative cursor-pointer rounded-sm px-3 py-1 text-sm outline-none before:absolute before:inset-x-0 before:-top-2 before:-bottom-2 before:content-[''] focus-visible:ring-2 ${
                  cuando === c.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.nombre}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="semanas"
              name="semanas"
              type="number"
              min="0"
              max="260"
              inputMode="numeric"
              placeholder="8"
              className="w-20"
              disabled={elDia}
              aria-label="Cuántas semanas"
              value={semanas}
              onChange={(e) => escribirSemanas(e.target.value)}
            />
            <span className="text-muted-foreground text-sm">semanas</span>
          </div>
        </div>
        {sinSitio && (
          <p className="text-muted-foreground text-xs">Sin semanas, queda en ideas sueltas.</p>
        )}
      </div>

      {(cuestaDinero || !esHito) && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {!esHito && (
            <div className="min-w-0 space-y-2">
              <Label htmlFor="dura">Cuántas dura</Label>
              <Input
                id="dura"
                name="dura"
                type="number"
                min="1"
                max="260"
                inputMode="numeric"
                defaultValue={String(accion?.duracionSemanas ?? 1)}
              />
            </div>
          )}
          {cuestaDinero && (
            <div className="min-w-0 space-y-2">
              <Label htmlFor="monto">Cuánto estimas (S/)</Label>
              <Input
                id="monto"
                name="monto"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="250"
                defaultValue={accion?.monto ?? ""}
                aria-describedby="ayuda-monto"
              />
              {/* El monto es el estimado, no un hecho: se puede no saber
                  todavía y los pagos lo van sumando (docs/pagos.md §3.4). */}
              <p id="ayuda-monto" className="text-muted-foreground text-xs">
                Si todavía no lo sabes, déjalo en blanco y anota los pagos.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea
          id="notas"
          name="notas"
          rows={2}
          placeholder="Lo que no quieras olvidar"
          defaultValue={accion?.notas ?? ""}
        />
      </div>
    </div>
  );
}

/**
 * Lee el formulario. Devuelve null si falta el título.
 *
 * Las semanas se escriben siempre en positivo y el signo lo pone "Cuándo":
 * antes de la boda cuentan hacia atrás, después hacia adelante. Nadie debería
 * teclear "-4" para decir "un mes después".
 */
function leer(
  form: FormData,
  cuando: Cuando | null,
  cuestaTiempo: boolean,
  cuestaDinero: boolean,
  esHito: boolean,
) {
  const titulo = String(form.get("titulo") ?? "").trim();
  if (!titulo) return null;
  const responsable = String(form.get("responsable") ?? SIN_RESPONSABLE);
  const montoCrudo = String(form.get("monto") ?? "").trim();

  const semanasCrudo = String(form.get("semanas") ?? "").trim();
  const semanas = semanasCrudo === "" ? null : Math.abs(Number(semanasCrudo));
  // Un hito no dura: es un día.
  const dura = esHito ? 1 : Math.max(1, Number(form.get("dura") ?? 1) || 1);

  // Sin opción marcada no hay nada que interpretar: idea suelta, que es lo
  // que el formulario anuncia (el número se borra al desmarcar).
  const inicioSemanas =
    cuando === "el_dia"
      ? 0
      : cuando === null || semanas === null || !Number.isFinite(semanas)
        ? null
        : cuando === "despues"
          ? -semanas
          : semanas;

  return {
    titulo,
    cuestaTiempo,
    monto: cuestaDinero && montoCrudo ? montoCrudo : null,
    responsableId: responsable === SIN_RESPONSABLE ? null : responsable,
    notas: String(form.get("notas") ?? "").trim() || null,
    inicioSemanas,
    duracionSemanas: dura,
    esHito,
  };
}

class MetaInvalida extends Error {}

/**
 * La meta elegida. Si es nueva, se crea primero (la acción necesita su id) y
 * se devuelve `creada` para poder borrarla si después falla guardar la acción:
 * si no, quedaría una meta vacía y reintentar chocaría con su propio nombre.
 */
async function resolverMeta(meta: string, form: FormData): Promise<{ id: string | null; creada?: string }> {
  if (meta === SIN_META) return { id: null };
  if (meta !== NUEVA_META) return { id: meta };
  const r = await crearMeta(String(form.get("metaNueva") ?? ""));
  if (!r.id) throw new MetaInvalida(r.error ?? "No se pudo crear la meta.");
  return { id: r.id, creada: r.id };
}

/** Guarda la acción y, si falla, deshace la meta que se acaba de crear. */
async function guardarConMeta(meta: string, form: FormData, guardar: (metaId: string | null) => Promise<void>) {
  const { id, creada } = await resolverMeta(meta, form);
  try {
    await guardar(id);
  } catch (e) {
    if (creada) await borrarMeta(creada).catch(() => null);
    throw e;
  }
}

/** Mensaje para el toast: el de la meta si fue eso, si no uno genérico. */
const mensajeDe = (e: unknown, generico: string) => (e instanceof MetaInvalida ? e.message : generico);

export function NuevaAccion({
  semanaInicial = null,
  metaInicial = null,
  miembros,
  metas = [],
  etiqueta,
  disparador,
}: {
  /**
   * La semana con la que llega prellenado: la del carril desde donde se
   * anota. Vacío (null) desde el botón Anotar del celular y desde la bandeja
   * de ideas (docs/metas.md §8).
   */
  semanaInicial?: number | null;
  /** La meta del carril desde donde se anota; null desde "Sin meta" (§8). */
  metaInicial?: string | null;
  miembros: Miembro[];
  metas?: MetaLite[];
  /** El nombre del carril donde cae lo nuevo, tal cual se ve en el Mapa. */
  etiqueta: string;
  /** El botón que abre el formulario. Por defecto, "Añadir" al pie del carril. */
  disparador?: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const disparo = useRef<HTMLButtonElement>(null);
  const [cuestaTiempo, setCuestaTiempo] = useState(false);
  const [cuestaDinero, setCuestaDinero] = useState(false);
  const [esHito, setEsHito] = useState(false);
  const [meta, setMeta] = useState(metaInicial ?? SIN_META);
  const [cuando, setCuando] = useState(cuandoDe(semanaInicial));
  const [enviando, iniciar] = useTransition();

  function reiniciar() {
    setCuestaTiempo(false);
    setCuestaDinero(false);
    setEsHito(false);
    setMeta(metaInicial ?? SIN_META);
    setCuando(cuandoDe(semanaInicial));
  }

  function enviar(form: FormData) {
    const datos = leer(form, cuando, cuestaTiempo, cuestaDinero, esHito);
    if (!datos) return;
    iniciar(async () => {
      try {
        await guardarConMeta(meta, form, (metaId) => crearAccion({ ...datos, metaId }));
        setAbierto(false);
        reiniciar();
        toast.success("Anotado.");
      } catch (e) {
        toast.error(mensajeDe(e, "No se pudo guardar. Intenta otra vez."));
      }
    });
  }

  /**
   * El foco sale del disparador antes de abrir: al abrir, Radix pone
   * aria-hidden a todo lo que queda fuera del diálogo y el navegador lo
   * bloquea si el foco sigue dentro. Al cerrar se lo devolvemos a mano,
   * porque Radix ya no sabría a dónde.
   */
  function abrir(v: boolean) {
    if (v) (document.activeElement as HTMLElement | null)?.blur();
    setAbierto(v);
  }

  return (
    <Dialog open={abierto} onOpenChange={abrir}>
      <DialogTrigger asChild ref={disparo}>
        {disparador ?? (
          <Button
            variant="ghost"
            size="lg"
            className="text-muted-foreground hover:text-foreground w-full justify-start"
          >
            <Plus className="size-4" /> Añadir
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        className={DIALOGO}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          disparo.current?.focus();
        }}
      >
        {/* El formulario se rehace al abrir, así los campos no arrastran lo
            escrito en la vez anterior. */}
        <form action={enviar} key={abierto ? "abierto" : "cerrado"}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-normal">Algo que hacer</DialogTitle>
            <DialogDescription>Queda en «{etiqueta}».</DialogDescription>
          </DialogHeader>

          <Campos
            semanaInicial={semanaInicial}
            cuando={cuando}
            setCuando={setCuando}
            miembros={miembros}
            metas={metas}
            meta={meta}
            setMeta={setMeta}
            cuestaTiempo={cuestaTiempo}
            setCuestaTiempo={setCuestaTiempo}
            cuestaDinero={cuestaDinero}
            setCuestaDinero={setCuestaDinero}
            esHito={esHito}
            setEsHito={setEsHito}
          />

          <DialogFooter className={PIE}>
            <Button type="submit" disabled={enviando}>
              {enviando ? "Guardando…" : "Anotar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Editar. Va controlado desde fuera porque lo abre el menú de la tarjeta, y
 * un diálogo dentro de un menú se desmonta cuando el menú se cierra.
 */
export function EditarAccion({
  accion,
  miembros,
  metas = [],
  abierto,
  onAbiertoChange,
}: {
  accion: Accion;
  miembros: Miembro[];
  metas?: MetaLite[];
  abierto: boolean;
  onAbiertoChange: (v: boolean) => void;
}) {
  const [cuestaTiempo, setCuestaTiempo] = useState(accion.cuestaTiempo);
  const [cuestaDinero, setCuestaDinero] = useState(accion.monto !== null);
  const [esHito, setEsHito] = useState(accion.esHito);
  const [meta, setMeta] = useState(accion.metaId ?? SIN_META);
  const [cuando, setCuando] = useState(cuandoDe(accion.inicioSemanas));
  const [enviando, iniciar] = useTransition();

  function enviar(form: FormData) {
    const datos = leer(form, cuando, cuestaTiempo, cuestaDinero, esHito);
    if (!datos) return;
    iniciar(async () => {
      try {
        await guardarConMeta(meta, form, (metaId) => editarAccion(accion.id, { ...datos, metaId }));
        onAbiertoChange(false);
        toast.success("Guardado.");
      } catch (e) {
        toast.error(mensajeDe(e, "No se pudo guardar. Intenta otra vez."));
      }
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className={DIALOGO}>
        <form action={enviar}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-normal">Cambiar esto</DialogTitle>
            <DialogDescription>Cambiar las semanas la mueve de sitio en el camino.</DialogDescription>
          </DialogHeader>

          <Campos
            accion={accion}
            semanaInicial={accion.inicioSemanas}
            cuando={cuando}
            setCuando={setCuando}
            miembros={miembros}
            metas={metas}
            meta={meta}
            setMeta={setMeta}
            cuestaTiempo={cuestaTiempo}
            setCuestaTiempo={setCuestaTiempo}
            cuestaDinero={cuestaDinero}
            setCuestaDinero={setCuestaDinero}
            esHito={esHito}
            setEsHito={setEsHito}
          />

          <DialogFooter className={PIE}>
            <Button type="submit" disabled={enviando}>
              {enviando ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
