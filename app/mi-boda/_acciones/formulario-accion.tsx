"use client";

import { useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { Plus } from "lucide-react";
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
  crearAccion,
  crearMeta,
  editarAccion,
  guardarDependencias,
  type Momento,
} from "./acciones-servidor";
import { Checkbox } from "@/components/ui/checkbox";
import type { MetaLite, Miembro } from "./tipos";

const SIN_RESPONSABLE = "sin-responsable";
const SIN_META = "sin-meta";
const NUEVA_META = "nueva-meta";

/**
 * Más ancho que el diálogo por defecto: los campos cortos van de a dos y el
 * formulario no se estira hacia abajo. La altura máxima y el scroll los pone
 * el propio DialogContent; el pie queda pegado abajo para que "Guardar" esté
 * siempre a la vista, aunque la lista de dependencias sea larga.
 */
const DIALOGO = "sm:max-w-lg";
const PIE = "bg-popover sticky -bottom-4 -mx-4 mt-6 border-t px-4 pt-3 pb-4";

/**
 * Un solo formulario para anotar y para corregir.
 *
 * Son el mismo puñado de campos, así que separarlos en dos componentes
 * garantizaría que uno se quede atrás cuando el modelo crezca.
 */
function Campos({
  accion,
  momento,
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
  momento: Momento;
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
  // Una idea suelta todavía no tiene sitio en el calendario, y el mismo día
  // de la boda no se cuenta en semanas.
  const enCalendario = momento === "antes" || momento === "despues";
  const cuando = momento === "antes" ? "antes de la boda" : "después de la boda";

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
              placeholder="Registro civil"
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
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch checked={esHito} onCheckedChange={setEsHito} />
          Es un hito
        </label>
      </div>

      {(cuestaDinero || enCalendario) && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {enCalendario && (
            <div className="min-w-0 space-y-2">
              <Label htmlFor="semanas" title={`Semanas ${cuando}`}>
                Semanas {momento === "antes" ? "antes" : "después"}
              </Label>
              <Input
                id="semanas"
                name="semanas"
                type="number"
                min="0"
                max="260"
                inputMode="numeric"
                placeholder="8"
                defaultValue={
                  accion?.inicioSemanas === null || accion?.inicioSemanas === undefined
                    ? ""
                    : String(Math.abs(accion.inicioSemanas))
                }
              />
            </div>
          )}
          {enCalendario && !esHito && (
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
              <Label htmlFor="monto">Cuánto (S/)</Label>
              <Input
                id="monto"
                name="monto"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="250"
                defaultValue={accion?.monto ?? ""}
              />
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
 * Las semanas se escriben siempre en positivo y el signo lo pone el momento:
 * antes de la boda cuentan hacia atrás, después hacia adelante. Nadie debería
 * teclear "-4" para decir "un mes después".
 */
function leer(
  form: FormData,
  momento: Momento,
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

  const inicioSemanas =
    momento === "el_dia"
      ? 0
      : semanas === null || !Number.isFinite(semanas)
        ? null
        : momento === "despues"
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

/** La meta elegida; si es nueva, se crea primero y se devuelve su id. */
async function resolverMeta(meta: string, form: FormData): Promise<string | null> {
  if (meta === SIN_META) return null;
  if (meta !== NUEVA_META) return meta;
  const nombre = String(form.get("metaNueva") ?? "").trim();
  if (!nombre) return null;
  return (await crearMeta(nombre)).id;
}

export function NuevaAccion({
  momento,
  miembros,
  metas = [],
  etiqueta,
}: {
  momento: Momento;
  miembros: Miembro[];
  metas?: MetaLite[];
  etiqueta: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [cuestaTiempo, setCuestaTiempo] = useState(false);
  const [cuestaDinero, setCuestaDinero] = useState(false);
  const [esHito, setEsHito] = useState(false);
  const [meta, setMeta] = useState(SIN_META);
  const [enviando, iniciar] = useTransition();

  function reiniciar() {
    setCuestaTiempo(false);
    setCuestaDinero(false);
    setEsHito(false);
    setMeta(SIN_META);
  }

  function enviar(form: FormData) {
    const datos = leer(form, momento, cuestaTiempo, cuestaDinero, esHito);
    if (!datos) return;
    iniciar(async () => {
      try {
        const metaId = await resolverMeta(meta, form);
        await crearAccion({ ...datos, momento, metaId });
        setAbierto(false);
        reiniciar();
        toast.success("Anotado.");
      } catch {
        toast.error("No se pudo guardar. Intenta otra vez.");
      }
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="lg"
          className="text-muted-foreground hover:text-foreground w-full justify-start"
        >
          <Plus className="size-4" /> Añadir
        </Button>
      </DialogTrigger>

      <DialogContent className={DIALOGO}>
        {/* El formulario se rehace al abrir, así los campos no arrastran lo
            escrito en la vez anterior. */}
        <form action={enviar} key={abierto ? "abierto" : "cerrado"}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-normal">Algo que hacer</DialogTitle>
            <DialogDescription>Va a {etiqueta}.</DialogDescription>
          </DialogHeader>

          <Campos
            momento={momento}
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
 * De qué depende esta acción.
 *
 * Marcas todas las que quieras y se guardan con el resto al dar a Guardar.
 * Antes cada casilla iba sola al servidor y elegir cinco eran cinco esperas.
 */
function Necesita({
  otras,
  marcadas,
  setMarcadas,
}: {
  otras: Accion[];
  marcadas: Set<string>;
  setMarcadas: Dispatch<SetStateAction<Set<string>>>;
}) {
  const [filtro, setFiltro] = useState("");

  if (otras.length === 0) return null;

  const texto = filtro.trim().toLowerCase();
  const vistas = texto
    ? otras.filter((o) => o.titulo.toLowerCase().includes(texto))
    : otras;

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
    <div className="mt-4 space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label>Qué tiene que estar listo antes</Label>
        {marcadas.size > 0 && (
          <button
            type="button"
            onClick={() => setMarcadas(new Set())}
            className="text-muted-foreground hover:text-foreground cursor-pointer text-xs"
          >
            Quitar {marcadas.size}
          </button>
        )}
      </div>

      {/* El buscador aparece cuando la lista ya no se abarca de un vistazo. */}
      {otras.length > 6 && (
        <Input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar entre las demás"
          className="h-8"
        />
      )}

      <div className="border-border max-h-40 overflow-y-auto rounded-md border">
        {vistas.length === 0 ? (
          <p className="text-muted-foreground px-3 py-2 text-sm">Ninguna se llama así.</p>
        ) : (
          vistas.map((o) => (
            <label
              key={o.id}
              className="hover:bg-muted/50 flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm"
            >
              <Checkbox checked={marcadas.has(o.id)} onCheckedChange={() => alternar(o.id)} />
              <span className="min-w-0 flex-1 truncate">{o.titulo}</span>
            </label>
          ))
        )}
      </div>
    </div>
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
  otras,
  requiere,
  abierto,
  onAbiertoChange,
}: {
  accion: Accion;
  miembros: Miembro[];
  metas?: MetaLite[];
  otras: Accion[];
  requiere: Set<string>;
  abierto: boolean;
  onAbiertoChange: (v: boolean) => void;
}) {
  const [cuestaTiempo, setCuestaTiempo] = useState(accion.cuestaTiempo);
  const [cuestaDinero, setCuestaDinero] = useState(accion.monto !== null);
  const [esHito, setEsHito] = useState(accion.esHito);
  const [meta, setMeta] = useState(accion.metaId ?? SIN_META);
  const [marcadas, setMarcadas] = useState(() => new Set(requiere));
  const [enviando, iniciar] = useTransition();

  function enviar(form: FormData) {
    const datos = leer(form, accion.momento, cuestaTiempo, cuestaDinero, esHito);
    if (!datos) return;
    iniciar(async () => {
      try {
        const metaId = await resolverMeta(meta, form);
        await editarAccion(accion.id, { ...datos, metaId });
        await guardarDependencias(accion.id, [...marcadas]);
        onAbiertoChange(false);
        toast.success("Guardado.");
      } catch (e) {
        toast.error(
          e instanceof Error && e.message === "Eso haría un círculo"
            ? "Alguna de esas ya te espera a ti. Lo demás quedó guardado."
            : "No se pudo guardar. Intenta otra vez.",
        );
      }
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className={DIALOGO}>
        <form action={enviar}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-normal">Cambiar esto</DialogTitle>
            <DialogDescription>Para moverla de sitio usa el menú de la tarjeta.</DialogDescription>
          </DialogHeader>

          <Campos
            accion={accion}
            momento={accion.momento}
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

          <Necesita otras={otras} marcadas={marcadas} setMarcadas={setMarcadas} />

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
