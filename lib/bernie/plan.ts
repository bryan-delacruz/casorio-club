import type { GastoCompartido, PaginaSync } from "./contrato.ts";

/**
 * Qué hacer con una página de cambios de Bernie (docs/integracion-bernie.md §6.3).
 * Función pura: recibe lo que ya hay en la bandeja y devuelve las operaciones,
 * así la regla se prueba sin base de datos.
 */
export type GastoEntrante = {
  externoId: string;
  fecha: string;
  monto: string;
  moneda: string;
  comercio: string;
  subcategoria: string | null;
};

export type Plan = {
  /** Insertar o actualizar en la bandeja (added + modified). */
  guardar: GastoEntrante[];
  /** Gastos ya asignados cuyo pago debe seguir a Bernie (monto y fecha). */
  actualizarPagos: { pagoId: string; monto: string; fecha: string }[];
  /** Sin asignar y ya no están en Bernie: se borran de la bandeja. */
  borrar: string[];
  /** Asignados y ya no están en Bernie: se conservan con aviso. */
  marcarFuera: string[];
};

const diaLima = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** El día del gasto en Lima: un consumo a las 9 p. m. no debe caer al día siguiente (UTC). */
export function fechaLima(iso: string): string {
  return diaLima.format(new Date(iso));
}

function entrante(g: GastoCompartido): GastoEntrante {
  return {
    externoId: g.id,
    fecha: fechaLima(g.occurredAt),
    monto: g.amount,
    moneda: g.currency,
    comercio: g.merchant,
    subcategoria: g.subcategory,
  };
}

export function planificar(
  pagina: PaginaSync,
  /** Bandeja actual de la boda: externoId → pagoId (null = sin asignar). */
  existentes: Map<string, string | null>,
): Plan {
  // La ventana de relectura de Bernie puede repetir un gasto en la misma
  // página; el último gana.
  const porId = new Map<string, GastoEntrante>();
  for (const g of [...pagina.added, ...pagina.modified]) porId.set(g.id, entrante(g));
  const guardar = [...porId.values()];

  const actualizarPagos = guardar.flatMap((g) => {
    const pagoId = existentes.get(g.externoId);
    return pagoId ? [{ pagoId, monto: g.monto, fecha: g.fecha }] : [];
  });

  const borrar: string[] = [];
  const marcarFuera: string[] = [];
  for (const id of new Set(pagina.removed)) {
    if (porId.has(id) || !existentes.has(id)) continue; // nunca lo vimos: se ignora
    if (existentes.get(id)) marcarFuera.push(id);
    else borrar.push(id);
  }

  return { guardar, actualizarPagos, borrar, marcarFuera };
}
