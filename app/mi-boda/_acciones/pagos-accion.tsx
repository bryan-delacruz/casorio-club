"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Accion, Pago } from "@/db/schema";
import { AvatarPersona } from "@/components/avatar-persona";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cuentaDe, etiquetaDePago, POR_REPARTIR, UMBRAL_DE_MAS } from "@/lib/pagos";
import { borrarPago, ponerTotal, registrarPago, registrarPagoRepartido } from "./acciones-servidor";
import { diaCorto, hoy, soles, type Miembro } from "./tipos";

/**
 * Los pagos de una acción.
 *
 * Un adelanto no es un estado, es un hecho con fecha: al fotógrafo le dejas
 * algo al reservar y el resto después. Por eso aquí se anotan pagos sueltos
 * y el saldo sale de restarlos, en vez de editar un número "ya pagado".
 *
 * Quién gestiona y quién paga son dos cosas distintas (docs/pagos.md §1.0):
 * "Quién puso" llega con el responsable ya elegido, pero es una pregunta
 * abierta y se puede cambiar.
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
  // Null = la fila de fichas está cerrada. Solo aparece con tres o más
  // miembros: con dos no hay a quién elegir (docs/pagos.md §3.2).
  const [elegidos, setElegidos] = useState<string[] | null>(null);
  const { total, pagado, falta, deMas } = cuentaDe(accion.monto, pagos);
  // Sin pagador conocido se lee "Por repartir", la misma etiqueta del
  // selector y del Reparto: quien salió de la boda deja su pago aquí
  // (docs/pagos.md §7). El capitalize solo va en las personas, porque "Por
  // Repartir" con las dos mayúsculas se lee mal.
  const nombre = (id: string | null) => miembros.find((m) => m.id === id)?.nombre.split(" ")[0];
  const hayVarios = miembros.length >= 3;

  function datosDelFormulario(form: FormData) {
    const monto = String(form.get("monto") ?? "").trim();
    const fecha = String(form.get("fecha") ?? "").trim();
    const nota = String(form.get("nota") ?? "").trim() || null;
    return { monto, fecha, nota, valido: !!monto && Number(monto) > 0 && !!fecha };
  }

  function anotar(form: FormData) {
    const { monto, fecha, nota, valido } = datosDelFormulario(form);
    if (!valido) return;
    const quien = String(form.get("pagadoPor") ?? POR_REPARTIR);

    iniciar(async () => {
      const r = await registrarPago({
        accionId: accion.id,
        monto,
        fecha,
        nota,
        pagadoPorId: quien === POR_REPARTIR ? null : quien,
      }).catch(() => ({ error: "No se pudo anotar. Intenta otra vez." }));
      if (r?.error) return void toast.error(r.error);
      toast.success("Anotado.");
    });
  }

  /**
   * El atajo: una fila por persona elegida. El selector "Quién puso" se
   * ignora, y los céntimos los parte el servidor para que la misma operación
   * dé siempre el mismo resultado (docs/pagos.md §3.2).
   */
  function repartir(form: FormData) {
    const { monto, fecha, nota, valido } = datosDelFormulario(form);
    if (!valido) return;
    const ids = elegidos ?? miembros.map((m) => m.id);
    if (ids.length < 2) return;

    iniciar(async () => {
      const r = await registrarPagoRepartido(accion.id, ids, monto, fecha, nota).catch(() => ({
        error: "No se pudo repartir. Intenta otra vez.",
      }));
      if (r?.error) return void toast.error(r.error);
      setElegidos(null);
      toast.success("Repartido.");
    });
  }

  /** La invitación: escribe el total y nada más; no bloquea ni valida (§3.5). */
  function guardarTotal(form: FormData) {
    const monto = String(form.get("total") ?? "").trim();
    if (!monto) return;
    iniciar(async () => {
      const r = await ponerTotal(accion.id, monto).catch(() => ({
        error: "No se pudo guardar. Intenta otra vez.",
      }));
      if (r?.error) return void toast.error(r.error);
      toast.success("Guardado.");
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

  const descripcion =
    total > 0
      ? `Calculas ${soles(total)}. Anota aquí cada vez que salga plata.`
      : pagos.length === 0
        ? "Todavía no sabes cuánto cuesta. Anota lo que vayas pagando y el total se irá sumando."
        : null;

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      {/* Sin descripción, aria-describedby={undefined} explícito evita el aviso
          de Radix por un DialogDescription que no existe. */}
      <DialogContent
        {...(descripcion ? {} : { "aria-describedby": undefined })}
      >
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-normal">
            {accion.titulo}
          </DialogTitle>
          {/* "Calculas" y no "cuesta": el monto es lo que la pareja cree que
              va a costar, no un hecho (docs/pagos.md §3.4). Sin monto y sin
              pagos se invita a anotar; con pagos el número grande y la
              invitación de abajo ya lo cuentan, y repetirlo sería ruido. */}
          {descripcion && (
            <DialogDescription>
              {descripcion}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Sin total el número grande es lo puesto y no hay barra: no hay nada
            que llenar (docs/pagos.md §3.4). */}
        {total <= 0 && pagado > 0 && (
          <div className="mt-5 flex items-baseline justify-between gap-4">
            <p className="font-display text-2xl leading-8">{soles(pagado)}</p>
            <p className="text-muted-foreground text-sm">puestos hasta ahora</p>
          </div>
        )}

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
                    : deMas >= UMBRAL_DE_MAS
                      ? // Lo de más se dice donde pasó, y solo desde el umbral.
                        `${soles(pagado)} puestos · ${soles(deMas)} más de lo calculado`
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
                  {/* Sin nota, el número sale del orden; tres filas que dicen
                      "Pago" no se distinguen (docs/pagos.md §3.3). */}
                  {etiquetaDePago(pagos, p)}
                  <span
                    className={`text-muted-foreground ${nombre(p.pagadoPorId) ? "capitalize" : ""}`}
                  >
                    {" "}
                    · {nombre(p.pagadoPorId) ?? "Por repartir"}
                  </span>
                  {p.deBernie && (
                    <span className="bg-secondary text-secondary-foreground ml-2 rounded-full px-2 py-0.5 text-xs">
                      de Bernie
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

        {/* Mientras no haya total y sí pagos: la pareja descubre el total justo
            al último pago. Es un form aparte y no anida en el de anotar. Se va
            sola al haber total (docs/pagos.md §3.5). */}
        {total <= 0 && pagos.length > 0 && (
          <form action={guardarTotal} className="bg-muted/50 mt-4 space-y-3 rounded-lg p-3">
            <p className="text-sm">
              ¿Ya sabes cuánto fue en total? Escríbelo y verás si queda algo por pagar.
            </p>
            <div className="flex items-end gap-3">
              <div className="min-w-24 flex-1 space-y-2">
                <Label htmlFor="total">Cuánto (S/)</Label>
                <Input
                  id="total"
                  name="total"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  required
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                className="relative before:absolute before:inset-x-0 before:-top-1.5 before:-bottom-1.5 before:content-['']"
                disabled={enviando}
              >
                Guardar
              </Button>
            </div>
          </form>
        )}

        {/* El formulario se dibuja siempre, también sin monto: es la única
            puerta para empezar a pagar algo cuyo total no se sabe (§3.4). La
            key: al guardar, vuelve en blanco con el saldo nuevo. */}
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
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-32 flex-1 space-y-2">
              <Label htmlFor="pagadoPor">Quién puso</Label>
              {/* "Por repartir" y no "Sin decidir": es la etiqueta que el
                  Reparto ya usa para ese grupo (docs/pagos.md §3.1). */}
              <Select
                name="pagadoPor"
                defaultValue={accion.responsableId ?? POR_REPARTIR}
              >
                <SelectTrigger id="pagadoPor" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {miembros.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nombre}
                    </SelectItem>
                  ))}
                  <SelectItem value={POR_REPARTIR}>Por repartir</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-32 flex-1 space-y-2">
              <Label htmlFor="nota">Qué fue</Label>
              <Input
                id="nota"
                name="nota"
                placeholder="Adelanto, saldo, la mitad…"
              />
            </div>
          </div>

          {/* A quiénes se reparte: fichas conmutables con el mismo avatar de
              siempre. Envuelven a 375 px en vez de hacer scroll. */}
          {elegidos && (
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-3">
              {miembros.map((m) => {
                const marcado = elegidos.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={marcado}
                    onClick={() =>
                      setElegidos(
                        marcado
                          ? elegidos.filter((id) => id !== m.id)
                          : [...elegidos, m.id],
                      )
                    }
                    // El pseudo-elemento sube el área de toque a 44 px sin
                    // separar las fichas, igual que en "Antes/El día/Después".
                    className="focus-visible:ring-ring relative flex cursor-pointer items-center gap-2 rounded-full text-sm outline-none before:absolute before:inset-x-0 before:-top-1.5 before:-bottom-1.5 before:content-[''] focus-visible:ring-2"
                  >
                    <AvatarPersona
                      persona={m}
                      className={marcado ? "ring-primary size-8 ring-2" : "size-8 opacity-40"}
                    />
                    <span className={marcado ? "capitalize" : "text-muted-foreground capitalize"}>
                      {m.nombre.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <DialogFooter className="mt-6">
            {/* Con dos miembros no hay nada que elegir: reparte y listo. Con
                tres o más, el primer toque abre las fichas. */}
            {miembros.length >= 2 &&
              (hayVarios && !elegidos ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setElegidos(miembros.map((m) => m.id))}
                >
                  Repartir
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="outline"
                  className="relative before:absolute before:inset-x-0 before:-top-1.5 before:-bottom-1.5 before:content-['']"
                  formAction={repartir}
                  disabled={enviando || (elegidos !== null && elegidos.length < 2)}
                >
                  {elegidos ? `Repartir entre ${elegidos.length}` : "Repartir"}
                </Button>
              ))}
            <Button type="submit" disabled={enviando}>
              {enviando ? "Anotando…" : "Anotar pago"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
