"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
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
import { crearAccion, type Momento } from "./acciones-servidor";
import type { Miembro } from "./tarjeta-accion";

const SIN_RESPONSABLE = "sin-responsable";

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
    const titulo = String(form.get("titulo") ?? "").trim();
    if (!titulo) return;
    const responsable = String(form.get("responsable") ?? SIN_RESPONSABLE);
    const montoCrudo = String(form.get("monto") ?? "").trim();

    iniciar(async () => {
      try {
        await crearAccion({
          titulo,
          momento,
          cuestaTiempo,
          monto: cuestaDinero && montoCrudo ? montoCrudo : null,
          responsableId: responsable === SIN_RESPONSABLE ? null : responsable,
          notas: String(form.get("notas") ?? "").trim() || null,
        });
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
        <form action={enviar}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-normal">
              Algo que hacer
            </DialogTitle>
            <DialogDescription>Va a {etiqueta}.</DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="titulo">Qué hay que hacer</Label>
              <Input
                id="titulo"
                name="titulo"
                placeholder="Sacar la partida de nacimiento"
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
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="responsable">Quién responde</Label>
              <Select name="responsable" defaultValue={SIN_RESPONSABLE}>
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
              />
            </div>
          </div>

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
