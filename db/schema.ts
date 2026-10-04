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
  uniqueIndex,
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
 * En qué punto está una acción.
 *
 * Tres estados y no un sí/no: "haciendo" es donde se atasca todo — el
 * expediente presentado y en revisión, el vestido en costura. Sin ese estado
 * esas cosas se ven igual que las que nadie ha tocado.
 */
export const estado = pgEnum("estado", ["por_hacer", "haciendo", "hecho"]);

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

    estado: estado("estado").notNull().default("por_hacer"),

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
/** De dónde vino un pago: anotado a mano o asignado desde Bernie Wallet. */
export const origenPago = pgEnum("origen_pago", ["manual", "bernie"]);

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

    origen: origenPago("origen").notNull().default("manual"),

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

// ---------------------------------------------------------------------------
// Integración con Bernie Wallet (docs/integracion-bernie.md)
// ---------------------------------------------------------------------------

export const estadoConexion = pgEnum("estado_conexion", ["activa", "revocada", "error"]);

/**
 * La conexión de una boda con la cuenta de Bernie de quien la autorizó.
 * Una por boda: los gastos que entran los ven todos sus miembros.
 */
export const conexionesBernie = pgTable(
  "conexiones_bernie",
  {
    /** orgId de Clerk. */
    bodaId: text("boda_id").primaryKey(),

    /** userId de Clerk de quien conectó. Si sale de la boda, se desconecta. */
    conectadaPorId: text("conectada_por_id").notNull(),

    /** `sub` del token de Bernie: así un webhook encuentra su boda. */
    bernieUserId: uuid("bernie_user_id").notNull(),

    /** Cifrado AES-256-GCM. Nunca en claro: con él se leen gastos ajenos. */
    refreshToken: text("refresh_token").notNull(),

    /** Último nextCursor de Bernie. Null = la próxima sync empieza de cero. */
    cursor: text("cursor"),

    estado: estadoConexion("estado").notNull().default("activa"),

    /**
     * Lease de la sync en curso. Dos syncs a la vez (webhook + botón) gastarían
     * el mismo refresh token, y Bernie lo rota: una de las dos lo perdería.
     */
    sincronizandoHasta: timestamp("sincronizando_hasta", { withTimezone: true }),

    ultimaSyncEl: timestamp("ultima_sync_el", { withTimezone: true }),
    ultimoError: text("ultimo_error"),

    creadaEl: timestamp("creada_el", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conexiones_bernie_usuario_idx").on(t.bernieUserId)],
);

export type ConexionBernie = typeof conexionesBernie.$inferSelect;

/**
 * La bandeja "Por asignar": gastos que llegaron de Bernie.
 *
 * No se convierten solos en pagos porque un gasto del banco no sabe a qué
 * acción pertenece. Asignarlo crea el pago y lo enlaza aquí; borrar ese pago
 * lo devuelve a la bandeja (on delete set null).
 */
export const gastosBernie = pgTable(
  "gastos_bernie",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bodaId: text("boda_id").notNull(),

    /** id del gasto en Bernie. Único por boda: sincronizar dos veces no duplica. */
    externoId: uuid("externo_id").notNull(),

    fecha: date("fecha").notNull(),
    monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
    moneda: text("moneda").notNull(),
    comercio: text("comercio").notNull(),
    subcategoria: text("subcategoria"),

    pagoId: uuid("pago_id").references(() => pagos.id, { onDelete: "set null" }),

    descartado: boolean("descartado").notNull().default(false),

    /** Ya no está en Bernie (borrado o des-compartido) pero se había asignado. */
    fueraDeBernie: boolean("fuera_de_bernie").notNull().default(false),

    actualizadoEl: timestamp("actualizado_el", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("gastos_bernie_boda_externo_idx").on(t.bodaId, t.externoId),
    index("gastos_bernie_boda_pago_idx").on(t.bodaId, t.pagoId),
  ],
);

export type GastoBernie = typeof gastosBernie.$inferSelect;

/** Idempotencia de webhooks: el mismo webhook-id dos veces se procesa una. */
export const webhooksRecibidos = pgTable("webhooks_recibidos", {
  webhookId: text("webhook_id").primaryKey(),
  recibidoEl: timestamp("recibido_el", { withTimezone: true }).notNull().defaultNow(),
});
