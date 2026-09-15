import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const r = await sql`SELECT titulo, momento, cuesta_tiempo, monto, hecha, creada_el FROM acciones ORDER BY creada_el DESC LIMIT 10`;
console.log("filas:", r.length);
for (const a of r) console.log(` - "${a.titulo}" | ${a.momento} | tiempo:${a.cuesta_tiempo} | monto:${a.monto}`);
