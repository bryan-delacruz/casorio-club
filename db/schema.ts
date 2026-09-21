import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Los datos de la boda misma. Todo lo demás vive en Clerk.
 *
 * La fila se crea sola la primera vez que hace falta: la boda existe desde
 * que existe la organización en Clerk, aunque aquí no haya nada escrito.
 */
export const bodas = pgTable("bodas", {
  /** orgId de Clerk. */
  id: text("id").primaryKey(),

  /** El día. Null mientras no lo hayan decidido. */
  fecha: date("fecha"),

  actualizadaEl: timestamp("actualizada_el", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Boda = typeof bodas.$inferSelect;

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

    /**
     * Cuándo cae en el calendario, contado hacia atrás desde la boda: 12 son
     * doce semanas antes, 0 es el mismo día, -4 son cuatro después.
     *
     * Se guarda relativo y no como fecha porque mover la boda mueve todo
     * con ella, que es lo que pasa de verdad cuando se cambia el día.
     * Null = todavía sin decidir; el diagrama la coloca según su momento.
     */
    inicioSemanas: integer("inicio_semanas"),
    duracionSemanas: integer("duracion_semanas").notNull().default(1),

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

/**
 * Cada vez que sale plata por una acción.
 *
 * El adelanto y el saldo no son campos: son la suma de estas filas contra el
 * monto de la acción. Un solo campo "ya pagado" obligaría a sobrescribirlo en
 * cada abono y no diría cuándo se pagó, que es justo lo que uno olvida.
 * Al fotógrafo se le deja algo al reservar y el resto después.
 */
export const pagos = pgTable(
  "pagos",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** orgId de Clerk. Repetido aquí para poder filtrar sin cruzar tablas. */
    bodaId: text("boda_id").notNull(),

    accionId: uuid("accion_id")
      .notNull()
      .references(() => acciones.id, { onDelete: "cascade" }),

    /** numeric por lo mismo que el monto de la acción: céntimos exactos. */
    monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),

    /**
     * Quién puso la plata. Copia del responsable al momento de pagar, no una
     * lectura en vivo: si mañana la acción cambia de dueño, quien pagó sigue
     * siendo el que pagó.
     */
    pagadoPorId: text("pagado_por_id"),

    /** Solo el día. La hora de un adelanto no le importa a nadie. */
    fecha: date("fecha").notNull(),

    nota: text("nota"),

    creadoEl: timestamp("creado_el", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("pagos_boda_accion_idx").on(t.bodaId, t.accionId)],
);

export type Pago = typeof pagos.$inferSelect;

/**
 * Qué tiene que estar listo antes de qué.
 *
 * Una fila dice "accionId necesita que requiereId esté hecha". Se guardan
 * como pares y no como una lista dentro de la acción para poder preguntar
 * en los dos sentidos: qué necesita esto, y a quién frena.
 */
export const dependencias = pgTable(
  "dependencias",
  {
    bodaId: text("boda_id").notNull(),
    accionId: uuid("accion_id")
      .notNull()
      .references(() => acciones.id, { onDelete: "cascade" }),
    requiereId: uuid("requiere_id")
      .notNull()
      .references(() => acciones.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.accionId, t.requiereId] }),
    index("dependencias_boda_idx").on(t.bodaId),
  ],
);

export type Dependencia = typeof dependencias.$inferSelect;
