import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const cols = await sql`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'acciones' ORDER BY ordinal_position`;
console.log("columnas de 'acciones':");
for (const c of cols) console.log(` - ${c.column_name} (${c.data_type})`);
const idx = await sql`SELECT indexname FROM pg_indexes WHERE tablename='acciones'`;
console.log("índices:", idx.map(i => i.indexname).join(", "));
