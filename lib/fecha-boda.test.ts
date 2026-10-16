import { test } from "node:test";
import assert from "node:assert/strict";
import { cuentaRegresiva, diasHasta, fechaLarga } from "./fecha-boda.ts";

test("días hasta: cero el mismo día, negativo si ya pasó, null sin fecha", () => {
  assert.equal(diasHasta("2026-03-05", "2026-03-05"), 0);
  assert.equal(diasHasta("2026-03-06", "2026-03-05"), 1);
  assert.equal(diasHasta("2026-03-04", "2026-03-05"), -1);
  assert.equal(diasHasta(null, "2026-03-05"), null);
});

test("días hasta: cruza el mes y el año sin perder un día", () => {
  assert.equal(diasHasta("2026-03-01", "2026-02-28"), 1);
  assert.equal(diasHasta("2027-01-01", "2026-12-31"), 1);
  assert.equal(diasHasta("2026-03-05", "2025-12-13"), 82);
});

test("cuenta regresiva: hoy, mañana y los días de en medio", () => {
  assert.equal(cuentaRegresiva(null, "2026-03-05"), null);
  assert.equal(cuentaRegresiva("2026-03-05", "2026-03-05"), "es hoy");
  assert.equal(cuentaRegresiva("2026-03-06", "2026-03-05"), "es mañana");
  assert.equal(cuentaRegresiva("2026-03-18", "2026-03-05"), "faltan 13 días");
});

test("cuenta regresiva: pasados dos meses se cuenta en semanas", () => {
  assert.equal(cuentaRegresiva("2026-05-04", "2026-03-05"), "faltan 60 días");
  assert.equal(cuentaRegresiva("2026-05-05", "2026-03-05"), "faltan 9 semanas");
});

test("cuenta regresiva: la boda que ya pasó se dice en pasado", () => {
  assert.equal(cuentaRegresiva("2026-03-04", "2026-03-05"), "fue ayer");
  assert.equal(cuentaRegresiva("2026-03-02", "2026-03-05"), "fue hace 3 días");
});

test("fecha larga: el día sin cero delante, el mes con nombre", () => {
  assert.equal(fechaLarga("2026-03-05"), "5 de marzo de 2026");
  assert.equal(fechaLarga("2026-12-13"), "13 de diciembre de 2026");
});
