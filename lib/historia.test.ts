import { test } from "node:test";
import assert from "node:assert/strict";
import { collares, diasHasta, hoyEnLima, nombreDeLaPareja } from "./historia.ts";
import type { AccionCamino } from "./metas.ts";

const a = (id: string, extra: Partial<AccionCamino> = {}): AccionCamino => ({
  id, titulo: id, momento: "antes", estado: "por_hacer", inicioSemanas: 5, duracionSemanas: 1,
  monto: null, metaId: "m1", esHito: false, ...extra,
});

test("días: hasta la boda, cero el mismo día, negativo después", () => {
  assert.equal(diasHasta("2026-12-13", "2026-10-04"), 70);
  assert.equal(diasHasta("2026-12-13", "2026-12-13"), 0);
  assert.equal(diasHasta("2026-12-13", "2026-12-20"), -7);
  assert.equal(diasHasta(null, "2026-10-04"), null);
});

test("hoy en Lima, no en UTC", () => {
  // 03:00 UTC del 5 de octubre son las 22:00 del 4 en Lima.
  assert.equal(hoyEnLima(new Date("2026-10-05T03:00:00Z")), "2026-10-04");
});

test("collares: perlas en orden de dependencia, hito como rombo", () => {
  const acciones = [
    a("ceremonia", { esHito: true, inicioSemanas: 0, momento: "el_dia" }),
    a("doc", { estado: "hecho", inicioSemanas: 10 }),
    a("tramite", { estado: "haciendo", inicioSemanas: 7 }),
    a("suelta", { metaId: null }),
  ];
  const reqs = [
    { accionId: "tramite", requiereId: "doc" },
    { accionId: "ceremonia", requiereId: "tramite" },
  ];
  const [c] = collares(acciones, reqs, [{ id: "m1", titulo: "Registro civil" }]);
  assert.deepEqual(c, { titulo: "Registro civil", perlas: ["hecha", "haciendo", "hito"], hechas: 1 });
});

test("collares: sin metas, un collar con lo que tiene fecha; metas vacías no salen", () => {
  const acciones = [a("x", { metaId: null }), a("idea", { metaId: null, momento: "idea" })];
  assert.deepEqual(collares(acciones, [], []).map((c) => c.perlas.length), [1]);
  assert.equal(collares(acciones, [], [{ id: "vacia", titulo: "Vacía" }]).length, 0);
});

test("nombre de la pareja sale del de la boda", () => {
  assert.equal(nombreDeLaPareja("Boda de Ana y Luis (demo)"), "Ana y Luis");
  assert.equal(nombreDeLaPareja("Bryan & Majo"), "Bryan & Majo");
});
