import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cadenaPrincipal,
  cuantasYaPasaron,
  enCamino,
  estadoDeHitos,
  faltanAntesDe,
  faltanSemanas,
  etapas,
  finDe,
  listasParaEmpezar,
  metasQueEspera,
  nombreDeHitos,
  ordenarMetas,
  ordenPorDependencia,
  ordenPorSemana,
  planPlantilla,
  proximoHito,
  motivoBandaVacia,
  queTocaAhora,
  REGISTRO_CIVIL,
  resumenMeta,
  semanaPorDefecto,
  semanasHastaLaBoda,
  ultimoHitoHecho,
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

test("resumen: el monto suma lo que va costando, no el monto (docs/pagos.md §4.3)", () => {
  const pagos = new Map([
    // Pagada sin monto: antes valía S/ 0 en el total de la meta.
    ["sinMonto", [{ monto: "450.00" }]],
    // Pagada de más: manda lo puesto, porque esa plata ya salió.
    ["deMas", [{ monto: "1380.00" }]],
  ]);
  const r = resumenMeta(
    [
      accion("sinMonto", 8, 1, { monto: null }),
      accion("deMas", 6, 1, { monto: "1200.00" }),
      accion("calculada", 4, 1, { monto: "100.00" }),
    ],
    pagos,
  );
  assert.equal(r.monto, 450 + 1380 + 100);
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

test("banda vacía: bloqueadas si quedan acciones, todo_hecho si no queda ninguna", () => {
  const acciones = [accion("a", 8), accion("b", 6, 1, { estado: "hecho" })];
  assert.equal(motivoBandaVacia(acciones), "bloqueadas");
  assert.equal(motivoBandaVacia([accion("a", 8, 1, { estado: "hecho" })]), "todo_hecho");
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

// ---------------------------------------------------------------------------
// El cierre de los hitos (docs/metas.md §5.3.1)
// ---------------------------------------------------------------------------

test("último hito hecho: el del camino, hecho, con la semana más baja", () => {
  const acciones: AccionCamino[] = [
    accion("edicto", 6, 1, { esHito: true, estado: "hecho" }),
    accion("ceremonia", 0, 1, { esHito: true, estado: "hecho" }),
    accion("cualquiera", 9, 1, { estado: "hecho" }),
  ];
  assert.equal(ultimoHitoHecho(acciones)?.id, "ceremonia");
});

test("último hito hecho: null sin ninguno hecho, y la idea suelta no cuenta", () => {
  assert.equal(ultimoHitoHecho([accion("hito", 4, 1, { esHito: true })]), null);
  assert.equal(
    ultimoHitoHecho([idea("hito-suelto", { esHito: true, estado: "hecho" })]),
    null,
  );
});

test("último hito hecho: ignora los hitos sin hacer, aunque sean más tardíos", () => {
  // No es "el último que toqué": el pendiente de la semana 0 no pasó todavía.
  const acciones: AccionCamino[] = [
    accion("edicto", 6, 1, { esHito: true, estado: "hecho" }),
    accion("ceremonia", 0, 1, { esHito: true }),
  ];
  assert.equal(ultimoHitoHecho(acciones)?.id, "edicto");
});

test("con un hito pendiente y otro hecho, la pantalla dibuja la tira normal", () => {
  const acciones: AccionCamino[] = [
    accion("edicto", 6, 1, { esHito: true, estado: "hecho" }),
    accion("ceremonia", 0, 1, { esHito: true }),
  ];
  assert.equal(proximoHito(acciones)?.id, "ceremonia");
  assert.equal(ultimoHitoHecho(acciones)?.id, "edicto");
  assert.equal(estadoDeHitos(acciones).tipo, "proximo");
});

test("todos los hitos hechos: no hay próximo y sí último, que es el cierre", () => {
  const acciones: AccionCamino[] = [
    accion("edicto", 6, 1, { esHito: true, estado: "hecho" }),
    accion("ceremonia", 0, 1, { esHito: true, estado: "hecho" }),
    accion("pendiente", 2),
  ];
  assert.equal(proximoHito(acciones), null);
  const estado = estadoDeHitos(acciones);
  assert.equal(estado.tipo, "cierre");
  assert.equal(estado.tipo === "cierre" && estado.hito.id, "ceremonia");
});

test("dos hitos hechos empatados en la semana más baja se nombran unidos por «y»", () => {
  const acciones = [
    accion("Ceremonia civil", 0, 1, { esHito: true, estado: "hecho", metaId: "m1" }),
    accion("Edicto matrimonial", 0, 1, { esHito: true, estado: "hecho", metaId: "m2" }),
  ];
  const metas = [{ id: "m2" }, { id: "m1" }];
  const hito = ultimoHitoHecho(acciones, metas)!;
  assert.equal(hito.titulo, "Edicto matrimonial");
  assert.equal(
    nombreDeHitos(acciones, hito.inicioSemanas, metas),
    "Edicto matrimonial y Ceremonia civil",
  );
});

test("ningún hito en toda la boda: las dos funciones dan null y toca invitar", () => {
  const acciones: AccionCamino[] = [accion("a", 5), idea("b")];
  assert.equal(proximoHito(acciones), null);
  assert.equal(ultimoHitoHecho(acciones), null);
  assert.equal(estadoDeHitos(acciones).tipo, "ninguno");
});

test("hitos que existen pero son todos ideas sueltas: null, y falta la semana", () => {
  const acciones: AccionCamino[] = [idea("hito-suelto", { esHito: true })];
  assert.equal(proximoHito(acciones), null);
  assert.equal(ultimoHitoHecho(acciones), null);
  assert.equal(estadoDeHitos(acciones).tipo, "sin-semana");
});

test("estado de hitos: un hito hecho que es idea suelta no da cierre", () => {
  const acciones: AccionCamino[] = [idea("hito-suelto", { esHito: true, estado: "hecho" })];
  assert.equal(estadoDeHitos(acciones).tipo, "sin-semana");
});

test("estado de hitos: el caso próximo trae el hito que la tira nombra", () => {
  const acciones: AccionCamino[] = [accion("ceremonia", 0, 1, { esHito: true })];
  const estado = estadoDeHitos(acciones);
  assert.equal(estado.tipo === "proximo" && estado.hito.id, "ceremonia");
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

test("ya pasaron: solo lo del camino, sin hacer, con la semana ya vencida", () => {
  const lista = [
    accion("vencida", 12),
    accion("justo", 6),
    accion("porVenir", 3),
    accion("hecha", 20, 1, { estado: "hecho" }),
    idea("suelta"),
  ];
  assert.equal(cuantasYaPasaron(lista, 6), 1);
  assert.equal(cuantasYaPasaron(lista, 20), 0);
  assert.equal(cuantasYaPasaron(lista, 2), 3);
  // Sin fecha de boda no hay con qué comparar: no se avisa de nada.
  assert.equal(cuantasYaPasaron(lista, null), 0);
});

// ---------------------------------------------------------------------------
// El orden de las metas, derivado (docs/metas.md §11.3)
// ---------------------------------------------------------------------------

/** Una meta con lo que hace falta para ordenarla. */
const meta = (id: string, orden = 0, creadaEl = "2026-01-01T00:00:00Z") => ({
  id,
  titulo: id,
  orden,
  creadaEl: new Date(creadaEl),
});

test("ordenarMetas: manda la semana de inicio más temprana de sus acciones", () => {
  const metas = [meta("ceremonia"), meta("ahorro"), meta("recepcion")];
  const acciones = [
    accion("a1", 30, 1, { metaId: "ahorro" }),
    accion("a2", 10, 1, { metaId: "ahorro" }),
    accion("c1", 12, 1, { metaId: "ceremonia" }),
    accion("r1", 4, 1, { metaId: "recepcion" }),
  ];
  assert.deepEqual(
    ordenarMetas(metas, acciones).map((m) => m.id),
    ["ahorro", "ceremonia", "recepcion"],
  );
});

test("ordenarMetas: la meta sin acciones y la que solo tiene ideas sueltas van al final", () => {
  const metas = [meta("vacia"), meta("soloIdeas"), meta("conCamino")];
  const acciones = [
    accion("c1", 8, 1, { metaId: "conCamino" }),
    idea("i1", { metaId: "soloIdeas" }),
    idea("i2", { metaId: "soloIdeas" }),
  ];
  const orden = ordenarMetas(metas, acciones).map((m) => m.id);
  assert.equal(orden[0], "conCamino");
  assert.deepEqual(orden.slice(1).sort(), ["soloIdeas", "vacia"]);
});

test("ordenarMetas: las ideas sueltas no cuentan para la semana de su meta", () => {
  const metas = [meta("papeleo"), meta("fiesta")];
  // La idea suelta de "fiesta" no la adelanta: solo cuenta su acción en el camino.
  const acciones = [
    accion("p1", 20, 1, { metaId: "papeleo" }),
    idea("f0", { metaId: "fiesta" }),
    accion("f1", 6, 1, { metaId: "fiesta" }),
  ];
  assert.deepEqual(
    ordenarMetas(metas, acciones).map((m) => m.id),
    ["papeleo", "fiesta"],
  );
});

test("ordenarMetas: a igualdad desempata por orden y luego por creadaEl", () => {
  const metas = [
    meta("tercera", 5, "2026-01-01T00:00:00Z"),
    meta("segunda", 1, "2026-03-01T00:00:00Z"),
    meta("primera", 1, "2026-02-01T00:00:00Z"),
  ];
  const acciones = metas.map((m, i) => accion(`a${i}`, 9, 1, { metaId: m.id }));
  assert.deepEqual(
    ordenarMetas(metas, acciones).map((m) => m.id),
    ["primera", "segunda", "tercera"],
  );
  // Sin acciones todas empatan en "al final", y el desempate es el mismo.
  assert.deepEqual(
    ordenarMetas(metas, []).map((m) => m.id),
    ["primera", "segunda", "tercera"],
  );
});

test("ordenarMetas: no muta la lista que recibe", () => {
  const metas = [meta("b"), meta("a")];
  const acciones = [accion("a1", 30, 1, { metaId: "a" })];
  ordenarMetas(metas, acciones);
  assert.deepEqual(metas.map((m) => m.id), ["b", "a"]);
});

test("metasQueEspera: nombra las metas de lo que sus acciones requieren", () => {
  const metas = [meta("ahorro"), meta("registro"), meta("recepcion")];
  const acciones = [
    accion("a1", 30, 1, { metaId: "ahorro" }),
    accion("r1", 12, 1, { metaId: "registro" }),
    accion("f1", 4, 1, { metaId: "recepcion" }),
  ];
  const deps: Requisito[] = [
    { accionId: "r1", requiereId: "a1" },
    { accionId: "f1", requiereId: "r1" },
  ];
  assert.deepEqual(metasQueEspera("registro", acciones, deps, metas).map((m) => m.titulo), ["ahorro"]);
  assert.deepEqual(metasQueEspera("recepcion", acciones, deps, metas).map((m) => m.titulo), ["registro"]);
  // Nadie la precede: no hay "↳ después de".
  assert.deepEqual(metasQueEspera("ahorro", acciones, deps, metas), []);
});

test("metasQueEspera: dos se nombran en el orden en que llegan las metas", () => {
  const metas = [meta("ahorro"), meta("registro"), meta("recepcion")];
  const acciones = [
    accion("a1", 30, 1, { metaId: "ahorro" }),
    accion("r1", 12, 1, { metaId: "registro" }),
    accion("f1", 4, 1, { metaId: "recepcion" }),
  ];
  const deps: Requisito[] = [
    { accionId: "f1", requiereId: "r1" },
    { accionId: "f1", requiereId: "a1" },
  ];
  assert.deepEqual(
    metasQueEspera("recepcion", acciones, deps, metas).map((m) => m.titulo),
    ["ahorro", "registro"],
  );
});

test("metasQueEspera: no cuenta la propia meta, la acción sin meta ni la borrada", () => {
  const metas = [meta("registro"), meta("recepcion")];
  const acciones = [
    accion("r1", 12, 1, { metaId: "registro" }),
    accion("r2", 10, 1, { metaId: "registro" }),
    accion("suelta", 20, 1, { metaId: null }),
  ];
  const deps: Requisito[] = [
    // Dentro de la misma meta: ya se dibuja como flecha.
    { accionId: "r2", requiereId: "r1" },
    // "Sin meta" no es una fase.
    { accionId: "r1", requiereId: "suelta" },
    // La acción ya no existe: se ignora, igual que en queTocaAhora.
    { accionId: "r1", requiereId: "borrada" },
    // Quien requiere no es de esta boda/meta: no aporta nada.
    { accionId: "fantasma", requiereId: "r1" },
  ];
  assert.deepEqual(metasQueEspera("registro", acciones, deps, metas), []);
});

test("metasQueEspera: un ciclo entre metas devuelve cada una a la otra, sin excepción", () => {
  const metas = [meta("ahorro"), meta("recepcion")];
  const acciones = [
    accion("a1", 30, 1, { metaId: "ahorro" }),
    accion("f1", 20, 1, { metaId: "recepcion" }),
  ];
  const deps: Requisito[] = [
    { accionId: "f1", requiereId: "a1" },
    { accionId: "a1", requiereId: "f1" },
  ];
  assert.deepEqual(metasQueEspera("recepcion", acciones, deps, metas).map((m) => m.id), ["ahorro"]);
  assert.deepEqual(metasQueEspera("ahorro", acciones, deps, metas).map((m) => m.id), ["recepcion"]);
});

test("metasQueEspera: una dependencia hacia una idea suelta sí nombra su meta", () => {
  // La precedencia existe aunque lo requerido todavía no tenga sitio: la
  // pareja ya dijo que una fase espera a la otra.
  const metas = [meta("ahorro"), meta("recepcion")];
  const acciones = [idea("a0", { metaId: "ahorro" }), accion("f1", 10, 1, { metaId: "recepcion" })];
  const deps: Requisito[] = [{ accionId: "f1", requiereId: "a0" }];
  assert.deepEqual(metasQueEspera("recepcion", acciones, deps, metas).map((m) => m.id), ["ahorro"]);
});
