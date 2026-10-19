import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Los tokens oscuros se declaran dos veces en `app/globals.css`: una para la
 * clase `.dark` y otra bajo `prefers-color-scheme: dark`
 * (docs/modo-oscuro.md §3). CSS no deja compartir un bloque entre una clase y
 * una media query, así que el duplicado es inevitable.
 *
 * Lo que sí se puede evitar es que se desincronicen, que es el error que este
 * proyecto ya pagó una vez con la columna `momento`: dos datos que hay que
 * mantener coherentes a mano. Esta prueba los mantiene coherentes sola.
 */
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

/** Los pares `--token: valor` de un bloque, en un mapa. */
function tokensDe(bloque: string) {
  const pares = new Map<string, string>();
  for (const linea of bloque.split("\n")) {
    const m = linea.match(/^\s*(--[\w-]+)\s*:\s*([^;]+);/);
    if (m) pares.set(m[1], m[2].trim());
  }
  return pares;
}

// `[\s\S]` y no la bandera `s`: el target del proyecto no la admite y
// `tsc --noEmit` falla, aunque Node la ejecute sin quejarse.
const claseDark = css.match(/\n\.dark \{\n([\s\S]*?)\n\}\n/)?.[1];
const porSistema = css.match(
  /@media \(prefers-color-scheme: dark\) \{\n\s*:root \{\n([\s\S]*?)\n\s*\}\n\}/,
)?.[1];

describe("los dos bloques del modo oscuro", () => {
  it("los dos existen en globals.css", () => {
    assert.ok(claseDark, "falta el bloque .dark");
    assert.ok(porSistema, "falta el bloque de prefers-color-scheme: dark");
  });

  it("declaran exactamente los mismos tokens", () => {
    const a = tokensDe(claseDark!);
    const b = tokensDe(porSistema!);
    assert.ok(a.size > 10, "el bloque .dark parece vacío");
    assert.deepEqual([...a.keys()].sort(), [...b.keys()].sort());
  });

  it("les dan exactamente los mismos valores", () => {
    const a = tokensDe(claseDark!);
    const b = tokensDe(porSistema!);
    for (const [token, valor] of a) {
      assert.equal(b.get(token), valor, `${token} difiere entre los dos bloques`);
    }
  });

  it("cubren todos los COLORES que define :root", () => {
    // Un color nuevo en claro que nadie redefine en oscuro se queda claro
    // sobre fondo oscuro, que es el defecto más fácil de colar. Solo los
    // colores: `--radius` y compañía son geometría y valen igual en los dos
    // temas, que es justo lo que esta prueba descubrió al escribirse.
    const esColor = (v: string) => /^(#|rgb|hsl|oklch|color\()/.test(v);
    const raiz = tokensDe(css.match(/\n:root \{\n([\s\S]*?)\n\}\n/)?.[1] ?? "");
    const oscuro = tokensDe(claseDark!);
    const faltan = [...raiz]
      .filter(([token, valor]) => esColor(valor) && !oscuro.has(token))
      .map(([token]) => token);
    assert.deepEqual(faltan, [], `colores sin versión oscura: ${faltan.join(", ")}`);
  });
});
