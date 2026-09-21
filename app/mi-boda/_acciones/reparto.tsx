"use client";

import type { Accion } from "@/db/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Miembro } from "./tipos";

const SIN_DUENO = "sin-dueno";

/**
 * Porcentajes enteros que suman 100 exactos.
 *
 * Redondear cada parte por su cuenta deja sumas de 99 o 101, y dos personas a
 * medias salen "50% y 51%". Se reparte el sobrante por resto mayor.
 */
function reparteCien(partes: number[]) {
  const total = partes.reduce((s, n) => s + n, 0);
  if (total <= 0) return partes.map(() => 0);
  const exactos = partes.map((n) => (n / total) * 100);
  const enteros = exactos.map(Math.floor);
  let sobra = 100 - enteros.reduce((s, n) => s + n, 0);
  const orden = exactos
    .map((n, i) => ({ i, resto: n - Math.floor(n) }))
    .sort((a, b) => b.resto - a.resto);
  for (const { i } of orden) {
    if (sobra <= 0) break;
    enteros[i] += 1;
    sobra -= 1;
  }
  return enteros;
}

type Cuenta = {
  id: string;
  nombre: string;
  imagen: string | null;
  total: number;
  pagado: number;
};

/**
 * Cuánto pone cada quien.
 *
 * Quien responde por una acción es quien la paga, así que el reparto sale
 * del responsable. Lo marcado como hecho cuenta como pagado; el resto es
 * plata comprometida que todavía no sale del bolsillo.
 */
export function Reparto({
  lista,
  miembros,
}: {
  lista: Accion[];
  miembros: Miembro[];
}) {
  const cuentas = new Map<string, Cuenta>();

  for (const a of lista) {
    const monto = a.monto ? Number(a.monto) : 0;
    if (monto <= 0) continue;
    const id = a.responsableId ?? SIN_DUENO;
    const quien = miembros.find((m) => m.id === id);
    const cuenta = cuentas.get(id) ?? {
      id,
      nombre: quien?.nombre ?? "Todavía nadie",
      imagen: quien?.imagen ?? null,
      total: 0,
      pagado: 0,
    };
    cuenta.total += monto;
    if (a.hecha) cuenta.pagado += monto;
    cuentas.set(id, cuenta);
  }

  if (cuentas.size === 0) return null;

  // Sin dueño va al final: es lo que falta repartir, no una persona.
  const filas = [...cuentas.values()].sort((a, b) =>
    a.id === SIN_DUENO ? 1 : b.id === SIN_DUENO ? -1 : b.total - a.total,
  );
  const total = filas.reduce((s, f) => s + f.total, 0);
  const soles = (n: number) => `S/ ${n.toLocaleString("es-PE")}`;
  const porcentaje = reparteCien(filas.map((f) => f.total));

  return (
    <section className="mb-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-lg">Quién pone cuánto</h2>
        <p className="text-muted-foreground text-sm">
          Paga quien responde por cada cosa.
        </p>
      </div>

      {/* Una barra, un trozo por persona: el reparto se ve antes de leerlo. */}
      <div className="bg-secondary mt-3 flex h-1.5 overflow-hidden rounded-full">
        {filas.map((f, i) => (
          <div
            key={f.id}
            style={{ width: `${(f.total / total) * 100}%` }}
            className={
              f.id === SIN_DUENO
                ? "bg-muted-foreground/25"
                : i === 0
                  ? "bg-primary"
                  : "bg-primary/45"
            }
          />
        ))}
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {filas.map((f, i) => (
          <div key={f.id} className="flex min-w-0 items-center gap-2">
            <Avatar className="size-5">
              {f.imagen && <AvatarImage src={f.imagen} alt="" />}
              <AvatarFallback className="text-[0.5rem]">
                {f.nombre.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {/* capitalize solo en personas: el correo llega en minúsculas,
                pero "Todavía Nadie" con las dos mayúsculas se lee mal. */}
            <dt
              className={`truncate text-sm ${
                f.id === SIN_DUENO ? "text-muted-foreground" : "capitalize"
              }`}
            >
              {f.id === SIN_DUENO ? f.nombre : f.nombre.split(" ")[0]}
            </dt>
            <dd className="text-sm tabular-nums">
              {soles(f.total)}
              <span className="text-muted-foreground">
                {" "}
                · {porcentaje[i]}%
                {f.pagado > 0 && ` · ${soles(f.pagado)} ya`}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
