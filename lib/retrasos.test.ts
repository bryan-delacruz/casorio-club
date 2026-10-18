import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { proyeccion, resumenRetraso } from "./retrasos.ts";
import type { AccionCamino, Requisito } from "./metas.ts";

/**
 * Una acción del camino. `inicio` cuenta hacia atrás desde la boda: más
 * grande es más temprano (docs/metas.md §2).
 */
const accion = (
  id: string,
  inicio: number | null,
  dura = 1,
  estado: AccionCamino["estado"] = "por_hacer",
  esHito = false,
): AccionCamino => ({
  id,
  titulo: id,
  inicioSemanas: inicio,
  duracionSemanas: dura,
  esHito,
  estado,
  monto: null,
  metaId: null,
});

const req = (accionId: string, requiereId: string): Requisito => ({ accionId, requiereId });

describe("proyeccion", () => {
  it("sin fecha de boda no avisa de nada", () => {
    assert.equal(proyeccion([accion("a", 12)], [], null).size, 0);
  });

  it("una semana que todavía no llegó no se atrasa", () => {
    // Faltan 10 semanas y esto empieza cuando falten 4: va con tiempo.
    assert.equal(proyeccion([accion("a", 4)], [], 10).size, 0);
  });

  it("un inicio que ya pasó se atrasa exactamente lo que pasó", () => {
    // Debía empezar con 12 por delante y ya solo quedan 10.
    const p = proyeccion([accion("a", 12)], [], 10);
    assert.deepEqual(p.get("a"), { inicioReal: 10, finReal: 10, atraso: 2, noLlega: false });
  });

  it("lo hecho nunca se atrasa, aunque su semana haya pasado", () => {
    assert.equal(proyeccion([accion("a", 12, 1, "hecho")], [], 2).size, 0);
  });

  it('"haciendo" cuenta como no hecha', () => {
    assert.equal(proyeccion([accion("a", 12, 1, "haciendo")], [], 10).get("a")?.atraso, 2);
  });

  it("lo hecho no empuja a quien lo espera", () => {
    // El requisito está hecho, así que "b" puede ir en su semana de siempre.
    const lista = [accion("a", 12, 1, "hecho"), accion("b", 4)];
    assert.equal(proyeccion(lista, [req("b", "a")], 10).size, 0);
  });

  it("lo no hecho empuja a quien lo espera a la semana siguiente", () => {
    // "a" acaba de verdad en 10; "b" no puede empezar antes de 9.
    const lista = [accion("a", 12), accion("b", 11)];
    const p = proyeccion(lista, [req("b", "a")], 10);
    assert.equal(p.get("a")?.finReal, 10);
    assert.equal(p.get("b")?.inicioReal, 9);
    assert.equal(p.get("b")?.atraso, 2);
  });

  it("el empuje se propaga por una cadena de tres", () => {
    const lista = [accion("a", 12), accion("b", 11), accion("c", 10)];
    const p = proyeccion(lista, [req("b", "a"), req("c", "b")], 10);
    assert.equal(p.get("a")?.finReal, 10);
    assert.equal(p.get("b")?.finReal, 9);
    assert.equal(p.get("c")?.finReal, 8);
    assert.equal(p.get("c")?.atraso, 2);
  });

  it("una duración larga empuja más de una semana", () => {
    const lista = [accion("a", 12, 4), accion("b", 8)];
    const p = proyeccion(lista, [req("b", "a")], 10);
    // "a" empieza en 10 y dura 4: acaba en 7. "b" no puede antes de 6.
    assert.equal(p.get("a")?.finReal, 7);
    assert.equal(p.get("b")?.inicioReal, 6);
  });

  it("un día clave dura una semana, diga lo que diga la duración", () => {
    const p = proyeccion([accion("a", 12, 5, "por_hacer", true)], [], 10);
    assert.equal(p.get("a")?.finReal, 10);
  });

  it("no llega: el final real cae después de la boda", () => {
    // Quedan 2 semanas, dura 5: acaba 2 semanas después de la boda.
    const p = proyeccion([accion("a", 6, 5)], [], 2);
    assert.equal(p.get("a")?.finReal, -2);
    assert.equal(p.get("a")?.noLlega, true);
  });

  it("lo planeado a propósito para después de la boda no es un retraso", () => {
    // Cambiar el DNI: planeado para 4 semanas DESPUÉS, y va con tiempo.
    assert.equal(proyeccion([accion("a", -4)], [], 10).size, 0);
  });

  it("lo planeado después de la boda y atrasado no cuenta como que no llega", () => {
    // Planeado para una semana después; ya pasó la boda. Se atrasa, pero
    // "no llega a la boda" no es lo que le pasa.
    const p = proyeccion([accion("a", -1)], [], -3);
    assert.equal(p.get("a")?.atraso, 2);
    assert.equal(p.get("a")?.noLlega, false);
  });

  it("las ideas sueltas no entran: no tienen semana", () => {
    assert.equal(proyeccion([accion("a", null)], [], 10).size, 0);
  });

  it("un ciclo guardado no cuelga la cuenta", () => {
    const lista = [accion("a", 12), accion("b", 12)];
    const p = proyeccion(lista, [req("a", "b"), req("b", "a")], 10);
    assert.equal(p.size, 2);
  });

  it("un requisito borrado o sin semana no empuja a nadie", () => {
    const lista = [accion("b", 4)];
    assert.equal(proyeccion(lista, [req("b", "fantasma")], 10).size, 0);
  });
});

describe("resumenRetraso", () => {
  it("sin fecha de boda no hay nada que resumir", () => {
    assert.deepEqual(resumenRetraso([accion("a", 12)], [], null), { cuantas: 0, peor: null });
  });

  it("cuenta las atrasadas", () => {
    const lista = [accion("a", 12), accion("b", 11), accion("c", 2)];
    assert.equal(resumenRetraso(lista, [], 10).cuantas, 2);
  });

  it("peor es null cuando hay retraso pero todo llega", () => {
    assert.equal(resumenRetraso([accion("a", 12)], [], 10).peor, null);
  });

  it("peor es la que más se pasa entre las que no llegan", () => {
    // Quedan 2 semanas. "poco" y "mucho" debían haber empezado ya y, al
    // empezar hoy, se pasan de la boda; "tarde" se atrasa pero llega.
    const lista = [accion("poco", 5, 4), accion("mucho", 7, 6), accion("tarde", 12)];
    const r = resumenRetraso(lista, [], 2);
    assert.equal(r.cuantas, 3);
    assert.equal(r.peor?.accion.id, "mucho");
    assert.equal(r.peor?.atraso, 5);
  });

  it("lo planeado a propósito para pasarse de la boda no es un retraso", () => {
    // Empieza justo hoy y dura 5: se pasa de la boda, pero así estaba
    // planeado y no hay nada que avisar.
    assert.deepEqual(resumenRetraso([accion("a", 2, 5)], [], 2), { cuantas: 0, peor: null });
  });
});
