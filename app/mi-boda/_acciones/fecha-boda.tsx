"use client";

import { useId, useState, useTransition } from "react";
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
import { cuentaRegresiva, fechaLarga } from "@/lib/fecha-boda";
import { guardarFechaBoda } from "./acciones-servidor";
import { hoy } from "./tipos";

const mayuscula = (texto: string) => texto[0].toUpperCase() + texto.slice(1);

/**
 * El día de la boda, único control de la app (docs/fecha-de-la-boda.md §4.1).
 * Todo el diagrama se cuenta desde aquí, así que mover esta fecha mueve el
 * calendario entero sin tocar ninguna acción.
 *
 * `cuenta` llega hecha desde el servidor: en el cliente "hoy" puede caer en
 * otro día que en el render y la hidratación avisaría.
 */
export function FechaBoda({
  fecha,
  cuenta,
}: {
  fecha: string | null;
  cuenta: string | null;
}) {
  // El control se monta dos veces (celular y escritorio) y solo una se ve:
  // el id tiene que ser distinto para que la etiqueta apunte a su campo.
  const idCampo = useId();
  const [abierto, setAbierto] = useState(false);
  const [guardando, iniciar] = useTransition();

  function guardar(form: FormData) {
    const nueva = String(form.get("fecha") ?? "").trim();
    iniciar(async () => {
      const r = await guardarFechaBoda(nueva || null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setAbierto(false);
      const dicho = cuentaRegresiva(nueva || null, hoy());
      const atras = r.yaPasaron ?? 0;
      toast.success(
        dicho ? `Anotado. ${mayuscula(dicho)}.` : "Fecha quitada. Las semanas siguen, los días no.",
        // Informa y nada más: no se reprograma ni se marca nada (§4.4).
        atras > 0
          ? {
              description: `${atras} ${atras === 1 ? "cosa quedó" : "cosas quedaron"} en una semana que ya pasó.`,
            }
          : undefined,
      );
    });
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button variant={fecha ? "ghost" : "outline"} size="lg">
          <CalendarHeart className="size-4" />
          {/* En el celular la fecha larga no cabe: queda la cuenta, y la
              fecha entera se lee al abrir el popover. */}
          {fecha ? (
            <>
              <span className="max-sm:hidden">
                {fechaLarga(fecha)}
                {cuenta && ` · ${cuenta}`}
              </span>
              <span className="sm:hidden">{cuenta ?? fechaLarga(fecha)}</span>
            </>
          ) : (
            "Poner la fecha"
          )}
        </Button>
      </PopoverTrigger>
      {/* El disparador vive pegado al borde derecho en el celular: sin margen
          de colisión el panel de 288 px acaba al ras del viewport. */}
      <PopoverContent align="end" collisionPadding={8} className="w-72">
        <form action={guardar} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor={idCampo}>El día</Label>
            <Input
              id={idCampo}
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
