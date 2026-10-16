/**
 * Paso 1 del despliegue de docs/metas.md §3.1: materializa `POR_DEFECTO` en
 * `inicio_semanas` antes de que el código deje de leer `momento`.
 *
 * Queda versionado para que haya constancia de qué valores se supusieron:
 * antes = 8, el día = 0, después = −2, los mismos que usaba `lib/metas.ts` al
 * leer. Solo toca filas sin semanas que no eran ideas, así que es idempotente
 * y solo agrega información: correrlo dos veces no cambia nada la segunda.
 *
 *   DATABASE_URL=... node scripts/rellenar-inicio-semanas.mjs --dry-run
 *   DATABASE_URL=... node scripts/rellenar-inicio-semanas.mjs
 *
 * Con --renombrar-titulos corre además el paso 1b (opcional, ver abajo).
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const soloContar = process.argv.includes("--dry-run");

const [{ pendientes }] = await sql`
  SELECT count(*)::int AS pendientes
  FROM acciones
  WHERE inicio_semanas IS NULL
    AND momento <> 'idea'`;
console.log(`filas por rellenar: ${pendientes}`);

if (soloContar) {
  console.log("--dry-run: no se escribió nada.");
} else if (pendientes === 0) {
  console.log("nada que hacer: ya está rellenado.");
} else {
  const filas = await sql`
    UPDATE acciones
       SET inicio_semanas = CASE momento
             WHEN 'antes'   THEN 8
             WHEN 'el_dia'  THEN 0
             WHEN 'despues' THEN -2
           END
     WHERE inicio_semanas IS NULL
       AND momento <> 'idea'
    RETURNING id`;
  console.log(`filas rellenadas: ${filas.length}`);
}

// Paso 1b de docs/metas.md §3.1: renombra a sustantivo los títulos viejos de la
// plantilla. Es cosmético (los alias de lib/metas.ts ya evitan el duplicado),
// así que solo corre con --renombrar-titulos. Salta la boda que ya tenga el
// título nuevo porque `acciones` no tiene índice único por título.
if (process.argv.includes("--renombrar-titulos")) {
  // Los tres títulos no llevan tildes, así que basta lower(); sin depender de
  // `unaccent` (pregunta abierta nº 6 de la spec).
  const [{ porRenombrar }] = await sql`
    SELECT count(*)::int AS "porRenombrar"
      FROM acciones a
      JOIN (VALUES
             ('publicar el edicto matrimonial', 'Edicto matrimonial'),
             ('presentar el expediente en la municipalidad', 'Expediente en la municipalidad'),
             ('recoger el acta de matrimonio', 'Acta de matrimonio')
           ) AS m(viejo, nuevo) ON lower(a.titulo) = m.viejo
     WHERE NOT EXISTS (
             SELECT 1 FROM acciones b
              WHERE b.boda_id = a.boda_id AND b.id <> a.id
                AND lower(b.titulo) = lower(m.nuevo))`;
  console.log(`títulos por renombrar: ${porRenombrar}`);
  if (soloContar) {
    console.log("--dry-run: no se renombró nada.");
  } else {
    const filas = await sql`
      UPDATE acciones a
         SET titulo = m.nuevo
        FROM (VALUES
               ('publicar el edicto matrimonial', 'Edicto matrimonial'),
               ('presentar el expediente en la municipalidad', 'Expediente en la municipalidad'),
               ('recoger el acta de matrimonio', 'Acta de matrimonio')
             ) AS m(viejo, nuevo)
       WHERE lower(a.titulo) = m.viejo
         AND NOT EXISTS (
               SELECT 1 FROM acciones b
                WHERE b.boda_id = a.boda_id AND b.id <> a.id
                  AND lower(b.titulo) = lower(m.nuevo))
      RETURNING a.id`;
    console.log(`títulos renombrados: ${filas.length}`);
  }
}
