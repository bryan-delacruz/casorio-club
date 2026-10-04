"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { diaCorto } from "../_acciones/tipos";
import {
  asignarGasto,
  crearAccionConGasto,
  descartarGasto,
  desconectar,
  resolverFueraDeBernie,
  sincronizarAhora,
} from "./acciones-bernie";
import type { listarBandeja } from "./datos";

type Datos = NonNullable<Awaited<ReturnType<typeof listarBandeja>>>;
type Gasto = Datos["porAsignar"][number];
type Accion = Datos["acciones"][number];

const AVISOS: Record<string, { tipo: "ok" | "error"; texto: string }> = {
  conectado: { tipo: "ok", texto: "Bernie Wallet quedó conectada." },
  cancelado: { tipo: "error", texto: "No se conectó: cancelaste en Bernie." },
  flujo: { tipo: "error", texto: "La conexión expiró o empezó en otra pestaña. Vuelve a intentarlo." },
  bernie: { tipo: "error", texto: "Bernie no pudo completar la conexión. Vuelve a intentarlo." },
  no_disponible: { tipo: "error", texto: "La conexión con Bernie no está disponible aquí." },
};

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/** La acción cuyo título coincide con la subcategoría (sin mayúsculas ni tildes). */
function sugerida(gasto: Gasto, acciones: Accion[]) {
  if (!gasto.subcategoria) return undefined;
  const sub = normalizar(gasto.subcategoria);
  const candidatas = acciones.filter((a) => a.moneda === gasto.moneda);
  return (
    candidatas.find((a) => normalizar(a.titulo) === sub) ??
    candidatas.find((a) => normalizar(a.titulo).includes(sub) || sub.includes(normalizar(a.titulo)))
  )?.id;
}

const monto = (valor: string, moneda: string) =>
  `${moneda === "PEN" ? "S/" : moneda} ${Number(valor).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

const haceCuanto = (fecha: Date) => {
  const min = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
};

export function Bandeja({
  disponible,
  datos,
  conectadaPor,
  aviso,
}: {
  disponible: boolean;
  datos: Datos | null;
  conectadaPor: string | null;
  aviso: string | null;
}) {
  const [pendiente, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const yaAviso = useRef(false);
  const yaSincronizo = useRef(false);

  // El resultado de la vuelta desde Bernie llega por la URL: se avisa una vez y se limpia.
  useEffect(() => {
    if (!aviso || yaAviso.current) return;
    yaAviso.current = true;
    const a = AVISOS[aviso];
    if (a) (a.tipo === "ok" ? toast.success : toast.error)(a.texto);
    window.history.replaceState(null, "", "/mi-boda/bernie");
  }, [aviso]);

  // Red de seguridad si se perdió un webhook: al abrir, si pasó más de una hora.
  useEffect(() => {
    if (!datos?.desactualizada || yaSincronizo.current || datos.conexion?.estado === "revocada") return;
    yaSincronizo.current = true;
    startTransition(async () => {
      await sincronizarAhora().catch(() => null);
    });
  }, [datos]);

  if (!disponible || !datos) {
    return (
      <p className="border-border text-muted-foreground rounded-lg border border-dashed p-5 text-sm">
        La conexión con Bernie Wallet no está disponible en esta boda.
      </p>
    );
  }

  const { conexion } = datos;

  function sincronizar() {
    startTransition(async () => {
      const r = await sincronizarAhora();
      if (r.estado === "ok") toast.success(r.nuevos ? `${r.nuevos} gastos nuevos` : "Todo al día");
      else if (r.estado === "ocupado") toast("Ya se está sincronizando.");
      else if (r.estado === "revocada") toast.error("Bernie ya no da acceso. Vuelve a conectar.");
      else if (r.estado === "error") toast.error(r.mensaje);
    });
  }

  function confirmarDesconexion() {
    startTransition(async () => {
      const r = await desconectar();
      setConfirmando(false);
      if (r.revocadaEnBernie) toast.success("Bernie Wallet desconectada.");
      else toast.warning("Desconectada aquí. Revisa Apps conectadas en Bernie por si quedó el permiso.");
    });
  }

  return (
    <div className="space-y-10">
      <section className="border-border rounded-xl border p-5">
        {!conexion ? (
          <div className="space-y-4">
            <div>
              <h2 className="font-medium">Conectar con Bernie Wallet</h2>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                En Bernie eliges qué categorías compartir (por ejemplo, Matrimonio). Casorio solo
                ve la fecha, el monto, el comercio y la subcategoría. Todos los miembros de esta
                boda verán esos gastos.
              </p>
            </div>
            <Button size="lg" asChild>
              {/* <a> y no <Link>: es una redirección del servidor a otro sitio. */}
              <a href="/api/bernie/conectar">Conectar con Bernie Wallet</a>
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {/* min-w: sin espacio para texto y botones juntos, los botones bajan. */}
            <div className="min-w-64 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-medium whitespace-nowrap">Bernie Wallet</h2>
                {conexion.estado === "activa" && <Badge variant="secondary">Conectada</Badge>}
                {conexion.estado === "error" && <Badge variant="destructive">Con problemas</Badge>}
                {conexion.estado === "revocada" && <Badge variant="destructive">Sin acceso</Badge>}
              </div>
              <p className="text-muted-foreground mt-1 text-sm break-words">
                {conectadaPor ? `Conectó ${conectadaPor}` : "Conectada"}
                {conexion.ultimaSyncEl ? ` · al día ${haceCuanto(conexion.ultimaSyncEl)}` : ""}
              </p>
              {conexion.ultimoError && <p className="text-destructive mt-1 text-sm">{conexion.ultimoError}</p>}
            </div>
            <div className="flex gap-2">
              {conexion.estado === "revocada" ? (
                <Button asChild>
                  <a href="/api/bernie/conectar">Volver a conectar</a>
                </Button>
              ) : (
                <Button variant="outline" onClick={sincronizar} disabled={pendiente}>
                  {pendiente ? "Sincronizando…" : "Sincronizar"}
                </Button>
              )}
              <Button variant="ghost" onClick={() => setConfirmando(true)} disabled={pendiente}>
                Desconectar
              </Button>
            </div>
          </div>
        )}
      </section>

      {conexion && (
        <section>
          <h2 className="font-display text-xl">
            Por asignar{datos.porAsignar.length ? ` (${datos.porAsignar.length})` : ""}
          </h2>
          {datos.porAsignar.length === 0 ? (
            <p className="text-muted-foreground mt-3 text-sm">
              Nada pendiente. Cuando registres un gasto en una categoría compartida, aparecerá aquí.
            </p>
          ) : (
            <ul className="divide-border border-border mt-4 divide-y rounded-xl border">
              {datos.porAsignar.map((g) => (
                <FilaGasto key={g.id} gasto={g} acciones={datos.acciones} />
              ))}
            </ul>
          )}
        </section>
      )}

      {datos.fueraDeBernie.length > 0 && (
        <section>
          <h2 className="font-display text-xl">Ya no están en Bernie</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Se borraron o dejaron de compartirse en Bernie, pero ya los habías sumado como pago.
          </p>
          <ul className="divide-border border-border mt-4 divide-y rounded-xl border">
            {datos.fueraDeBernie.map((g) => (
              <FilaFuera key={g.id} gasto={g} />
            ))}
          </ul>
        </section>
      )}

      {datos.descartados.length > 0 && (
        <details className="text-sm">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer">
            Descartados ({datos.descartados.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {datos.descartados.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground truncate">
                  {diaCorto(g.fecha)} · {g.comercio} · {monto(g.monto, g.moneda)}
                </span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => startTransition(() => descartarGasto(g.id, false))}
                  disabled={pendiente}
                >
                  Recuperar
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Desconectar Bernie Wallet?</DialogTitle>
            <DialogDescription>
              Dejarán de llegar gastos y se vacía la bandeja. Los pagos que ya asignaste se quedan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmando(false)} disabled={pendiente}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarDesconexion} disabled={pendiente}>
              Desconectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilaGasto({ gasto, acciones }: { gasto: Gasto; acciones: Accion[] }) {
  // Lo que elige el usuario manda; si no eligió, la sugerencia se recalcula en
  // cada render (p. ej. al crear una acción que coincide desde otra fila).
  const [elegida, setAccionId] = useState<string | undefined>();
  const accionId = elegida ?? sugerida(gasto, acciones);
  const [pendiente, startTransition] = useTransition();
  const compatibles = acciones.filter((a) => a.moneda === gasto.moneda);

  // Las acciones devuelven { error } con un mensaje para el usuario; si algo
  // lanza, es un fallo inesperado y el mensaje es genérico.
  function correr(fn: () => Promise<{ error?: string } | void>, ok: string) {
    startTransition(async () => {
      try {
        const r = await fn();
        if (r?.error) toast.error(r.error);
        else toast.success(ok);
      } catch {
        toast.error("No se pudo. Intenta otra vez.");
      }
    });
  }

  // Dos líneas: arriba qué fue y cuánto, abajo qué hacer con él. En una sola
  // línea los controles dejaban al comercio en tres letras.
  return (
    <li className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium break-words">{gasto.comercio}</p>
          <p className="text-muted-foreground text-sm">
            {diaCorto(gasto.fecha)}
            {gasto.subcategoria ? ` · ${gasto.subcategoria}` : ""}
          </p>
        </div>
        {/* El monto es lo que importa al asignar: lleva la tipografía display. */}
        <p className="font-display shrink-0 text-xl tabular-nums">{monto(gasto.monto, gasto.moneda)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {compatibles.length > 0 && (
          <Select value={accionId} onValueChange={setAccionId} disabled={pendiente}>
            <SelectTrigger className="w-48" aria-label={`Acción para ${gasto.comercio}`}>
              <SelectValue placeholder="Elegir acción" />
            </SelectTrigger>
            <SelectContent>
              {compatibles.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.titulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          size="sm"
          disabled={!accionId || pendiente}
          onClick={() => {
            const destino = acciones.find((a) => a.id === accionId)?.titulo;
            correr(() => asignarGasto(gasto.id, accionId!), destino ? `Sumado a ${destino}.` : "Sumado como pago.");
          }}
        >
          Asignar
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pendiente}
          onClick={() => correr(() => crearAccionConGasto(gasto.id), "Acción creada con este pago.")}
        >
          Crear acción
        </Button>
        {/* Descartar es la salida, no una opción al mismo nivel: va aparte. */}
        <Button
          size="sm"
          variant="link"
          className="text-muted-foreground hover:text-foreground ml-auto px-1"
          disabled={pendiente}
          onClick={() => correr(() => descartarGasto(gasto.id, true), "Descartado. Puedes recuperarlo abajo.")}
        >
          Descartar
        </Button>
      </div>
    </li>
  );
}

function FilaFuera({ gasto }: { gasto: Gasto }) {
  const [pendiente, startTransition] = useTransition();
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{gasto.comercio}</p>
        <p className="text-muted-foreground text-sm">
          {diaCorto(gasto.fecha)} · {monto(gasto.monto, gasto.moneda)}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pendiente}
          onClick={() => startTransition(() => resolverFueraDeBernie(gasto.id, false))}
        >
          Mantener el pago
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pendiente}
          onClick={() => startTransition(() => resolverFueraDeBernie(gasto.id, true))}
        >
          Quitar el pago
        </Button>
      </div>
    </li>
  );
}
