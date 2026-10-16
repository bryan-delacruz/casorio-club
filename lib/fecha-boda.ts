/**
 * El día de la boda y cómo se cuenta (docs/fecha-de-la-boda.md). Puro: recibe
 * la fecha y el "hoy" de quien mira, para probarlo sin reloj ni React.
 *
 * `diasHasta` vivía en `lib/historia.ts` y se mudó aquí para que todo lo de la
 * fecha quede junto; allá se reexporta y los imports de siempre siguen valiendo.
 */

/** Días enteros entre hoy y la boda. Null sin fecha; negativo si ya pasó. */
export function diasHasta(fecha: string | null, hoy: string) {
  if (!fecha) return null;
  const dia = (s: string) => {
    const [a, m, d] = s.split("-").map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((dia(fecha) - dia(hoy)) / 86_400_000);
}

/**
 * Cuánto falta, dicho como se dice en voz alta. Null sin fecha.
 *
 * Más allá de dos meses se pasa a semanas: "faltan 400 días" es un número que
 * nadie se imagina, y el resto de la app ya cuenta en semanas.
 */
export function cuentaRegresiva(fecha: string | null, hoy: string): string | null {
  const dias = diasHasta(fecha, hoy);
  if (dias === null) return null;
  if (dias === 0) return "es hoy";
  if (dias === 1) return "es mañana";
  if (dias === -1) return "fue ayer";
  if (dias < 0) return `fue hace ${-dias} días`;
  if (dias > 60) return `faltan ${Math.round(dias / 7)} semanas`;
  return `faltan ${dias} días`;
}

/** "2026-03-05" → "5 de marzo de 2026". */
export function fechaLarga(fecha: string) {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
