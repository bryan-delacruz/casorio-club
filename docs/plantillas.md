# La plantilla del plan: las cuatro metas

> **Spec (SDD).** Este documento manda sobre el código de las plantillas: la
> plantilla "Registro civil" que ya existe y el plan de cuatro metas que la
> contiene. Si algo cambia, primero se actualiza aquí.
>
> **Estado:** aprobada e implementada.
>
> Depende de `docs/metas.md` (§2 el tiempo, §4 la plantilla de registro civil,
> §11.3 el orden derivado de las metas) y de `docs/pagos.md` (§4.3 lo que va
> costando, §6 el presupuesto queda fuera). No repite lo que esos documentos
> deciden.

## 1. Qué es y por qué

Hoy una boda nueva recibe una sola meta, "Registro civil" (`docs/metas.md` §4),
y la pareja tiene que inventarse el resto: la plata, la ropa, el local, la
comida. La plantilla del plan le da **el esqueleto completo de una boda civil
peruana** en un toque: cuatro metas encadenadas, veinticuatro acciones con sus
semanas y sus dependencias, todo editable y todo borrable.

La pregunta de la pareja que contesta, y que ninguna pantalla contesta hoy:
**"¿qué hay que hacer para casarse, y en qué orden?"**. El Mapa contesta "qué
toca ahora" y el Camino "cuándo cae cada cosa", pero las dos parten de una lista
que alguien tuvo que escribir. La plantilla escribe esa lista.

No es una pantalla nueva ni una manera nueva de ver los datos: es **una
escritura** que deja la boda poblada. Después la pareja solo ve el Mapa y el
Camino de siempre.

## 2. Las cuatro metas

| # | Meta | Qué agrupa | Espera a |
|---|---|---|---|
| 1 | **El ahorro** | Cuánto se gasta, quién pone, dónde se junta | — |
| 2 | **Registro civil** | El papeleo y el acto ante la municipalidad | — |
| 3 | **La ceremonia** | Lo que tiene que estar listo ese día | El ahorro |
| 4 | **La recepción** | La fiesta: local, comida, música, invitaciones | El ahorro, Registro civil |

Son las cuatro que pidió la pareja, con tres precisiones:

- **"Registro civil" no se renombra.** El índice único `(boda_id, titulo)` y los
  `alias` de `docs/metas.md` §4.1 reconocen bodas que ya la aplicaron por ese
  título exacto. Renombrarla crearía una segunda meta en toda boda existente.
- **"La ceremonia" no contiene el acto civil.** El acto es el día clave
  `Ceremonia civil` y se queda en Registro civil, porque es lo que cierra la
  cadena del papeleo (partidas → expediente → edicto → ceremonia → acta).
  "La ceremonia" es lo que hay que tener listo para ese día: ropa, anillos,
  fotos, flores, traslado.
- **Ni el papeleo ni el ahorro esperan a nadie.** Arrancan los dos a la vez. El
  papeleo **no** espera al ahorro aunque cueste plata: atarlo pondría el día
  clave a esperar un bote de ahorro, y el trámite se hace igual.

El orden de los carriles **no se guarda**: lo deriva `ordenarMetas` de la semana
más temprana de las acciones de cada meta (`docs/metas.md` §11.3). Las semanas de
§4 están elegidas para que ese orden derivado salga 16 → 12 → 11 → 10, es decir
El ahorro, Registro civil, La ceremonia, La recepción. Si alguien edita las
semanas de la plantilla, el orden de los carriles cambia con ellas: es la
consecuencia buscada, no un efecto raro.

## 3. El ahorro: una meta de decisiones, no de montos

Es la meta distinta de las otras tres y la que más fácil se modela mal. Un monto
en una acción es **plata que sale** y todo total lo suma como coste de la boda
(`docs/pagos.md` §4.3). Una acción "Ahorrar S/ 8 000" sumaría otros S/ 8 000 al
número grande del Reparto: la boda costaría el doble de lo que cuesta.

Por eso, decisión:

- Las cuatro acciones de El ahorro **cuestan tiempo y no llevan monto**
  (`cuesta_tiempo = true`, `monto = null`). Son las decisiones y el hábito de
  juntar, no el dinero juntado.
- **El monto objetivo ya existe en la app y es derivado**: es el número grande
  del Reparto, la suma de lo que va costando el plan. No se guarda, no se repite
  en el carril de El ahorro y no se compara con nada: un techo que la pareja fije
  es columna nueva y pantalla nueva, y queda fuera (`docs/pagos.md` §6).
- La cifra que la pareja acuerde se escribe **en las notas** de la acción
  "Cuánto queremos gastar". Es texto libre en una columna que ya existe; la app
  no hace aritmética con él.
- El avance de El ahorro es el de cualquier meta: acciones hechas sobre el total.
  "Los aportes de cada mes" marcada como hecha significa "ya lo juntamos".

**Ninguna acción de la plantilla trae monto**, tampoco en las otras tres metas.
Los precios de una boda civil peruana dependen del distrito y del proveedor, y
`monto = 0` sería peor que vacío: `cuentaDe` lo leería como un total conocido,
dejaría `falta = 0` y daría "pagado del todo" sin un solo pago. El 💰 aparece
cuando la pareja escribe su número.

> **Dato verificado que no entra en la plantilla.** El tarifario de Santiago de
> Surco (2024) cobra S/ 155.20 por el expediente matrimonial, S/ 120.00 por la
> ceremonia en el salón municipal y S/ 645.00 por la ceremonia fuera del salón
> dentro del distrito en horario laborable. Sirve de orden de magnitud para quien
> implementa; **no se escribe en ninguna acción**, porque es de un solo distrito.

## 4. Las acciones

Todas con `cuesta_tiempo = true` salvo donde se diga, `monto = null` siempre
(§3), y ningún día clave nuevo (§5). Las semanas son relativas a la boda:
positivo antes, 0 el mismo día, negativo después (`docs/metas.md` §2).

### 4.1 El ahorro (4)

| clave | Acción | Semanas antes | Dura | Requiere |
|---|---|---|---|---|
| `cuanto` | Cuánto queremos gastar | 16 | 1 | — |
| `quien-pone` | Quién pone cuánto | 15 | 1 | `cuanto` |
| `bote` | El bote común del ahorro | 14 | 1 | `quien-pone` |
| `aportes` | Los aportes de cada mes | 13 | 9 | `bote` |

`aportes` dura nueve semanas a propósito: es la barra larga que cruza el Gantt y
termina cinco semanas antes de la boda, cuando se pagan los saldos. No hay
recurrencia en el modelo y no se añade: una acción con duración dice lo mismo.

### 4.2 Registro civil (9)

Sin cambios: son los nueve pasos de `docs/metas.md` §4, con sus semanas, sus
dependencias, sus `alias` y su único día clave. La plantilla del plan **los
reutiliza del mismo `REGISTRO_CIVIL`**, no los copia. Si esa tabla cambia, cambia
aquí.

### 4.3 La ceremonia (5)

| clave | Acción | Semanas antes | Dura | Requiere |
|---|---|---|---|---|
| `ropa` | La ropa de los dos | 11 | 4 | `bote` |
| `anillos` | Los anillos | 10 | 2 | `bote` |
| `fotos` | Fotos y video del acto | 9 | 2 | `bote` |
| `ramo` | El ramo y las flores | 2 | 1 | — |
| `traslado` | Cómo llegamos ese día | 2 | 1 | — |

### 4.4 La recepción (6)

| clave | Acción | Semanas antes | Dura | Requiere |
|---|---|---|---|---|
| `local` | El local de la recepción | 10 | 2 | `bote` |
| `invitados` | La lista de invitados | 9 | 2 | `local` |
| `comida` | La comida y la bebida | 8 | 2 | `invitados` |
| `torta` | La torta | 6 | 2 | `invitados` |
| `musica` | La música | 6 | 2 | `local` |
| `invitaciones` | Enviar las invitaciones | 5 | 2 | `invitados`, `expediente` |

`local` antes que `invitados` porque el aforo manda sobre la lista, y no al
revés: es el orden que evita rehacer la lista dos veces.

### 4.5 Los cruces entre metas

Cinco dependencias cruzan de una meta a otra. Son las que hacen aparecer la línea
`↳ después de …` de la barra resumen del Camino (`docs/metas.md` §11.3) y el
texto "Requiere …" de la fila.

| Acción | Requiere | Por qué |
|---|---|---|
| `ropa`, `anillos`, `fotos` | `bote` (El ahorro) | No se compra ni se reserva antes de saber de dónde sale la plata. |
| `local` | `bote` (El ahorro) | El adelanto del local es el primer gasto grande. |
| `invitaciones` | `expediente` (Registro civil) | La invitación lleva día y hora, y la municipalidad los fija al aprobar el expediente. |

Totales de la plantilla: **4 metas, 24 acciones, 21 dependencias**, de las cuales
5 cruzan de meta.

## 5. Un solo día clave en toda la plantilla

El único día clave sigue siendo `Ceremonia civil`. La razón está en
`docs/metas.md` §4 y no se repite: dos difuminarían cuál es el día que importa.
Ni "El bote común del ahorro", ni "El local de la recepción", ni "Enviar las
invitaciones" se marcan. La pareja puede marcar lo que quiera después.

## 6. Modelo de datos

**No hay columnas nuevas.** La plantilla escribe en `metas`, `acciones` y
`dependencias` tal como están hoy: `titulo`, `orden`, `meta_id`, `cuesta_tiempo`,
`inicio_semanas`, `duracion_semanas`, `es_hito`. El agrupamiento en cuatro metas y
los cruces son **datos del código**, no esquema.

> ⚠️ Nada que empujar a Neon antes de mergear. La regla sigue valiendo para
> cualquier enmienda futura: Drizzle selecciona todas las columnas, así que una
> columna nueva tiene que existir en Neon antes del merge.

El dato de la plantilla deja de ser una lista de pasos y pasa a ser una lista de
metas con sus pasos:

- `PasoPlantilla` no cambia: `clave`, `titulo`, `inicio`, `dura`, `requiere`,
  `hito?`, `tiempo?`, `alias?`.
- `Plantilla` nueva: `{ metas: { clave, titulo, pasos: PasoPlantilla[] }[] }`.
- `requiere` sigue siendo una lista de **claves**, y una clave puede estar en otra
  meta: así se escriben los cruces de §4.5 sin un tipo aparte.
- Las claves son únicas en **toda** la plantilla, no por meta (prueba en §9).
- `PLAN_COMPLETO` compone `REGISTRO_CIVIL.pasos` como la meta 2, sin copiarlos.

Las metas nuevas se insertan con `orden = max(orden) + 1, +2, …` para no chocar
con las que ya existen. Ese número solo desempata: el orden de pantalla se deriva
(§2).

## 7. Aplicar sobre una boda que ya tiene cosas

Aplicar la plantilla es **idempotente**: se puede aplicar dos veces y no duplica,
no renombra y no borra. Nada se bloquea.

| Lo que la boda ya tiene | Qué hace la plantilla |
|---|---|
| Una meta con el título de la plantilla, comparado sin mayúsculas ni tildes | La **reutiliza**: sus acciones nuevas entran en ella. Conserva su título tal como la pareja lo escribió. |
| Una acción con el título de un paso, o con uno de sus `alias`, **sin meta** | La **adopta**: le escribe `meta_id`. Conserva su título, su monto, sus pagos y su responsable. |
| Esa acción, además, como idea suelta (`inicio_semanas IS NULL`) | Recibe la semana y la duración de la plantilla: si no, quedaría fuera del camino. |
| Esa acción con semana ya puesta | Conserva su semana y su duración. Lo que la pareja decidió manda. |
| Una acción con el título de un paso y **con otra meta** | **No se toca y no se duplica.** La meta que la pareja eligió gana. Las dependencias de la plantilla sí apuntan a ella. |
| Una acción que la plantilla marcaría como día clave | Solo se **marca**, nunca se desmarca: `es_hito = true` si el paso lo pide; si el paso no lo pide, la marca de la pareja se queda. |
| Una dependencia que ya existe | `onConflictDoNothing`. |
| Nada de lo anterior | Se crea. |

Todo en un solo `db.batch`: o queda completo o no queda nada.

**Carrera entre dos personas.** El índice único `metas_boda_titulo_idx` frena la
segunda escritura, el batch no deja nada a medias y la escritura devuelve
`{ error: "Alguien acaba de crear el plan. Vuelve a intentarlo." }`. Reintentar es
seguro: la segunda pasada reutiliza lo que la primera creó.

**Qué ve la pareja.** Un toast con el recuento real, no un texto fijo:

| Situación | Toast |
|---|---|
| Boda vacía | "Listo: 4 metas y 24 cosas. Todo se puede editar." |
| Boda que ya tenía Registro civil | "Listo: 3 metas y 15 cosas nuevas. Las 9 que ya tenías se quedaron como estaban." |
| Ya estaba todo | "Ya tenías todo el plan: no se creó nada." |
| Quedaron cosas en semanas pasadas | Se añade una segunda línea: "N cosas quedaron en semanas que ya pasaron." (`cuantasYaPasaron`, `docs/metas.md`) |

La plantilla **no reescala** las semanas a la fecha de la boda. Una pareja que se
casa en cinco semanas recibe el papeleo en la semana 12 y lo ve en rojo en el
Camino, que es la verdad: ese plan no cabe. Comprimirlo inventaría un calendario
que no existe.

## 8. Dónde se ofrece

**Un solo botón, en los dos sitios donde hoy está el de Registro civil**: el Mapa
(`mapa.tsx`) y el Camino (`camino.tsx`), con el mismo componente.

- Texto: **"Empezar con un plan de boda"**, y debajo, en letra pequeña:
  *"4 metas y 24 cosas, todo editable."* Decir el tamaño antes de escribir 24
  filas es lo mínimo honesto; un diálogo de confirmación para una escritura que
  se puede borrar sería un paso de más.
- Mientras escribe: "Creando…", el botón deshabilitado.
- **Se muestra cuando falta alguna de las cuatro metas de la plantilla.** Así una
  boda que ya aplicó "Registro civil" todavía puede completar el plan, y cuando
  las cuatro existen el botón desaparece.
- **El botón "Empezar con Registro civil" se retira**, y con él la escritura
  `empezarRegistroCivil`. Dos botones que pueblan la boda son uno de más: la
  plantilla del plan ya trae el registro civil completo, y quien solo quiera el
  papeleo borra tres carriles.

Después de aplicar, nada más cambia de pantalla: la boda se lee en el Mapa y en el
Camino de siempre.

## 9. Casos borde

| Caso | Qué pasa |
|---|---|
| Boda sin fecha | Se aplica igual: las semanas son relativas y la cuenta regresiva aparece cuando haya fecha. No hay segunda línea en el toast. |
| Boda con fecha a menos de 16 semanas | Se aplica sin reescalar; el toast dice cuántas cosas cayeron en semanas pasadas (§7). |
| La pareja borró una meta de la plantilla a propósito | El botón reaparece. Es el precio de una sola condición entendible; volver a aplicar no duplica nada. |
| La pareja renombró "El ahorro" a "La plata" | Se crea "El ahorro" como meta nueva: la comparación es por título, y la app no adivina sinónimos. Queda documentado como el caso aceptado. |
| Una meta de la plantilla existe con otro uso ("La recepción" con las acciones del papeleo) | Se reutiliza esa meta y se le añaden las acciones de la plantilla. No se crea una segunda con el mismo nombre. |
| Acción existente con el título de un paso y con pagos anotados | Se adopta sin tocar monto ni pagos. |
| Dos acciones existentes con el mismo título (el índice único es de `metas`, no de `acciones`) | Se adopta **una**, la primera por `orden`; la otra se queda suelta. |
| Un paso requiere una acción que no se creó porque ya existía con otra meta | La dependencia se crea apuntando a la acción existente. |
| Boda demo | La demo siembra sus propias tres metas y no cambia. El botón puede aparecer ahí porque le faltan metas de la plantilla; es una demo y mostrar la plantilla no estorba. |
| Se aplica con la boda a mitad de edición por la otra persona | `revalidatePath("/mi-boda")` y la pantalla se refresca con todo. |

## 10. Funciones puras y pruebas

En `lib/metas.ts`, con `node:test` como todo lo de `lib/` (`docs/metas.md` §12).

**El dato.** `PLAN_COMPLETO: Plantilla`, con `REGISTRO_CIVIL` compuesto dentro.

**`planDelPlan(plantilla, metasExistentes, accionesExistentes)`** sustituye a
`planPlantilla` y devuelve todo lo que la escritura necesita, sin tocar la base:

- `metas`: por clave, `{ id, titulo, nueva }` — reutilizada o por crear.
- `acciones.crear`: los pasos que no existen, con su `metaId` ya resuelto.
- `acciones.adoptar`: id → qué escribirle (`meta_id`, y semanas solo si era idea
  suelta, y `es_hito` solo para marcar).
- `acciones.intactas`: ids que existen con otra meta; solo sirven de destino de
  dependencias.
- `dependencias`: pares `(accionId, requiereId)` ya resueltos, incluidos los
  cruces.
- `resumen`: `{ metasNuevas, accionesNuevas, accionesReutilizadas }`, que es lo
  que el toast lee.

`planPlantilla` se retira junto con `empezarRegistroCivil`. Su prueba de alias se
conserva, reescrita sobre `planDelPlan`.

**Pruebas.**

| Qué | Se espera |
|---|---|
| Boda vacía | 4 metas, 24 acciones, 21 dependencias; `resumen` las cuenta. |
| Aplicar dos veces (el resultado de la primera como entrada de la segunda) | 0 metas nuevas, 0 acciones nuevas, 0 dependencias nuevas. |
| Boda con la meta "Registro civil" y sus 9 acciones | 3 metas nuevas, 15 acciones nuevas; las 9 quedan intactas. |
| Meta existente "registro Civil" | Se reutiliza y conserva su título; no se crea una segunda. |
| Acción existente "edicto matrimonial" sin meta | Adoptada, conserva su título. |
| Acción existente con el alias viejo "Publicar el edicto matrimonial" sin meta | Adoptada; no aparece una segunda acción de edicto. |
| Acción existente con el título de un paso y con otra meta | Ni adoptada ni creada; aparece en `intactas` y la dependencia apunta a ella. |
| Acción existente idea suelta | Recibe `inicio` y `dura` de la plantilla. |
| Acción existente con semana puesta | Conserva semana y duración. |
| Acción existente con `es_hito = true` y paso sin `hito` | Sigue marcada. |
| Integridad: claves | Todas únicas en toda la plantilla. |
| Integridad: `requiere` | Toda clave citada existe en la plantilla. |
| Integridad: ningún choque | Para todo par, `finDe(requisito) >= inicio(dependiente)`. Es la prueba que atrapa una semana mal editada en la tabla. |
| Integridad: sin montos | Ningún paso trae monto (§3). |
| Integridad: un solo día clave | Exactamente un paso con `hito` (§5). |
| `ordenarMetas` sobre el resultado | El ahorro, Registro civil, La ceremonia, La recepción. |
| `metasQueEspera` | La ceremonia → [El ahorro]; La recepción → [El ahorro, Registro civil]; El ahorro → []; Registro civil → []. |

## 11. Orden de implementación

Una sola pasada, un cambio coherente, seis archivos.

1. `lib/metas.ts`: tipo `Plantilla`, constante `PLAN_COMPLETO` (§4) y
   `planDelPlan` (§10). `REGISTRO_CIVIL` se queda como está y se compone dentro.
2. `lib/metas.test.ts`: las pruebas de §10, incluidas las cuatro de integridad del
   dato.
3. `app/mi-boda/_acciones/acciones-servidor.ts`: `empezarPlan()` sustituye a
   `empezarRegistroCivil()`. Lee metas y acciones de la boda filtrando por
   `boda_id`, llama a `planDelPlan`, escribe un solo `db.batch`, devuelve el
   `resumen` para el toast y `{ error }` sin lanzar. Mantiene el camino de
   `esDuplicado`.
4. `app/mi-boda/_acciones/empezar-plan.tsx` (renombra
   `empezar-registro-civil.tsx`): el botón de §8 con los textos del recuento.
5. `app/mi-boda/_acciones/mapa.tsx` y `camino.tsx`: la condición pasa de "no
   tiene la meta Registro civil" a "falta alguna de las cuatro metas de
   `PLAN_COMPLETO`", y el componente al nuevo.
6. `docs/metas.md` §4: la referencia a este documento, ya escrita.

Verificación al final: `pnpm lint`, `pnpm test`, `npx tsc --noEmit`.

Validación del validador, en móvil (375×812) y escritorio, claro y oscuro:
boda vacía antes y después de aplicar; el toast de los tres recuentos; el Mapa con
cinco carriles ("Sin meta" incluido) y la altura del primero; el Camino con los
cinco cruces, sus flechas y las dos líneas `↳ después de`; el botón ausente
cuando las cuatro metas existen.

## 12. Qué queda fuera

- **Más plantillas** (boda religiosa, boda en provincia, matrimonio comunitario,
  pareja con un extranjero). Cada una tiene requisitos distintos y la primera
  tiene que probar que la pareja usa alguna.
- **Elegir qué metas aplicar** con casillas. Cuatro casillas antes de poblar una
  boda vacía es una decisión pedida demasiado pronto; borrar un carril después
  cuesta un toque.
- **Reescalar las semanas** a la fecha de la boda (§7).
- **Un presupuesto o techo** por meta o por boda, y cualquier barra de avance
  hacia el monto objetivo (§3 y `docs/pagos.md` §6).
- **Montos sugeridos** en las acciones, incluso los verificados de un distrito
  (§3).
- **Acciones recurrentes** ("el aporte de cada mes" como doce filas). Una acción
  con duración dice lo mismo (§4.1).
- **Más días clave** (§5).
- **Deshacer la plantilla** con un botón. Se borra meta por meta, como todo.
- **Un diálogo de confirmación** antes de aplicar (§8).
- **Que la plantilla reordene, mueva o borre** nada de lo que la pareja ya tenía.
  Solo crea y adopta lo que está sin meta (§7).
- **Acciones de la recepción que son contratos con proveedores** con su propio
  modelo (contrato, adelanto, saldo, penalidad). Un proveedor es una acción con
  monto y sus pagos, como todo lo demás.
- **Renombrar "Registro civil"** (§2).
- **Mover el día clave `Ceremonia civil`** a la meta "La ceremonia" (§2).
- **Una pantalla de plantillas** o una galería. Es un botón.

## 13. Supuestos marcados

Datos de dominio que no se pudieron verificar en una fuente oficial. Se escriben
como supuesto porque las semanas de la plantilla se apoyan en ellos, y la pareja
las edita.

1. **La municipalidad fija el día y la hora al aprobar el expediente.** Visto en
   resoluciones de alcaldía que declaran la capacidad de los contrayentes y
   señalan fecha y hora, no en una norma general. De ahí el cruce
   `expediente → invitaciones` (§4.5).
2. **Vigencias de los documentos**: partida de nacimiento con 3 meses de
   antigüedad máxima (algunas municipalidades aceptan 6) y certificado médico
   prenupcial válido 30 días. Fuentes secundarias. Las semanas de §4.2 son
   compatibles con ambas (partida en la 12, médico en la 9, expediente en la 7),
   y por eso no se cambian.
3. **El trámite completo toma de 15 a 30 días** desde el expediente. Fuentes
   secundarias; coincide con las semanas 7 → 0 de §4.2.
4. **Las semanas de las tres metas nuevas** son calendario razonable de una boda
   civil peruana, no plazos de nadie. Mismo estatus que el supuesto marcado de
   `docs/metas.md` §4.
5. **El tarifario de Surco** (§3) es de un documento de 2024 de esa
   municipalidad: sirve de orden de magnitud y no se escribe en ninguna acción.

## 14. Preguntas abiertas para el arquitecto

1. **Dónde vive el dato de la plantilla.** `lib/metas.ts` ya tiene 672 líneas y
   `PLAN_COMPLETO` le suma unas 40 de tabla. ¿Se queda ahí, o salen `REGISTRO_CIVIL`,
   `PLAN_COMPLETO` y `planDelPlan` a un `lib/plantillas.ts` propio? Lo segundo
   toca los imports de `acciones-servidor.ts`, `mapa.tsx` y `camino.tsx`. La spec
   no lo decide: no cambia nada de lo que la pareja ve.
2. **Tamaño del batch.** Son hasta 4 inserts de meta, 24 acciones y 21
   dependencias en un `db.batch`. ¿Entra holgado en el límite de Neon HTTP, o
   conviene una sola sentencia por tabla con `values()` múltiple? Lo que la spec
   exige es la atomicidad: o queda completo o no queda nada.
3. **`acciones.orden` de lo creado.** Hoy la plantilla escribe `1000 + i` para
   dejarlo al final del contador de llegada. Con 24 filas, ¿se mantiene ese truco
   o se lee `max(orden) + 1` como se hace en `metas`?
4. **Dos acciones existentes con el mismo título** (§9): la spec elige "la primera
   por `orden`". ¿Hay un criterio mejor ya usado en el repo?
5. **El recuento del toast** viaja desde el servidor en el valor de retorno de
   `empezarPlan()`. ¿Rompe algo de la convención de `{ error }` de
   `acciones-servidor.ts` devolver además `{ resumen }` en el caso feliz?
