import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alcanzaDesde,
  candidatas,
  conNuevas,
  esperanA,
  prohibidas,
  requiereDe,
  semanaAlArrastrar,
  tieneCiclo,
  unidasA,
} from "./dependencias.ts";
import type { Requisito } from "./metas.ts";

/** Una acción con lo mínimo que piden `candidatas` y el orden. */
const accion = (
  id: string,
  inicioSemanas: number | null = null,
  metaId: string | null = null,
  titulo = id,
) => ({ id, titulo, inicioSemanas, duracionSemanas: 1, esHito: false, estado: "por_hacer", metaId });

/** `a` requiere a `b`. */
const req = (accionId: string, requiereId: string): Requisito => ({ accionId, requiereId });

const SIN_META = "Sin meta";

describe("requiereDe y esperanA", () => {
  it("son el mismo grafo en los dos sentidos", () => {
    const r = [req("b", "a"), req("c", "a")];
    assert.deepEqual([...requiereDe(r)], [["b", ["a"]], ["c", ["a"]]]);
    assert.deepEqual([...esperanA(r)], [["a", ["b", "c"]]]);
  });

  it("descartan la arista de una acción contra sí misma", () => {
    assert.equal(requiereDe([req("a", "a")]).size, 0);
    assert.equal(esperanA([req("a", "a")]).size, 0);
  });
});

describe("alcanzaDesde", () => {
  it("no incluye el punto de partida", () => {
    const vistos = alcanzaDesde("a", requiereDe([req("a", "b")]));
    assert.deepEqual([...vistos], ["b"]);
  });

  it("atraviesa una cadena de tres", () => {
    const vecinos = requiereDe([req("a", "b"), req("b", "c"), req("c", "d")]);
    assert.deepEqual([...alcanzaDesde("a", vecinos)].sort(), ["b", "c", "d"]);
  });

  it("no se cuelga con un ciclo ya guardado", () => {
    const vecinos = requiereDe([req("a", "b"), req("b", "c"), req("c", "a")]);
    assert.deepEqual([...alcanzaDesde("a", vecinos)].sort(), ["b", "c"]);
  });

  it("devuelve vacío cuando no hay ninguna arista", () => {
    assert.equal(alcanzaDesde("a", requiereDe([])).size, 0);
  });
});

describe("prohibidas", () => {
  it('en "antes": la que ya requiere a esta, directa', () => {
    // b requiere a. Marcar b en el "antes" de a haría que a requiera a b.
    assert.deepEqual([...prohibidas("a", [req("b", "a")], "antes")], ["b"]);
  });

  it('en "antes": la que la requiere por una cadena de tres', () => {
    const r = [req("b", "a"), req("c", "b")];
    assert.deepEqual([...prohibidas("a", r, "antes")].sort(), ["b", "c"]);
  });

  it('en "despues": la que esta ya requiere, directa y por cadena', () => {
    const r = [req("a", "b"), req("b", "c")];
    assert.deepEqual([...prohibidas("a", r, "despues")].sort(), ["b", "c"]);
  });

  it("los dos lados prohíben cosas distintas", () => {
    const r = [req("a", "b"), req("c", "a")];
    assert.deepEqual([...prohibidas("a", r, "antes")], ["c"]);
    assert.deepEqual([...prohibidas("a", r, "despues")], ["b"]);
  });

  it("nunca devuelve la propia acción, ni con un ciclo guardado", () => {
    const r = [req("a", "b"), req("b", "a")];
    assert.equal(prohibidas("a", r, "antes").has("a"), false);
    assert.equal(prohibidas("a", r, "despues").has("a"), false);
  });

  it("sin aristas no prohíbe nada", () => {
    assert.equal(prohibidas("a", [], "antes").size, 0);
  });
});

describe("candidatas", () => {
  const metas = [
    { id: "m1", titulo: "Registro civil" },
    { id: "m2", titulo: "La recepción" },
  ];

  it("una boda con una sola acción no tiene nada que elegir", () => {
    // El estado vacío del diálogo ("Anota algo más y podrás poner el orden")
    // y el de la barra se deciden con esto: sin grupos no hay listas que
    // pintar. No se puede alcanzar en el demo, así que se prueba aquí.
    assert.deepEqual(candidatas("sola", [accion("sola", 4, "m1")], [], metas, "antes", SIN_META), []);
    assert.deepEqual(candidatas("sola", [accion("sola", 4, "m1")], [], metas, "despues", SIN_META), []);
  });

  it("nunca ofrece la propia acción", () => {
    const grupos = candidatas("a", [accion("a"), accion("b")], [], [], "despues", SIN_META);
    assert.deepEqual(
      grupos.flatMap((g) => g.candidatas.map((c) => c.accion.id)),
      ["b"],
    );
  });

  it("agrupa por meta en el orden dado y pone Sin meta al final", () => {
    const lista = [
      accion("x", 4, "m2"),
      accion("suelta", 4, null),
      accion("y", 4, "m1"),
      accion("yo", 4, "m1"),
    ];
    const grupos = candidatas("yo", lista, [], metas, "antes", SIN_META);
    assert.deepEqual(
      grupos.map((g) => [g.titulo, g.candidatas.map((c) => c.accion.id)]),
      [
        ["Registro civil", ["y"]],
        ["La recepción", ["x"]],
        ["Sin meta", ["suelta"]],
      ],
    );
  });

  it("no devuelve un grupo vacío", () => {
    // La única acción de m2 es la propia, así que m2 no tiene nada que ofrecer.
    const lista = [accion("yo", 4, "m2"), accion("y", 4, "m1")];
    const grupos = candidatas("yo", lista, [], metas, "antes", SIN_META);
    assert.deepEqual(grupos.map((g) => g.titulo), ["Registro civil"]);
  });

  it("ordena por semana descendente y, a igualdad, por título", () => {
    const lista = [
      accion("yo"),
      accion("cerca", 2, "m1", "Cerca"),
      accion("lejos", 12, "m1", "Lejos"),
      accion("beta", 2, "m1", "Beta"),
    ];
    const [grupo] = candidatas("yo", lista, [], metas, "antes", SIN_META);
    assert.deepEqual(
      grupo.candidatas.map((c) => c.accion.titulo),
      ["Lejos", "Beta", "Cerca"],
    );
  });

  it("pone las ideas sueltas al final de su grupo", () => {
    const lista = [
      accion("yo"),
      accion("idea", null, "m1", "Una idea"),
      accion("puesta", 0, "m1", "Ya con semana"),
    ];
    const [grupo] = candidatas("yo", lista, [], metas, "antes", SIN_META);
    assert.deepEqual(
      grupo.candidatas.map((c) => c.accion.id),
      ["puesta", "idea"],
    );
  });

  it("manda a Sin meta lo que apunta a una meta que ya no está", () => {
    const lista = [accion("yo", 4, "m1"), accion("huerfana", 4, "borrada")];
    const grupos = candidatas("yo", lista, [], metas, "antes", SIN_META);
    assert.deepEqual(
      grupos.map((g) => [g.titulo, g.candidatas.map((c) => c.accion.id)]),
      [["Sin meta", ["huerfana"]]],
    );
  });

  it("marca prohibida donde lo dice prohibidas", () => {
    const lista = [accion("yo", 4, "m1"), accion("b", 4, "m1"), accion("c", 4, "m1")];
    const [grupo] = candidatas("yo", lista, [req("b", "yo")], metas, "antes", SIN_META);
    assert.deepEqual(
      grupo.candidatas.map((c) => [c.accion.id, c.prohibida]),
      [
        ["b", true],
        ["c", false],
      ],
    );
  });
});

describe("conNuevas", () => {
  it("borra las dos direcciones viejas de esa acción y deja el resto intacto", () => {
    const viejas = [req("yo", "a"), req("b", "yo"), req("c", "d")];
    assert.deepEqual(conNuevas("yo", ["x"], ["z"], viejas), [
      req("c", "d"),
      req("yo", "x"),
      req("z", "yo"),
    ]);
  });

  it("con las dos listas vacías deja la acción sin ninguna arista", () => {
    const viejas = [req("yo", "a"), req("b", "yo"), req("c", "d")];
    assert.deepEqual(conNuevas("yo", [], [], viejas), [req("c", "d")]);
  });

  it("descarta la propia acción y los duplicados", () => {
    const hechas = conNuevas("yo", ["yo", "a", "a"], ["yo", "b", "b"], []);
    assert.deepEqual(hechas, [req("yo", "a"), req("b", "yo")]);
  });
});

describe("tieneCiclo", () => {
  it("es falso en un grafo vacío, en una cadena y en un diamante", () => {
    assert.equal(tieneCiclo([]), false);
    assert.equal(tieneCiclo([req("c", "b"), req("b", "a")]), false);
    // d requiere b y c; las dos requieren a.
    assert.equal(
      tieneCiclo([req("d", "b"), req("d", "c"), req("b", "a"), req("c", "a")]),
      false,
    );
  });

  it("es verdadero en un ciclo de dos, de tres y contra sí misma", () => {
    assert.equal(tieneCiclo([req("a", "b"), req("b", "a")]), true);
    assert.equal(tieneCiclo([req("a", "b"), req("b", "c"), req("c", "a")]), true);
    assert.equal(tieneCiclo([req("a", "a")]), true);
  });

  it("atrapa el círculo que cierran las dos listas juntas", () => {
    // Guardado y sano: b requiere a. Desde `yo` se marca b en "antes" (yo
    // requiere b) y a en "despues" (a requiere yo). El círculo es
    // yo → b → a → yo, y ninguna de las dos listas por separado lo cierra.
    const viejas = [req("b", "a")];
    assert.equal(tieneCiclo(viejas), false);
    assert.equal(tieneCiclo(conNuevas("yo", ["b"], [], viejas)), false);
    assert.equal(tieneCiclo(conNuevas("yo", [], ["a"], viejas)), false);
    assert.equal(tieneCiclo(conNuevas("yo", ["b"], ["a"], viejas)), true);
  });

  it("no denuncia una cadena donde el último solo es destino", () => {
    // El caso que un Kahn mal sembrado rompe: "a" nunca aparece como accionId.
    assert.equal(tieneCiclo([req("c", "b"), req("b", "a")]), false);
  });
});

describe("semanaAlArrastrar", () => {
  it("a la derecha acerca a la boda: resta semanas", () => {
    assert.equal(semanaAlArrastrar(12, 36, 36), 11);
    assert.equal(semanaAlArrastrar(12, 36 * 4, 36), 8);
  });

  it("a la izquierda aleja de la boda: suma semanas", () => {
    assert.equal(semanaAlArrastrar(12, -36, 36), 13);
    assert.equal(semanaAlArrastrar(12, -36 * 3, 36), 15);
  });

  it("encaja en la semana más cercana, no entre dos", () => {
    assert.equal(semanaAlArrastrar(12, 17, 36), 12);
    assert.equal(semanaAlArrastrar(12, 19, 36), 11);
  });

  it("un arrastre que no llega a media columna no mueve nada", () => {
    assert.equal(semanaAlArrastrar(12, 4, 36), 12);
    assert.equal(semanaAlArrastrar(12, 0, 36), 12);
  });

  it("cruza la boda y sigue hacia el otro lado", () => {
    assert.equal(semanaAlArrastrar(1, 36 * 3, 36), -2);
  });

  it("funciona con la columna estrecha del celular", () => {
    assert.equal(semanaAlArrastrar(12, 16, 16), 11);
    assert.equal(semanaAlArrastrar(12, 48, 16), 9);
  });

  it("topa en cinco años a cada lado", () => {
    assert.equal(semanaAlArrastrar(12, -36 * 400, 36), 260);
    assert.equal(semanaAlArrastrar(12, 36 * 400, 36), -260);
  });

  it("sin ancho medido no mueve nada, en vez de dividir por cero", () => {
    assert.equal(semanaAlArrastrar(12, 500, 0), 12);
    assert.equal(semanaAlArrastrar(12, 500, NaN), 12);
  });
});

describe("unidasA", () => {
  it("recoge los dos sentidos", () => {
    const r = [req("yo", "antes"), req("despues", "yo")];
    assert.deepEqual([...unidasA("yo", r)].sort(), ["antes", "despues"]);
  });

  it("no recoge las uniones indirectas: no hay flecha que tocar", () => {
    const r = [req("yo", "a"), req("a", "lejos")];
    assert.deepEqual([...unidasA("yo", r)], ["a"]);
  });

  it("no recoge aristas ajenas", () => {
    assert.equal(unidasA("yo", [req("a", "b")]).size, 0);
  });

  it("descarta la arista de una acción contra sí misma", () => {
    assert.equal(unidasA("yo", [req("yo", "yo")]).size, 0);
  });
});
