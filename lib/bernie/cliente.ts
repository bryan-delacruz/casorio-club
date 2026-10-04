import "server-only";
import { configBernie } from "./config";
import { codigoProblema, validarPagina, type CodigoProblema, type PaginaSync } from "./contrato";

/**
 * Llamadas HTTP a Bernie: el token endpoint de su OAuth 2.1 (Supabase) y su
 * API v1. Ninguna función de aquí toca la base de Casorio.
 */
const TIEMPO_MAXIMO_MS = 15_000;

export type Tokens = { accessToken: string; refreshToken: string | null };

export class ErrorBernie extends Error {
  constructor(
    public readonly codigo: CodigoProblema | "invalid_grant" | "contrato" | "red",
    message: string,
    public readonly reintentarEnSegundos?: number,
  ) {
    super(message);
  }
}

function config() {
  const c = configBernie();
  if (!c) throw new ErrorBernie("internal", "Integración con Bernie sin configurar");
  return c;
}

async function pedirTokens(cuerpo: Record<string, string>): Promise<Tokens> {
  const c = config();
  let res: Response;
  try {
    res = await fetch(c.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // client_secret_basic: el secreto va en la cabecera, no en el cuerpo.
        Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams(cuerpo),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
  } catch {
    throw new ErrorBernie("red", "No se pudo contactar a Bernie");
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || typeof json?.access_token !== "string") {
    // invalid_grant = el refresh token ya no sirve (revocado o rotado por otra sync).
    const codigo = json?.error === "invalid_grant" ? "invalid_grant" : "unauthorized";
    throw new ErrorBernie(codigo, `Token endpoint respondió ${res.status}`);
  }
  return {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : null,
  };
}

export function canjearCodigo(codigo: string, verificador: string, redirectUri: string) {
  return pedirTokens({
    grant_type: "authorization_code",
    code: codigo,
    redirect_uri: redirectUri,
    code_verifier: verificador,
  });
}

export function refrescar(refreshToken: string) {
  return pedirTokens({ grant_type: "refresh_token", refresh_token: refreshToken });
}

/**
 * Lee los claims del access token recién recibido del token endpoint. No se
 * verifica la firma: el token llegó directo de Bernie por TLS y autenticado con
 * nuestro secreto. Sí se comprueba que sea para Casorio y del emisor correcto.
 */
export function claimsDelToken(accessToken: string): { sub: string } {
  const c = config();
  const payload = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8"));
  if (payload?.iss !== c.issuer || payload?.client_id !== c.clientId || typeof payload?.sub !== "string") {
    throw new ErrorBernie("unauthorized", "El token no es para Casorio");
  }
  return { sub: payload.sub };
}

async function llamarApi(ruta: string, accessToken: string, init: RequestInit = {}) {
  const c = config();
  try {
    return await fetch(`${c.url}${ruta}`, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
  } catch {
    throw new ErrorBernie("red", "No se pudo contactar a Bernie");
  }
}

async function errorDe(res: Response): Promise<ErrorBernie> {
  const cuerpo = await res.json().catch(() => null);
  const codigo = codigoProblema(cuerpo);
  const espera = Number(res.headers.get("retry-after"));
  return new ErrorBernie(codigo, `Bernie respondió ${res.status} (${codigo})`, Number.isFinite(espera) ? espera : undefined);
}

export async function pedirCambios(accessToken: string, cursor: string | null): Promise<PaginaSync> {
  const params = new URLSearchParams({ limit: "200" });
  if (cursor) params.set("cursor", cursor);
  const res = await llamarApi(`/api/v1/shared-expenses/sync?${params}`, accessToken);
  if (!res.ok) throw await errorDe(res);

  const validacion = validarPagina(await res.json().catch(() => null));
  if (!validacion.ok) {
    throw new ErrorBernie("contrato", `Respuesta fuera de contrato: ${validacion.errores.slice(0, 5).join(", ")}`);
  }
  return validacion.pagina;
}

/** Pide a Bernie que corte el acceso de Casorio. 204 o 403 (ya no estaba) cuentan como hecho. */
export async function revocarEnBernie(accessToken: string) {
  const res = await llamarApi("/api/v1/connection/revoke", accessToken, { method: "POST" });
  if (!res.ok && res.status !== 403) throw await errorDe(res);
}
