"use client";

import type { Accion, Pago } from "@/db/schema";
import { AvatarPersona } from "@/components/avatar-persona";
import { soles, type Miembro } from "./tipos";

const POR_REPARTIR = "por-repartir";

type Cuenta = {
  id: string;
  nombre: string;
  iniciales: string;
  imagen?: string;
  total: number;
  hecho: number;
};

/**
 * Reparte un entero entre varias partes sin perder ni inventar unidades.
 *
 * Redondear cada parte por su cuenta no cuadra: los porcentajes suman 99 o
 * 101, y S/ 567.57 más S/ 247.57 se muestran como 568 y 248 bajo un total de
 * 815. Se reparte el sobrante por resto mayor.
 */
function reparte(partes: number[], objetivo: number) {
  const total = partes.reduce((s, n) => s + n, 0);
  if (total <= 0) return partes.map(() => 0);
  const exactos = partes.map((n) => (n / total) * objetivo);
  const enteros = exactos.map(Math.floor);
  let sobra = objetivo - enteros.reduce((s, n) => s + n, 0);
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

/**
 * Lo que va costando la boda, y cuánto puso cada quien.
 *
 * Paga quien responde por cada acción, así que el reparto sale del
 * responsable. El número grande es el de los dos: esto lleva la cuenta de un
 * bote común, no una deuda entre ustedes. Por eso el orden sigue al de los
 * miembros y no al monto: ordenar de mayor a menor haría un podio.
 */
export function Reparto({
  lista,
  miembros,
  pagos,
}: {
  lista: Accion[];
  miembros: Miembro[];
  pagos: Pago[];
}) {
  const cuentas = new Map<string, Cuenta>();

  for (const a of lista) {
    const monto = a.monto ? Number(a.monto) : 0;
    if (monto <= 0) continue;
    const id = a.responsableId ?? POR_REPARTIR;
    const quien = miembros.find((m) => m.id === id);
    const cuenta = cuentas.get(id) ?? {
      id,
      nombre: quien?.nombre ?? "Por repartir",
      iniciales: quien?.iniciales ?? "",
      imagen: quien?.imagen,
      total: 0,
      hecho: 0,
    };
    cuenta.total += monto;
    cuentas.set(id, cuenta);
  }

  // Lo pagado va por su cuenta: quien puso la plata quedó grabado en el pago,
  // y la acción puede haber cambiado de dueño después.
  for (const p of pagos) {
    const id = p.pagadoPorId ?? POR_REPARTIR;
    const cuenta = cuentas.get(id);
    if (cuenta) cuenta.hecho += Number(p.monto);
  }

  if (cuentas.size === 0) return null;

  const orden = miembros.map((m) => m.id);
  const filas = [...cuentas.values()].sort((a, b) => {
    if (a.id === POR_REPARTIR) return 1;
    if (b.id === POR_REPARTIR) return -1;
    return orden.indexOf(a.id) - orden.indexOf(b.id);
  });

  const total = filas.reduce((s, f) => s + f.total, 0);
  const hecho = filas.reduce((s, f) => s + f.hecho, 0);
  const crudos = filas.map((f) => f.total);
  const monto = reparte(crudos, Math.round(total));
  const porcentaje = reparte(crudos, 100);
  const juntos = miembros.length > 2 ? "Entre todos" : "Entre los dos";

  return (
    <section className="mb-7">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-display text-[1.75rem] leading-9">
          {soles(total)}
        </p>
        <h2 className="text-muted-foreground">
          {juntos}
          {hecho > 0 && `, ${soles(hecho)} ya pagados`}
        </h2>
      </div>

      {/* Un trozo por persona, del mismo color: es un bote, no una carrera. */}
      <div className="bg-secondary mt-3 flex h-1.5 overflow-hidden rounded-full">
        {filas.map((f, i) => (
          <div
            key={f.id}
            style={{ width: `${(f.total / total) * 100}%` }}
            className={
              f.id === POR_REPARTIR
                ? "bg-muted-foreground/20"
                : i === 0
                  ? "bg-primary"
                  : "bg-primary/50"
            }
          />
        ))}
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {filas.map((f, i) => (
          <div key={f.id} className="flex min-w-0 items-center gap-2">
            {f.id === POR_REPARTIR ? (
              <span className="bg-muted-foreground/20 size-2 rounded-full" />
            ) : (
              <AvatarPersona persona={f} className="size-6" />
            )}
            {/* capitalize solo en personas: el correo llega en minúsculas,
                pero "Por Repartir" con las dos mayúsculas se lee mal. */}
            <dt
              className={`truncate text-sm ${
                f.id === POR_REPARTIR ? "text-muted-foreground" : "capitalize"
              }`}
            >
              {f.id === POR_REPARTIR ? f.nombre : f.nombre.split(" ")[0]}
            </dt>
            <dd className="text-sm tabular-nums">
              {soles(monto[i])}
              <span className="text-muted-foreground"> · {porcentaje[i]}%</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
