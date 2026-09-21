"use client";

import { useState, useTransition } from "react";
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
import { crearAccion, editarAccion, type Momento } from "./acciones-servidor";
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
  miembros,
  cuestaTiempo,
  setCuestaTiempo,
  cuestaDinero,
  setCuestaDinero,
}: {
  accion?: Accion;
  miembros: Miembro[];
  cuestaTiempo: boolean;
  setCuestaTiempo: (v: boolean) => void;
  cuestaDinero: boolean;
  setCuestaDinero: (v: boolean) => void;
}) {
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

/** Lee el formulario. Devuelve null si falta el título. */
function leer(form: FormData, cuestaTiempo: boolean, cuestaDinero: boolean) {
  const titulo = String(form.get("titulo") ?? "").trim();
  if (!titulo) return null;
  const responsable = String(form.get("responsable") ?? SIN_RESPONSABLE);
  const montoCrudo = String(form.get("monto") ?? "").trim();
  return {
    titulo,
    cuestaTiempo,
    monto: cuestaDinero && montoCrudo ? montoCrudo : null,
    responsableId: responsable === SIN_RESPONSABLE ? null : responsable,
    notas: String(form.get("notas") ?? "").trim() || null,
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
    const datos = leer(form, cuestaTiempo, cuestaDinero);
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
export function EditarAccion({
  accion,
  miembros,
  abierto,
  onAbiertoChange,
}: {
  accion: Accion;
  miembros: Miembro[];
  abierto: boolean;
  onAbiertoChange: (v: boolean) => void;
}) {
  const [cuestaTiempo, setCuestaTiempo] = useState(accion.cuestaTiempo);
  const [cuestaDinero, setCuestaDinero] = useState(accion.monto !== null);
  const [enviando, iniciar] = useTransition();

  function enviar(form: FormData) {
    const datos = leer(form, cuestaTiempo, cuestaDinero);
    if (!datos) return;
    iniciar(async () => {
      try {
        await editarAccion(accion.id, datos);
        onAbiertoChange(false);
        toast.success("Guardado.");
      } catch {
        toast.error("No se pudo guardar. Intenta otra vez.");
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
            miembros={miembros}
            cuestaTiempo={cuestaTiempo}
            setCuestaTiempo={setCuestaTiempo}
            cuestaDinero={cuestaDinero}
            setCuestaDinero={setCuestaDinero}
          />

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
