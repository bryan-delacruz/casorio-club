import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aCentimos,
  cuentaDe,
  etiquetaDeDinero,
  pagosPorAccion,
  UMBRAL_DE_MAS,
  desbalance,
  etiquetaDePago,
  partes,
  POR_REPARTIR,
  reparte,
  repartoDePagos,
  type PagoLite,
} from "./pagos.ts";

const pago = (id: string, monto: string, extra: Partial<PagoLite> = {}): PagoLite => ({
  id,
  monto,
  pagadoPorId: null,
  fecha: "2026-03-05",
  nota: null,
  creadoEl: new Date("2026-03-05T12:00:00Z"),
  ...extra,
});

const miembros = (...ids: string[]) => ids.map((id) => ({ id }));

// ---------------------------------------------------------------------------
// cuentaDe
// ---------------------------------------------------------------------------

test("cuentaDe: sin monto no hay nada que pagar", () => {
  assert.deepEqual(cuentaDe(null, []), {
    total: 0,
    pagado: 0,
    falta: 0,
    deMas: 0,
    sinTotal: true,
    costando: 0,
  });
});

test("cuentaDe: con monto y sin pagos falta todo", () => {
  assert.deepEqual(cuentaDe("250.00", []), {
    total: 250,
    pagado: 0,
    falta: 250,
    deMas: 0,
    sinTotal: false,
    costando: 250,
  });
});

test("cuentaDe: pagado parcial", () => {
  const c = cuentaDe("250.00", [{ monto: "100.00" }, { monto: "50.50" }]);
  assert.deepEqual(c, {
    total: 250,
    pagado: 150.5,
    falta: 99.5,
    deMas: 0,
    sinTotal: false,
    costando: 250,
  });
});

test("cuentaDe: pagado exacto deja el saldo en cero", () => {
  assert.equal(cuentaDe("250.00", [{ monto: "250.00" }]).falta, 0);
  assert.equal(cuentaDe("250.00", [{ monto: "250.00" }]).deMas, 0);
});

test("cuentaDe: pagado de más no baja de cero", () => {
  const c = cuentaDe("250.00", [{ monto: "300.00" }]);
  assert.equal(c.pagado, 300);
  assert.equal(c.falta, 0);
  assert.equal(c.deMas, 50);
});

test("cuentaDe: sin monto, lo puesto no es exceso de nada", () => {
  const c = cuentaDe(null, [{ monto: "450.00" }]);
  assert.deepEqual([c.sinTotal, c.deMas, c.costando], [true, 0, 450]);
});

test("cuentaDe: costando = max(lo calculado, lo puesto) en los cuatro cruces", () => {
  // Pagar más de lo calculado es el caso que motiva el max: esa plata ya
  // salió, así que manda lo puesto.
  assert.equal(cuentaDe("1200.00", [{ monto: "1380.00" }]).costando, 1380);
  assert.equal(cuentaDe("1200.00", [{ monto: "450.00" }]).costando, 1200);
  assert.equal(cuentaDe("1200.00", []).costando, 1200);
  assert.equal(cuentaDe(null, [{ monto: "450.00" }]).costando, 450);
  assert.equal(cuentaDe(null, []).costando, 0);
});

// ---------------------------------------------------------------------------
// etiquetaDeDinero: las siete filas de docs/pagos.md §3.4
// ---------------------------------------------------------------------------

const accionDinero = (
  monto: string | null,
  estado: "por_hacer" | "haciendo" | "hecho" = "por_hacer",
) => ({ monto, estado });

test("etiquetaDeDinero: sin monto y sin pagos no dice nada y no hay 💰", () => {
  assert.equal(etiquetaDeDinero(accionDinero(null), []), null);
  assert.equal(etiquetaDeDinero(accionDinero(null, "hecho"), []), null);
});

test("etiquetaDeDinero: sin monto y con pagos, por hacer o haciendo, 'hasta ahora'", () => {
  const pagados = [{ monto: "450.00" }];
  assert.equal(etiquetaDeDinero(accionDinero(null), pagados), "S/ 450 hasta ahora");
  assert.equal(
    etiquetaDeDinero(accionDinero(null, "haciendo"), pagados),
    "S/ 450 hasta ahora",
  );
});

test("etiquetaDeDinero: sin monto y con pagos, hecha o por hacer dicen lo mismo", () => {
  const pagados = [{ monto: "450.00" }];
  const porHacer = etiquetaDeDinero(accionDinero(null, "por_hacer"), pagados);
  const hecha = etiquetaDeDinero(accionDinero(null, "hecho"), pagados);
  assert.equal(hecha, porHacer);
  assert.equal(hecha, "S/ 450 hasta ahora");
});

test("etiquetaDeDinero: monto sin pagos, nada es real todavía", () => {
  assert.equal(etiquetaDeDinero(accionDinero("1200.00"), []), "S/ 1,200 calculados");
});

test("etiquetaDeDinero: monto con pago parcial dice lo que falta", () => {
  assert.equal(
    etiquetaDeDinero(accionDinero("1200.00"), [{ monto: "450.00" }]),
    "faltan S/ 750 de S/ 1,200",
  );
});

test("etiquetaDeDinero: pagado exacto", () => {
  assert.equal(
    etiquetaDeDinero(accionDinero("1200.00"), [{ monto: "1200.00" }]),
    "S/ 1,200 pagado",
  );
});

test("etiquetaDeDinero: lo puesto pasa lo calculado desde el umbral", () => {
  assert.equal(
    etiquetaDeDinero(accionDinero("1200.00"), [{ monto: "1380.00" }]),
    "S/ 180 más de lo calculado",
  );
  // Justo en el umbral avisa; justo por debajo, no: una línea que aparece y
  // desaparece con cada adelanto es ruido.
  assert.equal(
    etiquetaDeDinero(accionDinero("1200.00"), [{ monto: String(1200 + UMBRAL_DE_MAS) }]),
    "S/ 50 más de lo calculado",
  );
  assert.equal(
    etiquetaDeDinero(accionDinero("1200.00"), [
      { monto: String(1200 + UMBRAL_DE_MAS - 0.01) },
    ]),
    "S/ 1,200 pagado",
  );
});

// ---------------------------------------------------------------------------
// pagosPorAccion
// ---------------------------------------------------------------------------

test("pagosPorAccion: agrupa por acción y no inventa grupos vacíos", () => {
  const porAccion = pagosPorAccion([
    { accionId: "a", monto: "10.00" },
    { accionId: "b", monto: "20.00" },
    { accionId: "a", monto: "30.00" },
  ]);
  assert.deepEqual([...porAccion.keys()], ["a", "b"]);
  assert.equal(porAccion.get("a")?.length, 2);
  assert.equal(porAccion.get("c"), undefined);
});

// ---------------------------------------------------------------------------
// partes
// ---------------------------------------------------------------------------

const suma = (xs: string[]) => xs.reduce((s, x) => s + aCentimos(x), 0);

test("partes: dos con monto par", () => {
  assert.deepEqual(partes("100.00", 2), ["50.00", "50.00"]);
  assert.equal(suma(partes("100.00", 2)), aCentimos("100.00"));
});

test("partes: dos con céntimos impares, el extra al primero", () => {
  assert.deepEqual(partes("100.01", 2), ["50.01", "50.00"]);
  assert.equal(suma(partes("100.01", 2)), aCentimos("100.01"));
});

test("partes: tres de 100 soles", () => {
  assert.deepEqual(partes("100.00", 3), ["33.34", "33.33", "33.33"]);
  assert.equal(suma(partes("100.00", 3)), aCentimos("100.00"));
});

test("partes: un céntimo entre dos", () => {
  assert.deepEqual(partes("0.01", 2), ["0.01", "0.00"]);
});

test("partes: dos céntimos entre tres", () => {
  assert.deepEqual(partes("0.02", 3), ["0.01", "0.01", "0.00"]);
});

test("partes: n = 1 devuelve el monto entero", () => {
  assert.deepEqual(partes("333.33", 1), ["333.33"]);
  assert.equal(suma(partes("333.33", 1)), aCentimos("333.33"));
});

test("partes: la suma es exactamente el monto con n = 1, 2 y 3", () => {
  for (const n of [1, 2, 3]) {
    for (const monto of ["0.01", "100.00", "100.01", "333.33", "1234.57"]) {
      assert.equal(suma(partes(monto, n)), aCentimos(monto), `${monto} entre ${n}`);
    }
  }
});

test("partes: n = 0 devuelve lista vacía y no divide por cero", () => {
  assert.deepEqual(partes("100.00", 0), []);
});

// ---------------------------------------------------------------------------
// repartoDePagos
// ---------------------------------------------------------------------------

test("repartoDePagos: suma por persona", () => {
  const puesto = repartoDePagos(
    [
      pago("1", "100.00", { pagadoPorId: "ana" }),
      pago("2", "50.50", { pagadoPorId: "ana" }),
      pago("3", "20.00", { pagadoPorId: "bryan" }),
    ],
    miembros("ana", "bryan"),
  );
  assert.equal(puesto.get("ana"), 15050);
  assert.equal(puesto.get("bryan"), 2000);
});

test("repartoDePagos: incluye a quien pagó sin responder por nada", () => {
  // La corrección de docs/pagos.md §2: antes este pago se perdía porque la
  // fila salía de los responsables.
  const puesto = repartoDePagos([pago("1", "80.00", { pagadoPorId: "luis" })], miembros("ana", "luis"));
  assert.equal(puesto.get("luis"), 8000);
});

test("repartoDePagos: los nulos se agrupan en Por repartir", () => {
  const puesto = repartoDePagos([pago("1", "10.00"), pago("2", "5.00")], miembros("ana"));
  assert.equal(puesto.get(POR_REPARTIR), 1500);
});

test("repartoDePagos: quien ya no es miembro cae en Por repartir", () => {
  const puesto = repartoDePagos([pago("1", "10.00", { pagadoPorId: "se-fue" })], miembros("ana"));
  assert.equal(puesto.get("se-fue"), undefined);
  assert.equal(puesto.get(POR_REPARTIR), 1000);
});

// ---------------------------------------------------------------------------
// desbalance
// ---------------------------------------------------------------------------

const puestoDe = (entradas: Record<string, number>) =>
  new Map(Object.entries(entradas).map(([id, soles]) => [id, Math.round(soles * 100)]));

test("desbalance: null con un solo miembro", () => {
  assert.equal(desbalance(puestoDe({ ana: 500 }), miembros("ana")), null);
});

test("desbalance: null sin ningún pago con pagador conocido", () => {
  assert.equal(desbalance(puestoDe({ [POR_REPARTIR]: 900 }), miembros("ana", "bryan")), null);
});

test("desbalance: null cuando nadie va por debajo del umbral", () => {
  // 100 contra 60: la que va por detrás lo está en 20, menos de 50.
  assert.equal(desbalance(puestoDe({ ana: 100, bryan: 60 }), miembros("ana", "bryan")), null);
});

test("desbalance: con dos devuelve la diferencia entre los dos, no la mitad", () => {
  const d = desbalance(puestoDe({ bryan: 401, ana: 0 }), miembros("bryan", "ana"));
  assert.deepEqual(d, { tipo: "dos", porDelante: "bryan", porDetras: "ana", diferencia: 401 });
});

test("desbalance: con dos, una sola persona ha pagado y sí se dibuja", () => {
  const d = desbalance(puestoDe({ ana: 0, bryan: 200 }), miembros("ana", "bryan"));
  assert.equal(d?.tipo, "dos");
  assert.equal(d?.tipo === "dos" && d.porDetras, "ana");
});

test("desbalance: con tres, los que van por debajo de mayor a menor", () => {
  // 1500 conocidos, parte 500 cada uno.
  const d = desbalance(
    puestoDe({ bryan: 1000, ana: 180, luis: 320 }),
    miembros("bryan", "ana", "luis"),
  );
  assert.deepEqual(d, {
    tipo: "varios",
    faltan: [
      { id: "ana", falta: 320 },
      { id: "luis", falta: 180 },
    ],
  });
});

test("desbalance: con tres, quien no pagó nada entra con su parte entera", () => {
  // 900 conocidos, parte 300: a Luis le falta su parte completa.
  const d = desbalance(puestoDe({ bryan: 900 }), miembros("bryan", "ana", "luis"));
  assert.equal(d?.tipo, "varios");
  assert.deepEqual(d?.tipo === "varios" && d.faltan, [
    { id: "ana", falta: 300 },
    { id: "luis", falta: 300 },
  ]);
});

test("desbalance: lo de Por repartir no entra en el cálculo", () => {
  // Con los 1000 anónimos dentro, la parte subiría a 550 y Bryan también
  // saldría por debajo; sin ellos, la parte es 50 y nadie llega al umbral.
  const puesto = puestoDe({ bryan: 100, ana: 0, luis: 0, [POR_REPARTIR]: 1000 });
  assert.equal(desbalance(puesto, miembros("bryan", "ana", "luis")), null);
});

test("desbalance: omite de la lista a quien va por debajo en menos del umbral", () => {
  // 1200 conocidos entre cuatro, parte 300: a Ana le faltan 290, a Nora 280
  // y a Luis 80, que no llega al umbral.
  const d = desbalance(
    puestoDe({ bryan: 790, ana: 10, luis: 380, nora: 20 }),
    miembros("bryan", "ana", "luis", "nora"),
  );
  assert.deepEqual(d, {
    tipo: "varios",
    faltan: [
      { id: "ana", falta: 290 },
      { id: "nora", falta: 280 },
    ],
  });
});

test("desbalance: tres pagos de 333.33 no desvían el cálculo", () => {
  const puesto = repartoDePagos(
    [
      pago("1", "333.33", { pagadoPorId: "ana" }),
      pago("2", "333.33", { pagadoPorId: "bryan" }),
      pago("3", "333.33", { pagadoPorId: "luis" }),
    ],
    miembros("ana", "bryan", "luis"),
  );
  assert.equal(desbalance(puesto, miembros("ana", "bryan", "luis")), null);
});

test("desbalance: el umbral se puede pasar por parámetro", () => {
  const puesto = puestoDe({ ana: 100, bryan: 60 });
  assert.equal(desbalance(puesto, miembros("ana", "bryan")), null);
  assert.equal(desbalance(puesto, miembros("ana", "bryan"), 10)?.tipo, "dos");
});

// ---------------------------------------------------------------------------
// etiquetaDePago
// ---------------------------------------------------------------------------

test("etiquetaDePago: la nota manda", () => {
  const p = pago("1", "100.00", { nota: "Adelanto" });
  assert.equal(etiquetaDePago([p, pago("2", "100.00")], p), "Adelanto");
});

test("etiquetaDePago: sin nota, el número por orden de fecha", () => {
  const a = pago("a", "100.00", { fecha: "2026-03-05" });
  const b = pago("b", "100.00", { fecha: "2026-01-02" });
  assert.equal(etiquetaDePago([a, b], b), "1.er pago");
  assert.equal(etiquetaDePago([a, b], a), "2.º pago");
});

test("etiquetaDePago: un solo pago sin nota se llama Pago", () => {
  const a = pago("a", "100.00");
  assert.equal(etiquetaDePago([a], a), "Pago");
});

test("etiquetaDePago: dos del mismo día desempatan por creadoEl", () => {
  const a = pago("a", "100.00", { creadoEl: new Date("2026-03-05T18:00:00Z") });
  const b = pago("b", "100.00", { creadoEl: new Date("2026-03-05T09:00:00Z") });
  assert.equal(etiquetaDePago([a, b], b), "1.er pago");
  assert.equal(etiquetaDePago([a, b], a), "2.º pago");
});

test("etiquetaDePago: borrar el primero renumera", () => {
  const a = pago("a", "100.00", { fecha: "2026-01-02" });
  const b = pago("b", "100.00", { fecha: "2026-02-02" });
  const c = pago("c", "100.00", { fecha: "2026-03-02" });
  assert.equal(etiquetaDePago([a, b, c], c), "3.º pago");
  assert.equal(etiquetaDePago([b, c], c), "2.º pago");
});

// ---------------------------------------------------------------------------
// reparte
// ---------------------------------------------------------------------------

test("reparte: los porcentajes suman exactamente 100", () => {
  const p = reparte([567.57, 247.57, 100], 100);
  assert.equal(
    p.reduce((s, n) => s + n, 0),
    100,
  );
});

test("reparte: los montos suman exactamente el objetivo", () => {
  const p = reparte([567.57, 247.57], 815);
  assert.deepEqual(p, [567, 248]);
  assert.equal(
    p.reduce((s, n) => s + n, 0),
    815,
  );
});

test("reparte: todas las partes en cero no inventa nada", () => {
  assert.deepEqual(reparte([0, 0], 100), [0, 0]);
});
