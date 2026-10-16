import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cadenaPrincipal,
  enCamino,
  faltanAntesDe,
  faltanSemanas,
  etapas,
  finDe,
  listasParaEmpezar,
  nombreDeHitos,
  ordenPorDependencia,
  ordenPorSemana,
  planPlantilla,
  proximoHito,
  queTocaAhora,
  REGISTRO_CIVIL,
  resumenMeta,
  semanaPorDefecto,
  semanasHastaLaBoda,
  type AccionCamino,
  type AccionEnCamino,
  type Requisito,
} from "./metas.ts";

const accion = (id: string, inicio: number, dura = 1, extra: Partial<AccionEnCamino> = {}): AccionEnCamino => ({
  id,
  titulo: id,
  estado: "por_hacer",
  inicioSemanas: inicio,
  duracionSemanas: dura,
  monto: null,
  metaId: "m",
  esHito: false,
  ...extra,
});

/** Una idea suelta: lo mismo pero sin semana puesta. */
const idea = (id: string, extra: Partial<AccionCamino> = {}): AccionCamino => ({
  ...accion(id, 0),
  ...extra,
  inicioSemanas: null,
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

test("orden: a igualdad, primero la que empieza antes; la idea suelta al final", () => {
  const sueltas = [accion("b", 4), accion("a", 10)];
  assert.deepEqual(ordenPorDependencia(sueltas, []).map((a) => a.id), ["a", "b"]);
  const conIdea = [idea("z"), accion("b", 4), accion("a", 10)];
  assert.deepEqual(ordenPorDependencia(conIdea, []).map((a) => a.id), ["a", "b", "z"]);
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

test("cadena principal: acciones sin dependencias no forman cadena; las ideas no cuentan", () => {
  assert.equal(cadenaPrincipal([accion("a", 5), accion("b", 3)], []).size, 0);
  const conIdea = [accion("a", 5), idea("b")];
  assert.equal(cadenaPrincipal(conIdea, [{ accionId: "b", requiereId: "a" }]).size, 0);
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

test("resumen: avance, rango en semanas (hito incluido) y monto; la idea no da rango", () => {
  const r = resumenMeta([
    accion("a", 12, 2, { estado: "hecho", monto: "40.00" }),
    accion("b", 0, 3, { esHito: true, monto: "250.50" }),
    idea("c", { monto: null }),
  ]);
  assert.deepEqual(r, { total: 3, hechas: 1, inicio: 12, fin: 0, monto: 290.5 });
  assert.equal(finDe(accion("h", 0, 3, { esHito: true })), 0, "un hito no dura");
  const sinSemanas = resumenMeta([idea("x"), idea("y")]);
  assert.deepEqual([sinSemanas.inicio, sinSemanas.fin], [null, null]);
});

test("orden por semana: lo más temprano primero y, a igualdad, por título", () => {
  const lista = [accion("zeta", 4), accion("alfa", 4), accion("tarde", -2), accion("lejos", 12)];
  assert.deepEqual(ordenPorSemana(lista).map((a) => a.id), ["lejos", "alfa", "zeta", "tarde"]);
});

test("enCamino deja fuera las ideas sueltas", () => {
  assert.deepEqual(enCamino([accion("a", 3), idea("b")]).map((a) => a.id), ["a"]);
});

// ---------------------------------------------------------------------------
// Etapas (docs/metas.md §6)
// ---------------------------------------------------------------------------

test("etapas: cada acción cae en el hito más temprano que la sigue", () => {
  const grupos = etapas(enCamino(registro), requisitos);
  assert.deepEqual(
    grupos.map((g) => [g.titulo, g.acciones.map((a) => a.id)]),
    [
      [
        "Hasta ceremonia",
        ["dni", "partidas", "domicilio", "testigos", "medico", "expediente", "edicto", "ceremonia"],
      ],
      ["Después de ceremonia", ["acta"]],
    ],
  );
  // El hito pertenece a su propia etapa y va al final de ella.
  assert.equal(grupos[0].acciones.at(-1)!.id, "ceremonia");
  assert.deepEqual([grupos[0].semana, grupos[0].final], [0, false]);
  assert.deepEqual([grupos[1].semana, grupos[1].final], [null, true]);
});

test("etapas: la clave es el id del hito, no su semana", () => {
  const hito = accion("h", 4, 1, { esHito: true });
  const [primera, final] = etapas([hito, accion("tarde", 1)], []);
  assert.equal(primera.clave, "h");
  assert.equal(final.clave, "final:h");
});

test("etapas: lo que cruza un hito cae en la etapa siguiente (manda finDe)", () => {
  const cruza = accion("cruza", 7, 5); // empieza en 7 y termina en 3
  const grupos = etapas([accion("hito", 6, 1, { esHito: true }), cruza, accion("antes", 8)], []);
  assert.deepEqual(
    grupos.map((g) => [g.titulo, g.acciones.map((a) => a.id)]),
    [
      ["Hasta hito", ["antes", "hito"]],
      ["Después de hito", ["cruza"]],
    ],
  );
});

test("etapas: sin nada después del último hito no hay grupo final", () => {
  const grupos = etapas([accion("hito", 0, 1, { esHito: true }), accion("antes", 5)], []);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].final, false);
});

test("etapas: sin hitos, un solo grupo con todo lo que tiene semanas", () => {
  const grupos = etapas([accion("b", 3), accion("a", 9)], []);
  assert.deepEqual(grupos.map((g) => [g.clave, g.titulo, g.acciones.map((x) => x.id)]), [
    ["todo-el-camino", "Todo el camino", ["a", "b"]],
  ]);
});

test("etapas: dos hitos en la misma semana son una sola etapa, sin etapa vacía", () => {
  const grupos = etapas(
    [
      accion("ceremonia", 0, 1, { esHito: true, metaId: "m1" }),
      accion("edicto", 0, 1, { esHito: true, metaId: "m2" }),
      accion("antes", 4),
    ],
    [],
    [{ id: "m2" }, { id: "m1" }],
  );
  assert.equal(grupos.length, 1);
  // El orden del título lo da la meta, y a igualdad el título.
  assert.equal(grupos[0].titulo, "Hasta edicto y ceremonia");
  assert.deepEqual(grupos[0].acciones.map((a) => a.id), ["antes", "ceremonia", "edicto"]);
});

test("etapas: un hito sin semanas no corta el camino ni aparece en ninguna etapa", () => {
  const acciones: AccionCamino[] = [
    accion("a", 5),
    idea("hito-sin-fecha", { esHito: true }),
  ];
  const grupos = etapas(enCamino(acciones), []);
  assert.deepEqual(grupos.map((g) => g.titulo), ["Todo el camino"]);
  assert.deepEqual(grupos[0].acciones.map((a) => a.id), ["a"]);
});

test("etapas: las ideas sueltas no aparecen en ninguna etapa", () => {
  const todas: AccionCamino[] = [accion("hito", 0, 1, { esHito: true }), accion("a", 4), idea("suelta")];
  const dentro = etapas(enCamino(todas), []).flatMap((g) => g.acciones.map((a) => a.id));
  assert.deepEqual(dentro, ["a", "hito"]);
});

// ---------------------------------------------------------------------------
// Qué toca ahora (docs/metas.md §5.2)
// ---------------------------------------------------------------------------

test("qué toca ahora: fuera las ideas sueltas, lo hecho y lo bloqueado", () => {
  const acciones: AccionCamino[] = [
    accion("lista", 10),
    accion("hecha", 11, 1, { estado: "hecho" }),
    accion("bloqueada", 9),
    accion("requisito", 12),
    idea("suelta"),
  ];
  const reqs: Requisito[] = [{ accionId: "bloqueada", requiereId: "requisito" }];
  assert.deepEqual(queTocaAhora(acciones, reqs).map((a) => a.id), ["requisito", "lista"]);
});

test("qué toca ahora: lo que no tiene requisitos entra, y ahí se separa de listasParaEmpezar", () => {
  const acciones = [accion("a", 8), accion("b", 6)];
  // Una boda sin ninguna dependencia: la banda la llena igual, el Gantt no
  // marca nada. Son dos preguntas distintas y por eso dos funciones.
  assert.deepEqual(queTocaAhora(acciones, []).map((a) => a.id), ["a", "b"]);
  assert.equal(listasParaEmpezar(acciones, []).size, 0);
});

test("qué toca ahora: un requisito que ya no existe no bloquea", () => {
  const acciones = [accion("a", 8)];
  assert.deepEqual(
    queTocaAhora(acciones, [{ accionId: "a", requiereId: "borrada" }]).map((a) => a.id),
    ["a"],
  );
});

test("qué toca ahora: por semana descendente, haciendo antes que por hacer, y el límite", () => {
  const acciones = [
    accion("tarde", 2),
    accion("zeta", 9, 1, { estado: "haciendo" }),
    accion("alfa", 9),
    accion("atrasada", 14),
    accion("media", 5),
  ];
  assert.deepEqual(
    queTocaAhora(acciones, []).map((a) => a.id),
    ["atrasada", "zeta", "alfa", "media", "tarde"],
  );
  assert.deepEqual(queTocaAhora(acciones, [], null, 2).map((a) => a.id), ["atrasada", "zeta"]);
});

// ---------------------------------------------------------------------------
// El próximo hito y su cuenta regresiva (docs/metas.md §5.3)
// ---------------------------------------------------------------------------

test("próximo hito: el del camino, no hecho, con la semana más alta", () => {
  const acciones: AccionCamino[] = [
    accion("ceremonia", 0, 1, { esHito: true }),
    accion("edicto", 6, 1, { esHito: true }),
    accion("cualquiera", 9),
  ];
  assert.equal(proximoHito(acciones)?.id, "edicto");
  // Hecho ya no es el próximo: la tira salta al siguiente.
  const conEdictoHecho = acciones.map((a) => (a.id === "edicto" ? { ...a, estado: "hecho" as const } : a));
  assert.equal(proximoHito(conEdictoHecho)?.id, "ceremonia");
});

test("próximo hito: ninguno si no hay hitos en el camino; la idea suelta no cuenta", () => {
  assert.equal(proximoHito([accion("a", 5)]), null);
  assert.equal(proximoHito([idea("hito-suelto", { esHito: true })]), null);
});

test("próximo hito: dos en la misma semana se nombran unidos por «y»", () => {
  const acciones = [
    accion("Ceremonia civil", 0, 1, { esHito: true, metaId: "m1" }),
    accion("Edicto matrimonial", 0, 1, { esHito: true, metaId: "m2" }),
  ];
  const hito = proximoHito(acciones, [{ id: "m2" }, { id: "m1" }])!;
  assert.equal(
    nombreDeHitos(acciones, hito.inicioSemanas, [{ id: "m2" }, { id: "m1" }]),
    "Edicto matrimonial y Ceremonia civil",
  );
});

test("faltan antes del hito: las no hechas de su etapa, sin contar el hito", () => {
  const acciones: AccionCamino[] = [
    accion("hito", 4, 1, { esHito: true }),
    accion("pendiente", 8),
    accion("otra", 6),
    accion("ya", 7, 1, { estado: "hecho" }),
    accion("despues", 1),
  ];
  const hito = proximoHito(acciones)!;
  assert.equal(faltanAntesDe(hito, acciones, []), 2);
  // Todo hecho: la tira dice que ya está listo.
  const todas = acciones.map((a) => (a.esHito ? a : { ...a, estado: "hecho" as const }));
  assert.equal(faltanAntesDe(proximoHito(todas)!, todas, []), 0);
});

test("cuenta regresiva: semanas hasta la boda menos la semana del hito; sin fecha no hay", () => {
  assert.equal(faltanSemanas(10, 2), 8);
  // Cero o menos: es esta semana, que es lo que dice la tira.
  assert.equal(faltanSemanas(6, 6), 0);
  assert.ok(faltanSemanas(4, 6)! <= 0);
  assert.equal(faltanSemanas(null, 6), null);
});

// ---------------------------------------------------------------------------
// La semana que se escribe al entrar al camino (docs/metas.md §2.4)
// ---------------------------------------------------------------------------

test("semana por defecto: dentro de una etapa, termina la semana anterior al hito", () => {
  // Hito en 6 y dura 2 → empieza en 8 y termina en 7, justo antes del hito.
  assert.equal(semanaPorDefecto({ hitoSemana: 6, duracion: 2 }), 8);
  assert.equal(semanaPorDefecto({ hitoSemana: 0, duracion: 1 }), 1);
  // Después del último hito: la semana que pide el Mapa es ultimoHito - 1.
  assert.equal(semanaPorDefecto({ hitoSemana: -2, duracion: 1 }), -1);
});

test("semana por defecto: sin hito manda la fecha de la boda, con mínimo de 1", () => {
  assert.equal(semanaPorDefecto({ semanasHastaLaBoda: 20 }), 20);
  assert.equal(semanaPorDefecto({ semanasHastaLaBoda: 0 }), 1);
  assert.equal(semanaPorDefecto({ semanasHastaLaBoda: -3 }), 1);
});

test("semana por defecto: sin hitos y sin fecha, ocho semanas", () => {
  assert.equal(semanaPorDefecto({}), 8);
});

test("semanas hasta la boda: null sin fecha, negativo si ya pasó", () => {
  const hoy = new Date(2026, 9, 15);
  assert.equal(semanasHastaLaBoda(null, hoy), null);
  assert.equal(semanasHastaLaBoda("2026-12-24", hoy), 10);
  assert.equal(semanasHastaLaBoda("2026-10-15", hoy), 0);
  assert.equal(semanasHastaLaBoda("2026-10-01", hoy), -2);
});

test("plantilla: reutiliza por título sin tildes ni mayúsculas y crea lo que falta", () => {
  const { reutilizar, crear } = planPlantilla(REGISTRO_CIVIL.pasos, [
    { id: "x1", titulo: "certificado MEDICO prenupcial" },
    { id: "x2", titulo: "Otra cosa" },
  ]);
  assert.deepEqual([...reutilizar], [["medico", "x1"]]);
  assert.equal(crear.length, REGISTRO_CIVIL.pasos.length - 1);
});

test("plantilla: una boda con el título viejo del edicto no gana un duplicado", () => {
  const { reutilizar, crear } = planPlantilla(REGISTRO_CIVIL.pasos, [
    { id: "viejo", titulo: "Publicar el edicto matrimonial" },
  ]);
  // Se reutiliza (recibe la meta) y no se crea otra; la plantilla no renombra.
  assert.equal(reutilizar.get("edicto"), "viejo");
  assert.equal(crear.some((p) => p.clave === "edicto"), false);
  assert.equal(crear.length, REGISTRO_CIVIL.pasos.length - 1);
});

test("plantilla: dependencias apuntan a pasos que existen y la ceremonia es hito", () => {
  const claves = new Set(REGISTRO_CIVIL.pasos.map((p) => p.clave));
  for (const p of REGISTRO_CIVIL.pasos) for (const r of p.requiere) assert.ok(claves.has(r), `${p.clave} → ${r}`);
  assert.equal(REGISTRO_CIVIL.pasos.find((p) => p.clave === "ceremonia")?.hito, true);
});
