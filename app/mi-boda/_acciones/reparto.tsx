"use client";

import type { Accion, Pago } from "@/db/schema";
import { AvatarPersona } from "@/components/avatar-persona";
import { desbalance, POR_REPARTIR, reparte, repartoDePagos } from "@/lib/pagos";
import { soles, type Miembro } from "./tipos";

type Cuenta = {
  id: string;
  nombre: string;
  iniciales: string;
  imagen?: string;
  total: number;
  hecho: number;
};

/** El nombre de pila, que es como se nombra a la gente en toda la app. */
const pila = (nombre: string) => nombre.split(" ")[0];

/**
 * Lo que va costando la boda, y cuánto puso cada quien.
 *
 * El desglose dice **de qué responde cada uno** (suma de montos por
 * responsable); la línea del final dice **quién ha puesto plata** (suma de
 * pagos por pagador). Son dos números distintos y no se mezclan en la misma
 * fila (docs/pagos.md §1.0).
 *
 * El número grande es el de los dos: esto lleva la cuenta de un bote común,
 * no una deuda entre ustedes. Por eso el orden sigue al de los miembros y no
 * al monto: ordenar de mayor a menor haría un podio.
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
  const fila = (id: string) => {
    const quien = miembros.find((m) => m.id === id);
    const cuenta = cuentas.get(id) ?? {
      id,
      nombre: quien?.nombre ?? "Por repartir",
      iniciales: quien?.iniciales ?? "",
      imagen: quien?.imagen,
      total: 0,
      hecho: 0,
    };
    cuentas.set(id, cuenta);
    return cuenta;
  };

  for (const a of lista) {
    const monto = a.monto ? Number(a.monto) : 0;
    if (monto <= 0) continue;
    fila(a.responsableId ?? POR_REPARTIR).total += monto;
  }

  // Lo pagado va por su cuenta y se reparte sobre TODOS los pagos: quien puso
  // la plata quedó grabado en el pago, la acción puede haber cambiado de dueño
  // después, y quien pagó sin responder por nada también tiene fila — antes su
  // pago se perdía de la cuenta (docs/pagos.md §2).
  const puesto = repartoDePagos(pagos, miembros);
  for (const [id, centimos] of puesto) fila(id).hecho += centimos / 100;

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
  const nombreDe = (id: string) => pila(miembros.find((m) => m.id === id)?.nombre ?? "");
  const d = desbalance(puesto, miembros);

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

      {/* Un trozo por persona, del mismo color: es un bote, no una carrera.
          Sin ningún monto no hay nada que repartir y la barra queda vacía. */}
      <div className="bg-secondary mt-3 flex h-1.5 overflow-hidden rounded-full">
        {filas.map((f, i) => (
          <div
            key={f.id}
            style={{ width: total > 0 ? `${(f.total / total) * 100}%` : "0%" }}
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
              {f.id === POR_REPARTIR ? f.nombre : pila(f.nombre)}
            </dt>
            <dd className="text-sm tabular-nums">
              {soles(monto[i])}
              <span className="text-muted-foreground"> · {porcentaje[i]}%</span>
            </dd>
          </div>
        ))}
      </dl>

      {/* Quién ha puesto plata, que es otra pregunta que el desglose no
          contesta (docs/pagos.md §4.2). Sin "debe", sin rojo y sin podio: el
          consejo es condicional y se puede ignorar. */}
      {d && (
        <p className="text-muted-foreground mt-3 text-sm">
          {d.tipo === "dos" ? (
            <>
              <span className="capitalize">{nombreDe(d.porDelante)}</span> puso{" "}
              {soles(d.diferencia)} más que{" "}
              <span className="capitalize">{nombreDe(d.porDetras)}</span>. Si quieren ir
              parejos, los próximos {soles(d.diferencia)} los pone{" "}
              <span className="capitalize">{nombreDe(d.porDetras)}</span>.
            </>
          ) : (
            <>
              Para ir parejos, faltan{" "}
              {d.faltan.map((f, i) => (
                <span key={f.id}>
                  {i > 0 && (i === d.faltan.length - 1 ? " y " : ", ")}
                  {soles(f.falta)} de <span className="capitalize">{nombreDe(f.id)}</span>
                </span>
              ))}
              .
            </>
          )}
        </p>
      )}
    </section>
  );
}
