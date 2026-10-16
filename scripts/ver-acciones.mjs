import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const r = await sql`SELECT titulo, inicio_semanas, duracion_semanas, es_hito, cuesta_tiempo, monto, estado, creada_el FROM acciones ORDER BY creada_el DESC LIMIT 10`;
console.log("filas:", r.length);
for (const a of r)
  console.log(
    ` - "${a.titulo}" | semanas:${a.inicio_semanas ?? "idea suelta"} dura:${a.duracion_semanas}` +
      `${a.es_hito ? " | hito" : ""} | ${a.estado} | tiempo:${a.cuesta_tiempo} | monto:${a.monto}`,
  );
