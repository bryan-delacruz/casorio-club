import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { challengeS256, mismoState, nuevoState, nuevoVerificador } from "./pkce.ts";
import { verificarWebhook } from "./firma.ts";
import { clasificarErrorToken, codigoProblema, validarPagina, type PaginaSync } from "./contrato.ts";
import { fechaLima, planificar } from "./plan.ts";

process.env.BERNIE_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
const { cifrar, descifrar } = await import("./cifrado.ts");

// ---------- cifrado ----------

test("cifrado: ida y vuelta, y un valor alterado no se descifra", () => {
  const c = cifrar("refresh-token-secreto");
  assert.notEqual(c, cifrar("refresh-token-secreto"), "iv aleatorio");
  assert.equal(descifrar(c), "refresh-token-secreto");
  const roto = Buffer.from(c, "base64url");
  roto[roto.length - 1] ^= 1;
  assert.throws(() => descifrar(roto.toString("base64url")));
});

// ---------- PKCE ----------

test("pkce: verificador de 43 caracteres y challenge S256 del RFC 7636", () => {
  const v = nuevoVerificador();
  assert.match(v, /^[A-Za-z0-9_-]{43}$/);
  // Vector del apéndice B del RFC 7636.
  assert.equal(
    challengeS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  );
  assert.equal(challengeS256(v), createHash("sha256").update(v).digest("base64url"));
});

test("pkce: state aleatorio y comparación segura", () => {
  const s = nuevoState();
  assert.notEqual(s, nuevoState());
  assert.equal(mismoState(s, s), true);
  assert.equal(mismoState(s, s.slice(1)), false);
  assert.equal(mismoState(s, nuevoState()), false);
});

// ---------- firma de webhooks (vector oficial de Standard Webhooks) ----------

const V = {
  secreto: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
  id: "msg_p5jXN8AQM9LWM0D4loKWxJek",
  ts: "1614265330",
  cuerpo: '{"test": 2432232314}',
  firma: "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
};
const ahora = 1614265330 + 30;

test("webhook: acepta el vector oficial y rechaza alteraciones", () => {
  const cab = { id: V.id, timestamp: V.ts, firma: V.firma };
  assert.deepEqual(verificarWebhook(V.secreto, cab, V.cuerpo, { ahora }), { ok: true });
  assert.deepEqual(verificarWebhook(V.secreto, cab, '{"test": 1}', { ahora }), { ok: false, motivo: "firma_invalida" });
  assert.deepEqual(verificarWebhook(V.secreto, cab, V.cuerpo, { ahora: ahora + 3600 }), { ok: false, motivo: "fuera_de_tiempo" });
  assert.deepEqual(verificarWebhook(V.secreto, { ...cab, firma: null }, V.cuerpo, { ahora }), { ok: false, motivo: "faltan_cabeceras" });
});

// ---------- contrato con Bernie ----------

const contrato = JSON.parse(readFileSync(new URL("./fixtures/contrato-v1.json", import.meta.url), "utf8"));

test("contrato: los ejemplos del OpenAPI de Bernie pasan la validación de Casorio", () => {
  assert.equal(contrato.version, "1.0.0");
  for (const [nombre, ejemplo] of Object.entries(contrato.ejemplos)) {
    const r = validarPagina(ejemplo);
    assert.equal(r.ok, true, `${nombre}: ${JSON.stringify(!r.ok && r.errores)}`);
  }
});

test("contrato: detecta float en monto, campos faltantes e ids malos", () => {
  const malo = {
    added: [{ id: "x", occurredAt: "ayer", amount: 800, currency: "soles", merchant: "m", subcategory: null }],
    modified: [],
    removed: ["no-uuid"],
    nextCursor: "",
  };
  const r = validarPagina(malo);
  assert.equal(r.ok, false);
  const errores = !r.ok ? r.errores.join(" ") : "";
  for (const campo of ["id", "occurredAt", "amount", "currency", "removed", "nextCursor", "hasMore"]) {
    assert.ok(errores.includes(campo), campo);
  }
});

test("contrato: lee el code de un Problem Details", () => {
  assert.equal(codigoProblema({ type: "urn:bernie:problem:cursor_reset", code: "cursor_reset", status: 409 }), "cursor_reset");
  assert.equal(codigoProblema({ code: "otra_cosa" }), "internal");
  assert.equal(codigoProblema("html de error"), "internal");
});

// ---------- plan de cambios ----------

const ID = (n: number) => `3f6c1a52-8a0e-4b1f-9d6a-${String(n).padStart(12, "0")}`;
const gasto = (n: number, amount = "100.00") => ({
  id: ID(n),
  occurredAt: "2026-09-13T02:30:00.000Z", // 12 sep, 9:30 p. m. en Lima
  amount,
  currency: "PEN",
  merchant: `Comercio ${n}`,
  subcategory: "Fotógrafo",
});
const pagina = (p: Partial<PaginaSync>): PaginaSync => ({ added: [], modified: [], removed: [], nextCursor: "c", hasMore: false, ...p });

test("plan: fecha en horario de Lima, no UTC", () => {
  assert.equal(fechaLima("2026-09-13T02:30:00.000Z"), "2026-09-12");
});

test("plan: nuevos a la bandeja; editados actualizan también su pago", () => {
  const existentes = new Map<string, string | null>([[ID(2), "pago-2"], [ID(3), null]]);
  const plan = planificar(pagina({ added: [gasto(1)], modified: [gasto(2, "850.00"), gasto(3)] }), existentes);
  assert.deepEqual(plan.guardar.map((g) => g.externoId), [ID(1), ID(2), ID(3)]);
  assert.equal(plan.guardar[0].fecha, "2026-09-12");
  assert.deepEqual(plan.actualizarPagos, [{ pagoId: "pago-2", monto: "850.00", fecha: "2026-09-12" }]);
});

test("plan: borrados — sin asignar se van, asignados se conservan, desconocidos se ignoran", () => {
  const existentes = new Map<string, string | null>([[ID(1), null], [ID(2), "pago-2"]]);
  const plan = planificar(pagina({ removed: [ID(1), ID(2), ID(9), ID(1)] }), existentes);
  assert.deepEqual(plan.borrar, [ID(1)]);
  assert.deepEqual(plan.marcarFuera, [ID(2)]);
});

test("plan: un gasto repetido en la página cuenta una vez y gana el último", () => {
  const plan = planificar(pagina({ added: [gasto(1, "1.00")], modified: [gasto(1, "2.00")] }), new Map());
  assert.equal(plan.guardar.length, 1);
  assert.equal(plan.guardar[0].monto, "2.00");
});

// ---------- errores del token endpoint ----------

test("token: una caída no se confunde con una revocación", () => {
  assert.equal(clasificarErrorToken(503, null), "red");
  assert.equal(clasificarErrorToken(429, { error_code: "over_request_rate_limit" }), "red");
});

test("token: secreto mal configurado es error de configuración, no revocación", () => {
  // Formato real de Supabase, visto en producción.
  assert.equal(clasificarErrorToken(400, { code: 400, error_code: "invalid_credentials", msg: "invalid client credentials" }), "internal");
});

test("token: refresh token inválido o revocado → invalid_grant", () => {
  assert.equal(clasificarErrorToken(400, { error_code: "refresh_token_not_found" }), "invalid_grant");
  assert.equal(clasificarErrorToken(400, { error: "invalid_grant" }), "invalid_grant");
});
