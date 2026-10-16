import "server-only";
import { eq, lt, and } from "drizzle-orm";
import { getDb } from "@/db";
import { acciones, bodas, dependencias, metas, pagos } from "@/db/schema";

/**
 * La boda de ejemplo para "Probar la demo".
 *
 * Son identificadores de Clerk, no secretos: quien entra lo hace como Ana, una
 * integrante más (no administradora, para que no pueda borrar la boda), y Luis
 * es el otro novio con quien se reparten las cosas. Nombres y montos inventados.
 */
export const DEMO = {
  orgId: "org_3JwwdqpgnAyXoDSHI2x0ocTChHJ",
  visitanteId: "user_3Jwwce0TUxiBp1QfjnntFIHkvAJ", // Ana
  parejaId: "user_3Jwwcrq4l3kyzNahkXshIxLxFqU", // Luis
} as const;

/** Cada cuánto vuelve a su estado original, aunque nadie la haya tocado. */
const VIGENCIA_MS = 12 * 60 * 60 * 1000;

/**
 * El edicto, además de la ceremonia, como hito (docs/metas.md §10): así la
 * tira del próximo hito tiene algo que contar antes de la ceremonia, que con
 * un solo hito en la semana 0 diría siempre lo mismo. Es fiel al trámite —el
 * edicto publicado es el permiso para casarse—, pero es un supuesto de
 * producto: se revierte poniendo esto en false, sin tocar nada más.
 */
const EDICTO_ES_HITO = true;

type Semilla = {
  clave: string;
  titulo: string;
  notas?: string;
  estado: "por_hacer" | "haciendo" | "hecho";
  quien?: "ana" | "luis";
  tiempo?: boolean;
  monto?: string;
  /** Semanas respecto de la boda. Sin esto, queda como idea suelta. */
  inicio?: number;
  duracion?: number;
  requiere?: string[];
  /** A qué meta de la demo va (docs/metas.md §10). */
  meta?: "registro" | "almuerzo";
  hito?: boolean;
  /** Pagos hechos, en días antes de hoy. */
  pagado?: { monto: string; haceDias: number; nota?: string }[];
};

const SEMILLA: Semilla[] = [
  { clave: "partidas", titulo: "Partida de nacimiento de los dos", estado: "hecho", quien: "ana", tiempo: true, monto: "40", inicio: 12, duracion: 2, pagado: [{ monto: "40", haceDias: 20 }], meta: "registro" },
  { clave: "dni", titulo: "Copia del DNI de los dos", estado: "hecho", quien: "luis", tiempo: true, inicio: 12, meta: "registro" },
  { clave: "domicilio", titulo: "Certificado domiciliario", estado: "hecho", quien: "luis", tiempo: true, monto: "30", inicio: 11, pagado: [{ monto: "30", haceDias: 12 }], meta: "registro" },
  { clave: "medico", titulo: "Certificado médico prenupcial", notas: "En el centro de salud del distrito. Pedir cita con anticipación.", estado: "haciendo", quien: "ana", tiempo: true, monto: "120", inicio: 9, duracion: 2, meta: "registro" },
  { clave: "testigos", titulo: "Elegir a los dos testigos", notas: "Mayores de edad, con DNI vigente.", estado: "hecho", quien: "ana", inicio: 10, meta: "registro" },
  { clave: "expediente", titulo: "Expediente en la municipalidad", estado: "por_hacer", quien: "luis", tiempo: true, monto: "250", inicio: 7, requiere: ["partidas", "dni", "domicilio", "medico", "testigos"], meta: "registro" },
  { clave: "edicto", titulo: "Edicto matrimonial", estado: "por_hacer", quien: "luis", tiempo: true, monto: "80", inicio: 6, duracion: 2, requiere: ["expediente"], meta: "registro", hito: EDICTO_ES_HITO },
  { clave: "fotografo", titulo: "Reservar el fotógrafo", estado: "haciendo", quien: "ana", monto: "1800", inicio: 8, pagado: [{ monto: "500", haceDias: 9, nota: "Adelanto para separar la fecha" }] },
  { clave: "almuerzo", titulo: "Reservar el restaurante para el almuerzo", notas: "Para 40 personas.", estado: "haciendo", quien: "luis", monto: "3600", inicio: 8, pagado: [{ monto: "1000", haceDias: 15, nota: "Adelanto" }, { monto: "800", haceDias: 3 }], meta: "almuerzo" },
  { clave: "vestido", titulo: "Vestido", estado: "haciendo", quien: "ana", tiempo: true, monto: "1500", inicio: 6, duracion: 4, pagado: [{ monto: "600", haceDias: 6 }] },
  { clave: "traje", titulo: "Traje", estado: "por_hacer", quien: "luis", tiempo: true, monto: "900", inicio: 4, duracion: 2 },
  { clave: "anillos", titulo: "Comprar los anillos", estado: "por_hacer", monto: "2400", inicio: 4, duracion: 2 },
  { clave: "ceremonia", titulo: "Ceremonia civil en la municipalidad", estado: "por_hacer", inicio: 0, requiere: ["edicto", "anillos"], meta: "registro", hito: true },
  { clave: "fiesta", titulo: "Almuerzo con la familia", estado: "por_hacer", inicio: 0, requiere: ["almuerzo"], meta: "almuerzo" },
  { clave: "acta", titulo: "Acta de matrimonio", estado: "por_hacer", quien: "luis", tiempo: true, inicio: -2, requiere: ["ceremonia"], meta: "registro" },
  { clave: "estado-civil", titulo: "Actualizar el estado civil en el DNI", estado: "por_hacer", quien: "ana", tiempo: true, monto: "30", inicio: -4, duracion: 2, requiere: ["acta"] },
  { clave: "video", titulo: "Video corto para compartir con la familia", estado: "por_hacer" },
  { clave: "dulces", titulo: "Mesa de dulces", estado: "por_hacer", monto: "400" },
];

function diasDesdeHoy(dias: number) {
  const d = new Date(Date.now() + dias * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/**
 * Deja la boda de ejemplo como recién preparada, con la ceremonia a diez
 * semanas de hoy. Solo si nadie la reinició en las últimas horas, para que dos
 * visitas seguidas no se borren el trabajo la una a la otra.
 */
export async function reiniciarDemoSiHaceFalta() {
  const db = getDb();
  const limite = new Date(Date.now() - VIGENCIA_MS);
  const [boda] = await db.select().from(bodas).where(eq(bodas.id, DEMO.orgId));
  if (boda && boda.actualizadaEl > limite) return;

  // Marcar primero evita que dos visitas simultáneas reinicien a la vez.
  if (boda) {
    const tomadas = await db
      .update(bodas)
      .set({ actualizadaEl: new Date() })
      .where(and(eq(bodas.id, DEMO.orgId), lt(bodas.actualizadaEl, limite)))
      .returning({ id: bodas.id });
    if (tomadas.length === 0) return;
  }

  await db.delete(acciones).where(eq(acciones.bodaId, DEMO.orgId)); // pagos y dependencias caen en cascada
  await db.delete(metas).where(eq(metas.bodaId, DEMO.orgId));
  const [metaRegistro, metaAlmuerzo] = await db
    .insert(metas)
    .values([
      { bodaId: DEMO.orgId, titulo: "Registro civil", orden: 0 },
      { bodaId: DEMO.orgId, titulo: "Almuerzo", orden: 1 },
    ])
    .returning({ id: metas.id, titulo: metas.titulo })
    // RETURNING no garantiza el orden: se ordena por título conocido.
    .then((filas) => [
      filas.find((f) => f.titulo === "Registro civil")!,
      filas.find((f) => f.titulo === "Almuerzo")!,
    ]);
  const metaDe = { registro: metaRegistro.id, almuerzo: metaAlmuerzo.id };
  await db
    .insert(bodas)
    .values({ id: DEMO.orgId, fecha: diasDesdeHoy(70), actualizadaEl: new Date() })
    .onConflictDoUpdate({
      target: bodas.id,
      set: { fecha: diasDesdeHoy(70), actualizadaEl: new Date() },
    });

  const quien = { ana: DEMO.visitanteId, luis: DEMO.parejaId };
  const creadas = await db
    .insert(acciones)
    .values(
      // `orden` es solo el contador de llegada: el sitio de cada acción lo dan
      // sus semanas (docs/metas.md §3).
      SEMILLA.map((s, i) => ({
        bodaId: DEMO.orgId,
        titulo: s.titulo,
        notas: s.notas ?? null,
        estado: s.estado,
        responsableId: s.quien ? quien[s.quien] : null,
        cuestaTiempo: s.tiempo ?? false,
        monto: s.monto ?? null,
        inicioSemanas: s.inicio ?? null,
        duracionSemanas: s.duracion ?? 1,
        metaId: s.meta ? metaDe[s.meta] : null,
        esHito: s.hito ?? false,
        orden: i,
      })),
    )
    .returning({ id: acciones.id, titulo: acciones.titulo });

  // Por título (únicos en la semilla): el orden de RETURNING no está garantizado.
  const idPorTitulo = new Map(creadas.map((c) => [c.titulo, c.id]));
  const idDe = new Map(SEMILLA.map((s) => [s.clave, idPorTitulo.get(s.titulo)!]));

  const filasPagos = SEMILLA.flatMap((s) =>
    (s.pagado ?? []).map((p) => ({
      bodaId: DEMO.orgId,
      accionId: idDe.get(s.clave)!,
      monto: p.monto,
      pagadoPorId: s.quien ? quien[s.quien] : null,
      fecha: diasDesdeHoy(-p.haceDias),
      nota: p.nota ?? null,
    })),
  );
  if (filasPagos.length) await db.insert(pagos).values(filasPagos);

  const filasDependencias = SEMILLA.flatMap((s) =>
    (s.requiere ?? []).map((r) => ({
      bodaId: DEMO.orgId,
      accionId: idDe.get(s.clave)!,
      requiereId: idDe.get(r)!,
    })),
  );
  if (filasDependencias.length) await db.insert(dependencias).values(filasDependencias);
}
