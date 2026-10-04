import type { Estado, Momento } from "./acciones-servidor";

export type Miembro = { id: string; nombre: string; iniciales: string };

export const DESTINOS: { id: Momento; nombre: string }[] = [
  { id: "antes", nombre: "Antes" },
  { id: "el_dia", nombre: "El día" },
  { id: "despues", nombre: "Después" },
  { id: "idea", nombre: "Ideas sueltas" },
];

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
