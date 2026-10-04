import { test } from "node:test";
import assert from "node:assert/strict";
import { colorDe, COLORES_PERSONA, inicialesDe, personaDe } from "./persona.ts";

test("iniciales: nombre y primer apellido", () => {
  assert.equal(inicialesDe("Luis", "Mendoza Paz"), "LM");
  assert.equal(inicialesDe("Ana María", "Ríos"), "AR");
  assert.equal(inicialesDe("bryan", "De la Cruz"), "BD");
  assert.equal(inicialesDe("Úrsula", "Ñañez"), "ÚÑ");
});

test("iniciales: sin apellido usa lo que haya", () => {
  assert.equal(inicialesDe("", null, "ana rios"), "AR");
  assert.equal(inicialesDe("Jorge", null), "JO");
  assert.equal(inicialesDe(null, null, ""), "?");
});

test("color: estable por persona y dentro de la paleta", () => {
  assert.equal(colorDe("user_abc"), colorDe("user_abc"));
  const vistos = new Set(["user_1", "user_2", "user_3", "user_4", "user_5", "user_6", "user_7"].map(colorDe));
  for (const c of vistos) assert.ok(c >= 1 && c <= COLORES_PERSONA);
  assert.ok(vistos.size > 1, "no todos del mismo color");
});

test("ignora palabras que no empiezan con letra", () => {
  assert.equal(inicialesDe("Ana", "(demo)"), "AN");
  assert.equal(inicialesDe("Luis", "(demo) Mendoza"), "LM");
});

test("personaDe: sin nombre usa el correo", () => {
  assert.deepEqual(personaDe({ id: "u1", identifier: "ana.rios@x.com" }), { id: "u1", nombre: "ana rios", iniciales: "AR" });
  assert.equal(personaDe({ id: "u2", firstName: "Luis", lastName: "Mendoza Paz" }).nombre, "Luis Mendoza Paz");
});
