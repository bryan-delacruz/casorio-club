import type { Estado } from "./acciones-servidor";

export type Miembro = { id: string; nombre: string; iniciales: string; imagen?: string };

/**
 * Los dos destinos reservados del Mapa: la bandeja de ideas sueltas y el
 * carril de lo que no es de ninguna meta.
 *
 * Son literales y no uuid a propósito (docs/metas.md §7): cualquier otro
 * destino es el id de una meta, así que el servidor distingue los tres casos
 * sin que el cliente le mande una estructura.
 */
export const IDEAS = "ideas-sueltas";
export const NOMBRE_IDEAS = "Ideas sueltas";
export const SIN_META = "sin-meta";
export const NOMBRE_SIN_META = "Sin meta";

/** El carril único de una boda que todavía no tiene ninguna meta (§7). */
export const TODO_LO_ANOTADO = "Todo lo anotado";

/**
 * La misma invitación en el Mapa y en el Camino cuando la boda no tiene
 * ninguna meta (docs/metas.md §5, §7). Compartida para que no se
 * desincronicen.
 */
export const INVITA_META = "Agrupa lo que va junto: crea una meta.";

/** Solo en el Mapa, y una sola vez, cuando no hay ningún hito (§5.3). */
export const INVITA_HITO = "Marca lo importante como hito y verás cuánto falta.";

/**
 * Cómo se nombra una dependencia que no se dibuja con flecha (docs/metas.md
 * §5). Una sola forma: el Mapa decía "necesita" y el Camino no decía nada.
 */
export const REQUIERE = "↳ requiere";

/**
 * A dónde se manda una tarjeta: el id de una meta, o uno de los dos
 * literales reservados (docs/metas.md §7).
 */
export type Destino = string;

/** Un carril del Mapa, tal como se lee en el menú "Mover a". */
export type Carril = { id: Destino; nombre: string; esMeta: boolean };

/** Hoy en formato YYYY-MM-DD, en la zona de quien mira. */
export function hoy() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/**
 * Cuánto se ha pagado de una acción y cuánto falta.
 *
 * `falta` nunca baja de cero: si pagaste de más, el saldo es cero y la
 * diferencia se ve en la lista de pagos, no como un número negativo.
 */
export function cuentaDe(monto: string | null, pagos: { monto: string }[]) {
  const total = monto ? Number(monto) : 0;
  const pagado = pagos.reduce((s, p) => s + Number(p.monto), 0);
  return { total, pagado, falta: Math.max(total - pagado, 0) };
}

export const soles = (n: number) =>
  `S/ ${Math.round(n).toLocaleString("es-PE")}`;

/** "5 mar" — el año sobra cuando la boda cabe en un año. */
export function diaCorto(fecha: string) {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "short",
  });
}

/** Los tres estados, en el orden en que se avanza. */
export const ESTADOS: { id: Estado; nombre: string }[] = [
  { id: "por_hacer", nombre: "Por hacer" },
  { id: "haciendo", nombre: "Haciendo" },
  { id: "hecho", nombre: "Hecho" },
];

/** El siguiente al tocar el círculo: por hacer, haciendo, hecho, y vuelta. */
export function siguienteEstado(actual: Estado): Estado {
  const i = ESTADOS.findIndex((e) => e.id === actual);
  return ESTADOS[(i + 1) % ESTADOS.length].id;
}

/** Lo mínimo de una meta que necesitan el formulario y las tarjetas. */
export type MetaLite = { id: string; titulo: string };
