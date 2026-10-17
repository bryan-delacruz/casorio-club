/**
 * Aritmética de los pagos (docs/pagos.md). Todo puro: recibe pagos y
 * miembros y devuelve números y textos cortos, para probarlo sin base ni
 * React.
 *
 * Lo que sale de un bolsillo se compara en céntimos enteros: sumar y restar
 * `numeric` en coma flotante arrastra medio céntimo, y medio céntimo es justo
 * la cifra del corte de la línea del desbalance (§4.2).
 */

/** Lo que necesita esta lógica de una fila de `pagos`. */
export type PagoLite = {
  id: string;
  monto: string;
  pagadoPorId: string | null;
  fecha: string;
  nota?: string | null;
  creadoEl?: Date | string | null;
};

/**
 * La clave del grupo sin pagador conocido, la misma que el Reparto ya
 * mostraba: un pago con `pagado_por_id = null` y uno de alguien que ya no es
 * miembro caen aquí (docs/pagos.md §7).
 */
export const POR_REPARTIR = "por-repartir";

/**
 * Soles redondeados, como los escribe toda la app. Vive aquí porque los
 * textos del dinero (`etiquetaDeDinero`) son puros y se prueban sin React;
 * `tipos.ts` lo reexporta para que la interfaz siga importándolo de siempre.
 */
export const soles = (n: number) => `S/ ${Math.round(n).toLocaleString("es-PE")}`;

/** "123.45" → 12345. Redondea porque el `numeric` llega como texto. */
export const aCentimos = (monto: string) => Math.round(Number(monto) * 100);

/**
 * Cuánto se ha pagado de una acción y cuánto falta.
 *
 * `falta` nunca baja de cero: si pagaste de más, el saldo es cero y la
 * diferencia se ve en la lista de pagos, no como un número negativo.
 */
export function cuentaDe(monto: string | null, pagos: { monto: string }[]) {
  const total = monto ? Number(monto) : 0;
  const pagado = pagos.reduce((s, p) => s + Number(p.monto), 0);
  const sinTotal = monto === null;
  return {
    /** El estimado: lo que la pareja cree que va a costar (docs/pagos.md §3.4). */
    total,
    /** Lo puesto: la suma de los pagos. */
    pagado,
    falta: Math.max(total - pagado, 0),
    sinTotal,
    /**
     * Lo que va costando: manda el estimado hasta que lo puesto lo pasa —o
     * no hay estimado—, porque esa plata ya salió (docs/pagos.md §4.3).
     * Es lo que suman todos los totales, y no se guarda.
     */
    costando: Math.max(total, pagado),
  };
}

/**
 * Reparte un entero entre varias partes sin perder ni inventar unidades.
 *
 * Redondear cada parte por su cuenta no cuadra: los porcentajes suman 99 o
 * 101, y S/ 567.57 más S/ 247.57 se muestran como 568 y 248 bajo un total de
 * 815. Se reparte el sobrante por resto mayor.
 */
export function reparte(partes: number[], objetivo: number) {
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
 * Un monto partido en `n` partes iguales, como montos de `numeric(12,2)`.
 *
 * Los céntimos que no dividen van de uno en uno a los primeros, así que la
 * suma de las partes es **exactamente** el monto y la misma operación da
 * siempre el mismo resultado (docs/pagos.md §3.2). Corre en el servidor: los
 * céntimos no pueden depender de quién sumó.
 */
export function partes(monto: string, n: number): string[] {
  if (n <= 0) return [];
  const total = aCentimos(monto);
  const base = Math.floor(total / n);
  const sobra = total - base * n;
  return Array.from({ length: n }, (_, i) =>
    ((base + (i < sobra ? 1 : 0)) / 100).toFixed(2),
  );
}

/**
 * Cuántos céntimos puso cada persona, en céntimos enteros.
 *
 * Se calcula sobre **todos** los pagos y no sobre los responsables: quien
 * puso plata sin responder por ninguna acción también cuenta, y antes su
 * pago desaparecía de la cuenta (docs/pagos.md §2). Lo anónimo y lo de quien
 * ya no es miembro se agrupa en `POR_REPARTIR`.
 */
export function repartoDePagos(
  pagos: PagoLite[],
  miembros: { id: string }[],
): Map<string, number> {
  const conocidos = new Set(miembros.map((m) => m.id));
  const puesto = new Map<string, number>();
  for (const p of pagos) {
    const id = p.pagadoPorId && conocidos.has(p.pagadoPorId) ? p.pagadoPorId : POR_REPARTIR;
    puesto.set(id, (puesto.get(id) ?? 0) + aCentimos(p.monto));
  }
  return puesto;
}

/**
 * Quién va por delante y quién por detrás de su parte de lo ya pagado.
 *
 * Con dos miembros la lectura natural es la resta directa ("puso S/ 401
 * más"); con tres o más se nombra solo a quienes van por debajo y cuánto les
 * falta (docs/pagos.md §4.2). Montos en soles, derivados de céntimos
 * enteros.
 */
export type Desbalance =
  | { tipo: "dos"; porDelante: string; porDetras: string; diferencia: number }
  | { tipo: "varios"; faltan: { id: string; falta: number }[] };

export function desbalance(
  puesto: Map<string, number>,
  miembros: { id: string }[],
): Desbalance | null {
  const n = miembros.length;
  if (n < 2) return null;

  // Lo anónimo no se reparte entre nadie: adivinar quién lo puso inventaría
  // el número que la línea vende como exacto, y subiría la parte de todos.
  const centimos = miembros.map((m) => puesto.get(m.id) ?? 0);
  const conocido = centimos.reduce((s, c) => s + c, 0);
  if (conocido <= 0) return null;

  // La falta de cada uno es `(conocido - n · puesto) / n`. Se compara sin
  // dividir, en enteros, para que la parte con céntimos no cuadrados no mueva
  // el corte.
  //
  // El único corte es de 50 céntimos, y no es un juicio de producto: desde ahí
  // `soles()` deja de escribir "S/ 0", y "puso S/ 0 más" sería falso
  // (docs/pagos.md §4.2). Por eso va aquí dentro y no en una constante.
  const escalada = centimos.map((c) => conocido - n * c);
  const minimo = 50 * n;
  if (!escalada.some((e) => e >= minimo)) return null;

  if (n === 2) {
    const [a, b] = centimos;
    const delante = a >= b ? 0 : 1;
    return {
      tipo: "dos",
      porDelante: miembros[delante].id,
      porDetras: miembros[1 - delante].id,
      diferencia: Math.abs(a - b) / 100,
    };
  }

  const faltan = miembros
    .map((m, i) => ({ id: m.id, escalada: escalada[i] }))
    .filter((f) => f.escalada >= minimo)
    .sort((x, y) => y.escalada - x.escalada)
    .map((f) => ({ id: f.id, falta: f.escalada / n / 100 }));
  return { tipo: "varios", faltan };
}

/** Orden de la lista de pagos de una acción: por día y, a igualdad, por llegada. */
const porDia = (a: PagoLite, b: PagoLite) =>
  a.fecha.localeCompare(b.fecha) ||
  new Date(a.creadoEl ?? 0).getTime() - new Date(b.creadoEl ?? 0).getTime();

/** "1.er pago", "2.º pago": el ordinal como lo escribe el español. */
const ordinal = (n: number) => (n === 1 ? "1.er" : `${n}.º`);

/**
 * Cómo se llama un pago en la lista (docs/pagos.md §3.3).
 *
 * La nota manda siempre: si la pareja escribió "Adelanto", se lee
 * "Adelanto". Sin nota, el número sale de la posición en el tiempo y no de
 * una columna: borrar el primero renumera los demás, que es correcto porque
 * el número solo describe el orden de lo que se ve. Con un solo pago no hay
 * número que informe.
 */
export function etiquetaDePago(pagos: PagoLite[], pago: PagoLite): string {
  if (pago.nota?.trim()) return pago.nota.trim();
  if (pagos.length <= 1) return "Pago";
  const i = [...pagos].sort(porDia).findIndex((p) => p.id === pago.id);
  if (i === -1) return "Pago";
  return `${ordinal(i + 1)} pago`;
}

/**
 * Los pagos de la boda agrupados por acción.
 *
 * Lo necesitan el Reparto, el Mapa y el Camino, que reciben los pagos
 * planos: se arma una vez aquí y no tres veces en tres componentes.
 */
export function pagosPorAccion<T extends { accionId: string }>(pagos: T[]): Map<string, T[]> {
  const porAccion = new Map<string, T[]>();
  for (const p of pagos) {
    const lote = porAccion.get(p.accionId) ?? [];
    lote.push(p);
    porAccion.set(p.accionId, lote);
  }
  return porAccion;
}

/** Lo que la tarjeta necesita de una acción para hablar de su plata. */
export type AccionConDinero = {
  monto: string | null;
  estado: "por_hacer" | "haciendo" | "hecho";
};

/**
 * Lo que dice la tarjeta sobre la plata de una acción, o null cuando no hay
 * nada que decir y tampoco se dibuja la 💰 (docs/pagos.md §3.4).
 *
 * Las palabras viven aquí y no en el JSX para poder probar los cuatro
 * cuadrantes de la tabla de la spec. El estado viaja en la acción pero no
 * entra en la cuenta: ni "hecho" dice que no queda plata por salir, ni el
 * saldo en cero dice que la gestión esté hecha.
 */
export function etiquetaDeDinero(
  accion: AccionConDinero,
  pagos: { monto: string }[],
): string | null {
  const { total, pagado, sinTotal } = cuentaDe(accion.monto, pagos);
  // Sin plata por ningún lado no es un gasto. Un monto en cero tampoco:
  // la 💰 sale solo cuando hay plata de verdad.
  if (total <= 0 && pagado <= 0) return null;
  // Sin estimado, "hasta ahora" marca que la cuenta sigue abierta, esté la
  // acción hecha o no: pagar y terminar son ejes independientes, hay cosas que
  // se pagan por adelantado (docs/pagos.md §3.5). Cerrar la cuenta la hace la
  // pareja escribiendo el total.
  if (sinTotal || total <= 0) return `${soles(pagado)} puestos hasta ahora`;
  if (pagado === 0) return `${soles(total)} estimado`;
  // Una sola plantilla para los tres casos con los dos números: a medias,
  // completo y pasado. Ni el saldo ni el exceso se nombran, porque se deducen
  // de los dos números (docs/pagos.md §3.4).
  return `${soles(pagado)} puestos de ${soles(total)}`;
}
