/**
 * Contrato v1 de la API de Bernie (docs/api/openapi.json en Bernie Wallet).
 * Se valida la respuesta en tiempo de ejecución: si Bernie cambiara algo sin
 * versionar, la sync falla con un error claro en vez de guardar datos raros.
 */
export type GastoCompartido = {
  id: string;
  occurredAt: string;
  amount: string;
  currency: string;
  merchant: string;
  subcategory: string | null;
};

export type PaginaSync = {
  added: GastoCompartido[];
  modified: GastoCompartido[];
  removed: string[];
  nextCursor: string;
  hasMore: boolean;
};

export type CodigoProblema =
  | "invalid_request"
  | "unauthorized"
  | "not_connected"
  | "cursor_reset"
  | "rate_limited"
  | "unavailable"
  | "internal";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTO = /^-?\d+\.\d{2}$/;
const MONEDA = /^[A-Z]{3}$/;

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function validarGasto(v: unknown, ruta: string, errores: string[]) {
  if (!esObjeto(v)) return errores.push(`${ruta}: no es objeto`);
  if (typeof v.id !== "string" || !UUID.test(v.id)) errores.push(`${ruta}.id`);
  if (typeof v.occurredAt !== "string" || Number.isNaN(Date.parse(v.occurredAt))) errores.push(`${ruta}.occurredAt`);
  if (typeof v.amount !== "string" || !MONTO.test(v.amount)) errores.push(`${ruta}.amount`);
  if (typeof v.currency !== "string" || !MONEDA.test(v.currency)) errores.push(`${ruta}.currency`);
  if (typeof v.merchant !== "string") errores.push(`${ruta}.merchant`);
  if (v.subcategory !== null && typeof v.subcategory !== "string") errores.push(`${ruta}.subcategory`);
}

/** Devuelve la página tipada, o la lista de campos que no cumplen el contrato. */
export function validarPagina(v: unknown): { ok: true; pagina: PaginaSync } | { ok: false; errores: string[] } {
  const errores: string[] = [];
  if (!esObjeto(v)) return { ok: false, errores: ["$: no es objeto"] };
  for (const lista of ["added", "modified"] as const) {
    if (!Array.isArray(v[lista])) errores.push(`$.${lista}`);
    else v[lista].forEach((g, i) => validarGasto(g, `$.${lista}[${i}]`, errores));
  }
  if (!Array.isArray(v.removed) || !v.removed.every((id) => typeof id === "string" && UUID.test(id))) {
    errores.push("$.removed");
  }
  if (typeof v.nextCursor !== "string" || !v.nextCursor) errores.push("$.nextCursor");
  if (typeof v.hasMore !== "boolean") errores.push("$.hasMore");
  return errores.length ? { ok: false, errores } : { ok: true, pagina: v as PaginaSync };
}

/** Lee el `code` de un Problem Details (RFC 9457); si no es uno, `internal`. */
export function codigoProblema(v: unknown): CodigoProblema {
  const codigos: CodigoProblema[] = ["invalid_request", "unauthorized", "not_connected", "cursor_reset", "rate_limited", "unavailable", "internal"];
  return esObjeto(v) && codigos.includes(v.code as CodigoProblema) ? (v.code as CodigoProblema) : "internal";
}

/**
 * Qué significa un fallo del token endpoint de Bernie (OAuth de Supabase, que
 * responde { error_code, msg }):
 * - "red": caída o límite (5xx, 429) → reintentar más tarde, la conexión sigue;
 * - "internal": credenciales del cliente (secreto mal configurado) → error de
 *   configuración, no culpa del usuario;
 * - "invalid_grant": el refresh token ya no sirve (revocado, vencido o rotado).
 */
export function clasificarErrorToken(
  status: number,
  cuerpo: Record<string, unknown> | null,
): "red" | "internal" | "invalid_grant" {
  if (status >= 500 || status === 429) return "red";
  const codigo = cuerpo?.error_code ?? cuerpo?.error;
  if (codigo === "invalid_credentials" || codigo === "invalid_client") return "internal";
  return "invalid_grant";
}
