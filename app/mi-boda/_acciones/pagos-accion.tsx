"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Accion, Pago } from "@/db/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { borrarPago, registrarPago } from "./acciones-servidor";
import { cuentaDe, diaCorto, hoy, soles, type Miembro } from "./tipos";

/**
 * Los pagos de una acción.
 *
 * Un adelanto no es un estado, es un hecho con fecha: al fotógrafo le dejas
 * algo al reservar y el resto después. Por eso aquí se anotan pagos sueltos
 * y el saldo sale de restarlos, en vez de editar un número "ya pagado".
 */
export function PagosAccion({
  accion,
  pagos,
  miembros,
  abierto,
  onAbiertoChange,
}: {
  accion: Accion;
  pagos: Pago[];
  miembros: Miembro[];
  abierto: boolean;
  onAbiertoChange: (v: boolean) => void;
}) {
  const [enviando, iniciar] = useTransition();
  const { total, pagado, falta } = cuentaDe(accion.monto, pagos);
  const nombre = (id: string | null) =>
    miembros.find((m) => m.id === id)?.nombre.split(" ")[0] ?? null;

  function anotar(form: FormData) {
    const monto = String(form.get("monto") ?? "").trim();
    const fecha = String(form.get("fecha") ?? "").trim();
    if (!monto || Number(monto) <= 0 || !fecha) return;

    iniciar(async () => {
      try {
        await registrarPago({
          accionId: accion.id,
          monto,
          fecha,
          nota: String(form.get("nota") ?? "").trim() || null,
        });
        toast.success("Anotado.");
      } catch {
        toast.error("No se pudo anotar. Intenta otra vez.");
      }
    });
  }

  function quitar(id: string) {
    iniciar(async () => {
      try {
        await borrarPago(id);
      } catch {
        toast.error("No se pudo borrar.");
      }
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-normal">
            {accion.titulo}
          </DialogTitle>
          <DialogDescription>
            {total > 0
              ? `Cuesta ${soles(total)}. Anota aquí cada vez que salga plata.`
              : "Esta acción no tiene monto. Ponle uno desde Cambiar."}
          </DialogDescription>
        </DialogHeader>

        {total > 0 && (
          <>
            <div className="mt-5 flex items-baseline justify-between gap-4">
              <p className="font-display text-2xl leading-8">
                {falta > 0 ? soles(falta) : "Todo pagado"}
              </p>
              <p className="text-muted-foreground text-sm">
                {pagado === 0
                  ? "sin pagar todavía"
                  : falta > 0
                    ? `falta · ${soles(pagado)} puestos de ${soles(total)}`
                    : `${soles(pagado)} en ${pagos.length} ${pagos.length === 1 ? "pago" : "pagos"}`}
              </p>
            </div>

            <div className="bg-secondary mt-2 h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full"
                style={{ width: `${Math.min((pagado / total) * 100, 100)}%` }}
              />
            </div>
          </>
        )}

        {pagos.length > 0 && (
          <ul className="mt-5 divide-y">
            {pagos.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="text-muted-foreground w-14 shrink-0 tabular-nums">
                  {diaCorto(p.fecha)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {p.nota || "Pago"}
                  {nombre(p.pagadoPorId) && (
                    <span className="text-muted-foreground capitalize">
                      {" "}
                      · {nombre(p.pagadoPorId)}
                    </span>
                  )}
                </span>
                <span className="tabular-nums">{soles(Number(p.monto))}</span>
                <button
                  type="button"
                  onClick={() => quitar(p.id)}
                  aria-label={`Borrar el pago de ${soles(Number(p.monto))}`}
                  className="text-muted-foreground/50 hover:text-destructive cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {total > 0 && (
          // key: al guardar, el formulario vuelve en blanco con el saldo nuevo.
          <form action={anotar} key={pagos.length} className="mt-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-24 flex-1 space-y-2">
                <Label htmlFor="monto">Cuánto</Label>
                <Input
                  id="monto"
                  name="monto"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  defaultValue={falta > 0 ? String(falta) : ""}
                  autoFocus
                  required
                />
              </div>
              <div className="min-w-32 flex-1 space-y-2">
                <Label htmlFor="fecha">Cuándo</Label>
                <Input
                  id="fecha"
                  name="fecha"
                  type="date"
                  defaultValue={hoy()}
                  required
                />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <Label htmlFor="nota">Qué fue</Label>
              <Input
                id="nota"
                name="nota"
                placeholder="Adelanto, saldo, la mitad…"
              />
            </div>

            <DialogFooter className="mt-6">
              <Button type="submit" disabled={enviando}>
                {enviando ? "Anotando…" : "Anotar pago"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
