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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  crearAccion,
  editarAccion,
  guardarDependencias,
  type Momento,
} from "./acciones-servidor";
import { Checkbox } from "@/components/ui/checkbox";
import type { Miembro } from "./tipos";

const SIN_RESPONSABLE = "sin-responsable";

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
  cuestaTiempo,
  setCuestaTiempo,
  cuestaDinero,
  setCuestaDinero,
}: {
  accion?: Accion;
  momento: Momento;
  miembros: Miembro[];
  cuestaTiempo: boolean;
  setCuestaTiempo: (v: boolean) => void;
  cuestaDinero: boolean;
  setCuestaDinero: (v: boolean) => void;
}) {
  // Una idea suelta todavía no tiene sitio en el calendario, y el mismo día
  // de la boda no se cuenta en semanas.
  const enCalendario = momento === "antes" || momento === "despues";
  const cuando = momento === "antes" ? "antes de la boda" : "después de la boda";

  return (
    <div className="mt-6 space-y-5">
      <div className="space-y-2">
        <Label htmlFor="titulo">Qué hay que hacer</Label>
        <Input
          id="titulo"
          name="titulo"
          placeholder="Sacar la partida de nacimiento"
          defaultValue={accion?.titulo ?? ""}
          autoFocus
          required
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="tiempo" className="font-normal">
            Cuesta tiempo
          </Label>
          <Switch
            id="tiempo"
            checked={cuestaTiempo}
            onCheckedChange={setCuestaTiempo}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="dinero" className="font-normal">
            Cuesta dinero
          </Label>
          <Switch
            id="dinero"
            checked={cuestaDinero}
            onCheckedChange={setCuestaDinero}
          />
        </div>
        {cuestaDinero && (
          <Input
            name="monto"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="Cuánto, en soles"
            defaultValue={accion?.monto ?? ""}
          />
        )}
      </div>

      {enCalendario && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-20 flex-1 space-y-2">
            <Label htmlFor="semanas">Semanas {cuando}</Label>
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
          <div className="min-w-20 flex-1 space-y-2">
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
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="responsable">Quién responde</Label>
        <Select
          name="responsable"
          defaultValue={accion?.responsableId ?? SIN_RESPONSABLE}
        >
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
) {
  const titulo = String(form.get("titulo") ?? "").trim();
  if (!titulo) return null;
  const responsable = String(form.get("responsable") ?? SIN_RESPONSABLE);
  const montoCrudo = String(form.get("monto") ?? "").trim();

  const semanasCrudo = String(form.get("semanas") ?? "").trim();
  const semanas = semanasCrudo === "" ? null : Math.abs(Number(semanasCrudo));
  const dura = Math.max(1, Number(form.get("dura") ?? 1) || 1);

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
  };
}

export function NuevaAccion({
  momento,
  miembros,
  etiqueta,
}: {
  momento: Momento;
  miembros: Miembro[];
  etiqueta: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [cuestaTiempo, setCuestaTiempo] = useState(false);
  const [cuestaDinero, setCuestaDinero] = useState(false);
  const [enviando, iniciar] = useTransition();

  function enviar(form: FormData) {
    const datos = leer(form, momento, cuestaTiempo, cuestaDinero);
    if (!datos) return;
    iniciar(async () => {
      try {
        await crearAccion({ ...datos, momento });
        setAbierto(false);
        setCuestaTiempo(false);
        setCuestaDinero(false);
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

      <DialogContent>
        {/* El formulario se rehace al abrir, así los campos no arrastran lo
            escrito en la vez anterior. */}
        <form action={enviar} key={abierto ? "abierto" : "cerrado"}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-normal">
              Algo que hacer
            </DialogTitle>
            <DialogDescription>Va a {etiqueta}.</DialogDescription>
          </DialogHeader>

          <Campos
            momento={momento}
            miembros={miembros}
            cuestaTiempo={cuestaTiempo}
            setCuestaTiempo={setCuestaTiempo}
            cuestaDinero={cuestaDinero}
            setCuestaDinero={setCuestaDinero}
          />

          <DialogFooter className="mt-7">
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
    <div className="mt-5 space-y-2">
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

      <div className="border-border max-h-44 overflow-y-auto rounded-md border">
        {vistas.length === 0 ? (
          <p className="text-muted-foreground px-3 py-2 text-sm">
            Ninguna se llama así.
          </p>
        ) : (
          vistas.map((o) => (
            <label
              key={o.id}
              className="hover:bg-muted/50 flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm"
            >
              <Checkbox
                checked={marcadas.has(o.id)}
                onCheckedChange={() => alternar(o.id)}
              />
              <span className="min-w-0 flex-1 truncate">{o.titulo}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

export function EditarAccion({
  accion,
  miembros,
  otras,
  requiere,
  abierto,
  onAbiertoChange,
}: {
  accion: Accion;
  miembros: Miembro[];
  otras: Accion[];
  requiere: Set<string>;
  abierto: boolean;
  onAbiertoChange: (v: boolean) => void;
}) {
  const [cuestaTiempo, setCuestaTiempo] = useState(accion.cuestaTiempo);
  const [cuestaDinero, setCuestaDinero] = useState(accion.monto !== null);
  const [marcadas, setMarcadas] = useState(() => new Set(requiere));
  const [enviando, iniciar] = useTransition();

  function enviar(form: FormData) {
    const datos = leer(form, accion.momento, cuestaTiempo, cuestaDinero);
    if (!datos) return;
    iniciar(async () => {
      try {
        await editarAccion(accion.id, datos);
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
      <DialogContent>
        <form action={enviar}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-normal">
              Cambiar esto
            </DialogTitle>
            <DialogDescription>
              Para moverla de sitio usa el menú de la tarjeta.
            </DialogDescription>
          </DialogHeader>

          <Campos
            accion={accion}
            momento={accion.momento}
            miembros={miembros}
            cuestaTiempo={cuestaTiempo}
            setCuestaTiempo={setCuestaTiempo}
            cuestaDinero={cuestaDinero}
            setCuestaDinero={setCuestaDinero}
          />

          <Necesita otras={otras} marcadas={marcadas} setMarcadas={setMarcadas} />

          <DialogFooter className="mt-7">
            <Button type="submit" disabled={enviando}>
              {enviando ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
