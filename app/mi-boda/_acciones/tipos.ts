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

/**
 * Solo en el Mapa, y una sola vez, cuando no hay ningún hito (§5.3, §8.1).
 *
 * Nombra el ejemplo porque es el primer sitio donde la pareja se encuentra la
 * palabra: "hito" es la única del producto que no se entiende sola.
 */
export const INVITA_HITO =
  "Marca como hito el día que más importa, tu ceremonia civil, y verás cuánto falta.";

/**
 * El callejón del hito que es idea suelta: la casilla está marcada, no se ve
 * nada y nadie dice que falta la semana (docs/metas.md §5.3.1). Solo en el
 * Mapa: en el Camino ese hito no está dibujado.
 */
export const HITO_SIN_SEMANA = "Ponle una semana a tu hito y verás cuánto falta.";

/**
 * Cómo se nombra una dependencia que no se dibuja con flecha (docs/metas.md
 * §5). Una sola forma: el Mapa decía "necesita" y el Camino no decía nada.
 */
// Banda vacía, caso "todo hecho": sin felicitación, solo dice cómo está el camino.
export const BANDA_TODO_HECHO = "No queda nada por hacer en tu camino.";
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

// El formato del dinero vive con su aritmética, en `lib/pagos.ts`: los textos
// de la plata se prueban sin React. Se reexporta para no cambiar los imports.
export { soles } from "@/lib/pagos";

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
