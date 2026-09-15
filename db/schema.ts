import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Dónde vive una acción en el camino a la boda.
 *
 * "idea" no es una lista aparte: es el estado de algo que todavía no sabes
 * dónde poner. Moverlo a un carril es cambiar este único campo.
 */
export const momento = pgEnum("momento", [
  "idea",
  "antes",
  "el_dia",
  "despues",
]);

/**
 * Una sola entidad para todo lo que hay que hacer.
 *
 * No hay tablas separadas de trámites, compras y gastos a propósito: un
 * trámite que cuesta plata ES un gasto, y separarlos obligaría a escribirlo
 * dos veces y dejaría la suma incompleta. Las secciones de la app son vistas
 * sobre esta tabla: "gastos" son las acciones con monto, y así.
 *
 * Lo que una acción te exige se lee de dos campos:
 *   cuesta_tiempo = true  → ⏱
 *   monto != null         → 💰
 * Puede ser una, las dos, o ninguna.
 */
export const acciones = pgTable(
  "acciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** orgId de Clerk. Los permisos viven en Clerk, aquí solo el contenido. */
    bodaId: text("boda_id").notNull(),

    titulo: text("titulo").notNull(),
    notas: text("notas"),

    momento: momento("momento").notNull().default("idea"),

    cuestaTiempo: boolean("cuesta_tiempo").notNull().default(false),

    /** numeric, no float: en coma flotante 0.1 + 0.2 no da 0.3 y se pierden céntimos. */
    monto: numeric("monto", { precision: 12, scale: 2 }),
    moneda: text("moneda").notNull().default("PEN"),

    /** userId de Clerk. Null = todavía sin dueño. */
    responsableId: text("responsable_id"),

    hecha: boolean("hecha").notNull().default(false),

    /** Posición dentro de su carril, para ordenar a mano. */
    orden: integer("orden").notNull().default(0),

    creadaEl: timestamp("creada_el", { withTimezone: true })
      .notNull()
      .defaultNow(),
    actualizadaEl: timestamp("actualizada_el", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Toda consulta filtra por boda; sin este índice se escanea la tabla entera.
    index("acciones_boda_momento_idx").on(t.bodaId, t.momento, t.orden),
  ],
);

export type Accion = typeof acciones.$inferSelect;
export type AccionNueva = typeof acciones.$inferInsert;
