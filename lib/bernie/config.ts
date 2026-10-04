import "server-only";

/** Variables de la integración (docs/integracion-bernie.md §11). */
export function configBernie() {
  const url = process.env.BERNIE_URL;
  const supabaseUrl = process.env.BERNIE_SUPABASE_URL;
  const clientId = process.env.BERNIE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.BERNIE_OAUTH_CLIENT_SECRET;
  if (!url || !supabaseUrl || !clientId || !clientSecret || !process.env.BERNIE_TOKEN_ENCRYPTION_KEY) {
    return null;
  }
  return {
    url: url.replace(/\/$/, ""),
    authorizeUrl: `${supabaseUrl.replace(/\/$/, "")}/auth/v1/oauth/authorize`,
    tokenUrl: `${supabaseUrl.replace(/\/$/, "")}/auth/v1/oauth/token`,
    issuer: `${supabaseUrl.replace(/\/$/, "")}/auth/v1`,
    clientId,
    clientSecret,
  };
}

/** Sin configuración la integración simplemente no aparece. */
export function integracionDisponible() {
  return configBernie() !== null;
}
