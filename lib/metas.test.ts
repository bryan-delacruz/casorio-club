import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cadenaPrincipal,
  finDe,
  listasParaEmpezar,
  momentoDe,
  ordenPorDependencia,
  planPlantilla,
  REGISTRO_CIVIL,
  resumenMeta,
  type AccionCamino,
  type Requisito,
} from "./metas.ts";

const accion = (id: string, inicio: number, dura = 1, extra: Partial<AccionCamino> = {}): AccionCamino => ({
  id,
  titulo: id,
  momento: momentoDe(inicio),
  estado: "por_hacer",
  inicioSemanas: inicio,
  duracionSemanas: dura,
  monto: null,
  metaId: "m",
  esHito: false,
  ...extra,
});

// La plantilla real como datos de prueba: si cambia, los tests lo notan.
const registro = REGISTRO_CIVIL.pasos.map((p) =>
  accion(p.clave, p.inicio, p.dura, { esHito: Boolean(p.hito) }),
);
const requisitos: Requisito[] = REGISTRO_CIVIL.pasos.flatMap((p) =>
  p.requiere.map((r) => ({ accionId: p.clave, requiereId: r })),
);

test("orden: cada acción va después de todo lo que requiere", () => {
  const orden = ordenPorDependencia(registro, requisitos).map((a) => a.id);
  for (const r of requisitos) {
    assert.ok(orden.indexOf(r.requiereId) < orden.indexOf(r.accionId), `${r.requiereId} antes de ${r.accionId}`);
  }
  assert.deepEqual(orden.slice(-4), ["expediente", "edicto", "ceremonia", "acta"]);
});

test("orden: a igualdad, primero la que empieza antes; un ciclo no cuelga", () => {
  const sueltas = [accion("b", 4), accion("a", 10)];
  assert.deepEqual(ordenPorDependencia(sueltas, []).map((a) => a.id), ["a", "b"]);
  const ciclo = [accion("x", 5), accion("y", 4)];
  const r = ordenPorDependencia(ciclo, [{ accionId: "x", requiereId: "y" }, { accionId: "y", requiereId: "x" }]);
  assert.equal(r.length, 2);
});

test("cadena principal del registro civil: de un requisito hasta el acta", () => {
  const cadena = cadenaPrincipal(registro, requisitos);
  for (const id of ["expediente", "edicto", "ceremonia", "acta"]) assert.ok(cadena.has(id), id);
  // Entra un solo requisito (el de más semanas), no los cinco.
  const previos = ["partidas", "dni", "domicilio", "medico", "testigos"].filter((id) => cadena.has(id));
  assert.equal(previos.length, 1);
  assert.equal(cadena.size, 5);
});

test("cadena principal: acciones sin dependencias no forman cadena", () => {
  assert.equal(cadenaPrincipal([accion("a", 5), accion("b", 3)], []).size, 0);
});

test("lista para empezar: solo con requisitos y todos hechos", () => {
  const acciones = [
    accion("doc1", 10, 1, { estado: "hecho" }),
    accion("doc2", 10, 1, { estado: "hecho" }),
    accion("tramite", 7),
    accion("despues", 5),
    accion("suelta", 4),
  ];
  const reqs: Requisito[] = [
    { accionId: "tramite", requiereId: "doc1" },
    { accionId: "tramite", requiereId: "doc2" },
    { accionId: "despues", requiereId: "tramite" },
  ];
  assert.deepEqual([...listasParaEmpezar(acciones, reqs)], ["tramite"]);
});

test("resumen: avance, rango en semanas (hito incluido) y monto", () => {
  const r = resumenMeta([
    accion("a", 12, 2, { estado: "hecho", monto: "40.00" }),
    accion("b", 0, 3, { esHito: true, monto: "250.50" }),
    accion("c", 8, 1, { momento: "idea" }),
  ]);
  assert.deepEqual(r, { total: 3, hechas: 1, inicio: 12, fin: 0, monto: 290.5 });
  assert.equal(finDe(accion("h", 0, 3, { esHito: true })), 0, "un hito no dura");
});

test("plantilla: reutiliza por título sin tildes ni mayúsculas y crea lo que falta", () => {
  const { reutilizar, crear } = planPlantilla(REGISTRO_CIVIL.pasos, [
    { id: "x1", titulo: "certificado MEDICO prenupcial" },
    { id: "x2", titulo: "Otra cosa" },
  ]);
  assert.deepEqual([...reutilizar], [["medico", "x1"]]);
  assert.equal(crear.length, REGISTRO_CIVIL.pasos.length - 1);
});

test("plantilla: dependencias apuntan a pasos que existen y la ceremonia es hito", () => {
  const claves = new Set(REGISTRO_CIVIL.pasos.map((p) => p.clave));
  for (const p of REGISTRO_CIVIL.pasos) for (const r of p.requiere) assert.ok(claves.has(r), `${p.clave} → ${r}`);
  assert.equal(REGISTRO_CIVIL.pasos.find((p) => p.clave === "ceremonia")?.hito, true);
  assert.equal(momentoDe(0), "el_dia");
});
