"use client";

import { useState, useTransition } from "react";
import { CalendarHeart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { guardarFechaBoda } from "./acciones-servidor";
import { hoy } from "./tipos";

const largo = (fecha: string) => {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

/**
 * El día de la boda. Todo el diagrama se cuenta desde aquí, así que mover
 * esta fecha mueve el calendario entero sin tocar ninguna acción.
 */
export function FechaBoda({ fecha }: { fecha: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const [guardando, iniciar] = useTransition();

  function guardar(form: FormData) {
    const nueva = String(form.get("fecha") ?? "").trim();
    iniciar(async () => {
      try {
        await guardarFechaBoda(nueva || null);
        setAbierto(false);
        toast.success(nueva ? "Anotado." : "Fecha quitada.");
      } catch {
        toast.error("No se pudo guardar.");
      }
    });
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button variant={fecha ? "ghost" : "outline"} size="lg">
          <CalendarHeart className="size-4" />
          {fecha ? largo(fecha) : "Poner la fecha"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <form action={guardar} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="fecha-boda">El día</Label>
            <Input
              id="fecha-boda"
              name="fecha"
              type="date"
              defaultValue={fecha ?? hoy()}
            />
          </div>
          <p className="text-muted-foreground text-sm">
            El camino se cuenta desde aquí. Si la mueven, se mueve todo.
          </p>
          <Button type="submit" disabled={guardando} className="w-full">
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
