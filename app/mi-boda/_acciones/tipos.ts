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
export const INVITA_META =
  "Agrupa lo que va junto en metas: ahorro, registro civil, ceremonia, recepción.";

/**
 * Solo en el Mapa, y una sola vez, cuando no hay ningún hito (§5.3, §8.1).
 *
 * Nombra el ejemplo porque es el primer sitio donde la pareja se encuentra el
 * concepto; en pantalla se llama "día clave" para que la etiqueta ya contenga
 * la definición y no haya que explicarla en cada aparición (§11.2).
 */
export const INVITA_HITO =
  "Marca tu día clave, la ceremonia civil, y verás cuánto falta.";

/**
 * El callejón del hito que es idea suelta: la casilla está marcada, no se ve
 * nada y nadie dice que falta la semana (docs/metas.md §5.3.1). Solo en el
 * Mapa: en el Camino ese hito no está dibujado.
 */
export const HITO_SIN_SEMANA = "Ponle una semana a tu día clave y verás cuánto falta.";

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

/**
 * Más ancho que el diálogo por defecto: los campos cortos van de a dos y no se
 * estira hacia abajo. La altura máxima y el scroll los pone el propio
 * DialogContent; el pie queda pegado abajo para que "Guardar" esté siempre a
 * la vista, aunque la lista sea larga.
 *
 * Vive aquí y no en el formulario porque lo usan los tres diálogos de una
 * acción: cambiarla, sus pagos y su orden.
 */
export const DIALOGO = "sm:max-w-lg";
export const PIE = "bg-popover sticky -bottom-4 -mx-4 mt-6 border-t px-4 pt-3 pb-4";

/**
 * La semana de una acción, como se lee al lado de su título
 * (docs/dependencias.md §3). Las mismas cuatro formas que el eje del Camino.
 */
export function etiquetaSemana(inicioSemanas: number | null) {
  if (inicioSemanas === null) return "sin semana";
  if (inicioSemanas === 0) return "la boda";
  return inicioSemanas > 0 ? `${inicioSemanas} sem` : `+${-inicioSemanas}`;
}

/** Los textos del diálogo del orden (docs/dependencias.md §3). */
export const ORDEN = {
  menu: "Qué va antes",
  titulo: "Antes y después de esto",
  descripcion:
    "Dos listas: lo que tiene que estar listo antes, y lo que espera a que esto esté.",
  antes: "Qué tiene que estar listo antes",
  despues: "Qué espera a que esto esté",
  vedadaAntes: "Esta ya te espera a ti.",
  vedadaDespues: "A esta la esperas tú.",
  nadaQueElegir: "Anota algo más y podrás poner el orden.",
  buscar: "Buscar entre las demás",
  sinResultados: "Ninguna se llama así.",
} as const;

/**
 * La barra de abajo del Camino, que es la vía táctil para manipular el
 * gráfico (docs/dependencias.md §10.2). Arrastrar no sirve con el dedo: a
 * 375 px una columna de semana mide 16.75 px.
 *
 * "Toca lo que no puede empezar antes de esto" es la misma frase que el asa
 * del escritorio: un solo concepto, una sola redacción.
 */
export const ELEGIDO = {
  antes: "Una semana antes",
  despues: "Una semana después",
  unir: "Unir con…",
  desunir: "Quitar unión",
  cerrar: "Dejar de elegir",
  cancelar: "Cancelar",
  pidiendoUnir: "Toca lo que no puede empezar antes de esto",
  pidiendoDesunir: "Toca el otro extremo de la unión que quieres soltar",
  nadaQueSoltar: "Esto no está unido a nada todavía.",
} as const;
