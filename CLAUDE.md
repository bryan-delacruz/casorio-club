# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Casorio Club: espacio compartido para que una pareja planifique su boda civil en
Perú. Multi-tenant con registro abierto — cualquiera crea su boda. La interfaz,
el código y los comentarios están en español; los comentarios explican el *por
qué*, no el *qué*.

## Quién la usa, y para qué

Dos novios que quieren **el control de la gestión de su evento**. No son
gestores de proyecto: nadie les va a enseñar vocabulario de gestión, y la app
tiene que explicarse sola donde se decide algo.

Dos verdades del dominio que no se deducen del código y que han costado una
corrección cada una:

- **El responsable gestiona; quien paga puede ser otro.** `responsable_id` vive
  en la acción, `pagado_por_id` en cada pago, y ninguna regla los ata. Pagan dos
  personas, a veces entre varias, y casi siempre en partes.
- **Pagar y terminar son ejes independientes.** "Pagado del todo" significa que
  se cubrió el 100 % del dinero. Del estado **hecho** no se deduce si queda
  plata por salir, porque hay cosas que se pagan por adelantado. No trates uno
  como señal del otro.

## Comandos

```bash
pnpm dev          # servidor de desarrollo (puerto 3000)
pnpm build        # build de producción
pnpm lint         # eslint
pnpm test         # node:test sobre lib/**/*.test.ts
```

`pnpm` es el gestor de paquetes; no uses `npm install`.

Una sola prueba o un solo caso:

```bash
node --test lib/metas.test.ts
node --test --test-name-pattern "cadena principal" lib/metas.test.ts
```

Base de datos (no hay migraciones versionadas: `drizzle-kit push` empuja el
esquema directo, y `db/migraciones` no existe):

```bash
pnpm dotenv -e .env.local -- pnpm drizzle-kit push      # aplicar db/schema.ts a Neon
pnpm dotenv -e .env.local -- node scripts/verificar-db.mjs   # ver columnas e índices reales
pnpm dotenv -e .env.local -- node scripts/ver-acciones.mjs
```

⚠️ Drizzle selecciona **todas** las columnas de una tabla, así que una columna
nueva en `db/schema.ts` debe existir en Neon **antes** de mergear, o producción
rompe. `push` solo agrega; revisa su plan antes de aceptarlo.

Variables de entorno: copia `.env.example` a `.env.local`. Sin las variables de
`BERNIE_*` la integración simplemente no aparece en la interfaz
(`integracionDisponible()`), que es el comportamiento buscado.

## Arquitectura

### Permisos en Clerk, contenido en Postgres

Cada boda **es** una Clerk Organization. Su `orgId` se guarda como `boda_id` en
toda fila de Postgres, y **toda consulta filtra por él**. El `bodaId` nunca
viene del cliente: se lee de `auth()` en el servidor
(`bodaActiva()` en `app/mi-boda/_acciones/acciones-servidor.ts`). Una consulta
sin ese filtro es una fuga entre bodas, es decir un bug de seguridad.

La protección de rutas vive en el **layout** con `auth.protect()`
(`app/mi-boda/layout.tsx`), no en `proxy.ts`, que solo adjunta la sesión. Clerk
desaconseja proteger por coincidencia de rutas: el patrón puede desalinearse de
cómo Next enruta y dejar accesible algo privado.

### Una sola entidad para todo

No hay tablas separadas de trámites, compras y gastos a propósito: **un trámite
que cuesta plata ES un gasto**. Todo vive en `acciones`, y las secciones de la
app son vistas sobre esa tabla. Lo que una acción exige se lee de dos campos:
`cuestaTiempo` (⏱) y `monto != null` (💰), en cualquier combinación. Cualquier
propuesta que parta tareas y gastos en dos listas rompe los totales.

Derivar, no duplicar:
- Adelanto y saldo = suma de filas de `pagos` contra el `monto` de la acción.
  No hay campo "ya pagado".
- Avance, rango y monto de una `meta` = derivados de sus acciones.
- `deBernie` en un pago = derivado de `gastosBernie.pagoId`, no es columna.

Dinero como `numeric(12, 2)`, nunca float.

### El tiempo es relativo a la boda

`acciones.inicioSemanas` se cuenta hacia atrás desde el día de la boda:
12 = doce semanas antes, 0 = el mismo día, −4 = cuatro después. Relativo y no
fecha absoluta porque **mover la boda mueve todo con ella**, que es lo que pasa
de verdad. `null` = sin decidir todavía.

`inicioSemanas` es el **único** campo que dice si una acción está en el camino.
Hubo un `momento` (`idea` | `antes` | `el_dia` | `despues`) que hacía además de
carril del tablero: se retiró porque repetía lo que la fecha ya decía y había
que mantener dos datos coherentes. La columna ya no existe: se borró de Neon con
`drizzle-kit push` tras verificar producción (paso 3 de `docs/metas.md` §3.1).

### Marco de gestión (PMP traducido)

`docs/metas.md` define el vocabulario y lo usa con rigor, pero la pareja nunca
lee jerga de PMP:
- **Meta** = entregable / paquete de trabajo de la EDT. Una acción pertenece a
  una meta o a ninguna, nunca a dos, para que el monto no se cuente doble.
- **Hito** (`esHito`) = checkpoint de duración cero; rombo en el Gantt y la
  tira de cuenta regresiva ("Edicto matrimonial · faltan 4 semanas"). Es una
  marca, no una manera de agrupar: se probó agrupar por hito y se retiró porque
  no contestaba ninguna pregunta que la meta no contestara ya. En pantalla se
  llama **día clave**: "hito" es jerga de PMP y hacía falta un párrafo para
  distinguirla de "meta" (`docs/metas.md` §11).
- **Dependencia** = precedencia fin-a-inicio, guardada como par
  `(accionId, requiereId)` para poder preguntar en los dos sentidos.
- **Cadena principal** = ruta crítica. En pantalla, **"Lo que no se puede
  atrasar"**.

Las metas **no guardan precedencia propia**: el orden de carriles y grupos, y
la línea "↳ después de", se derivan de las dependencias entre sus acciones
(`ordenarMetas`, `metasQueEspera`). Guardar ese orden sería un segundo dato que
hay que mantener coherente con las semanas, que es el error que costó retirar
`momento`. El orden se calcula una sola vez, en `listarMetas`, para que las dos
pantallas no puedan divergir.

### Lógica pura en `lib/`, React y base aparte

Todo cálculo de orden, fechas, totales o dependencias vive en `lib/` como
función pura y se prueba con `node:test`. No metas ese cálculo en un componente.

- `lib/metas.ts` — orden topológico de dependencias, cadena principal, "lista
  para empezar", resumen de meta, orden derivado de metas, plantillas
  (`PLAN_COMPLETO`, que compone `REGISTRO_CIVIL`; ver `docs/plantillas.md`).
- `lib/historia.ts` — la imagen para compartir.
- `lib/persona.ts` — nombre e iniciales de un miembro de Clerk.
- `lib/demo.ts` — la semilla de la boda de ejemplo.
- `lib/bernie/` — OAuth PKCE, cifrado, cliente, firma de webhooks, validador de
  contrato OpenAPI, sincronización por cursor.

### Lecturas y escrituras separadas

- **Lecturas**: `app/mi-boda/_acciones/datos.ts`, marcado `server-only` y
  envuelto en `cache` de React. Toleran no tener sesión y devuelven vacío: Next
  renderiza layout y página en paralelo, así que una lectura puede correr antes
  de que `auth.protect()` redirija.
- **Escrituras**: `acciones-servidor.ts`, marcado `use server`, con
  `revalidatePath`. No lanzan: devuelven `{ error }` con mensaje para el
  usuario, porque en producción Next oculta el mensaje de lo que se lanza. Una
  escritura sin sesión sí falla.

Las lecturas no van en el archivo `use server`: todo lo que ese archivo exporta
se publica como endpoint POST invocable desde el cliente.

El cliente de base (`db/index.ts`) se inicializa perezosamente con `getDb()`.
`neon()` lanza sin `DATABASE_URL` y Next evalúa el módulo al compilar, así que
inicializar arriba rompería `next build`. No lo envuelvas en un `Proxy`: cuelga
sin error.

### Pantallas

Dos vistas sobre los mismos datos, enlazadas desde `_acciones/rutas.ts`
(centralizado: cabecera, selector y barra del celular usan las mismas rutas):
La meta es el **único** agrupador en las dos pantallas.

- **Mapa** (`/mi-boda`, `mapa.tsx`) — de arriba abajo: banda "Qué toca ahora",
  tira del próximo hito, un carril por meta (más "Sin meta"), bandeja de ideas
  sueltas y Reparto. Arrastrar con `dnd-kit` escribe `meta_id`, nunca la semana;
  la semana se corrige en el formulario. El menú ⋯ → "Mover a" es la ruta sin
  arrastre, obligatoria para teclado y táctil, y la vía principal en el celular.
- **Camino** (`/mi-boda/camino`, `camino.tsx`) — Gantt agrupado por meta, sin
  selector (`?por=` se ignora), con flechas de dependencia, cadena principal
  resaltada, choques en rojo y hitos como rombo.

### Demo

`/demo` entra a una boda de ejemplo con un clic y sin contraseña, mediante un
sign-in token de un solo uso de Clerk. Los datos se reconstruyen al entrar si
tienen más de 12 horas, sin cron ni secreto extra. Los ids de `DEMO` en
`lib/demo.ts` son identificadores de Clerk, no secretos. La boda demo no ofrece
la integración con Bernie.

### Integración con Bernie Wallet

Solo lectura: Casorio nunca modifica nada en Bernie. Un gasto de Bernie llega a
una bandeja **"Por asignar"** (`gastosBernie`) y no se vuelve pago solo, porque
un gasto del banco no sabe a qué acción pertenece. OAuth 2.1 + PKCE, refresh
token cifrado AES-256-GCM, webhooks deduplicados por `webhook-id`,
sincronización incremental por cursor con lease para que dos syncs no gasten el
mismo refresh token. Detalle completo en `docs/integracion-bernie.md`.

## Estilo

La paleta vive en los **tokens de shadcn**. No crees utilidades de color
propias ni clases de color a mano. La interfaz de Clerk la dibuja Clerk: textos
por localización (`lib/clerk-localization.ts`), cero overrides de CSS.

Al verificar la interfaz en el navegador, **mide con JavaScript**
(`getBoundingClientRect`, `getComputedStyle`, `devicePixelRatio`), no por
captura: las capturas traen artefactos de escalado.

# Cómo se trabaja en este proyecto

Spec-Driven: **la spec en `docs/*.md` manda sobre el código**. Si algo cambia,
primero se actualiza la spec. Cada documento declara su estado
("aprobada e implementada").

Orquestado por tres agentes especialistas en `.claude/agents/`. Ningún agente ve
a los otros: **el relevo entre ellos es un archivo del repo**, no una
conversación.

| Agente | Rol | Entregable |
| --- | --- | --- |
| `po-bodas` | Product Owner, dominio de bodas civiles en Perú | spec en `docs/*.md` |
| `arquitecto-senior` | Desarrollador senior, Next.js 16 / Clerk / Neon / shadcn | código y pruebas |
| `validador-ux` | Validación de UX/UI en el navegador, solo lectura | informe de hallazgos medidos |

## Ciclo de un cambio

1. **Decidir.** `po-bodas` escribe o actualiza la spec en `docs/`, con el
   alcance y lo que queda fuera.
2. **Construir.** `arquitecto-senior` implementa esa spec, con las pruebas
   `node:test` sobre las funciones puras de `lib/` que la spec pide.
3. **Validar.** `validador-ux` comprueba en el navegador cada pantalla afectada
   en móvil (375×812) y escritorio.
4. **Cerrar el lazo.** Los hallazgos vuelven al agente que corresponde: de
   producto al PO, técnicos al arquitecto. Se repite el paso 3 hasta que no
   queden hallazgos abiertos.

Los pasos 1 y 2 van **en serie**: dos agentes que escriben nunca tocan los
mismos archivos a la vez. El paso 3 es de solo lectura y puede correr en
paralelo con otra lectura.

## Eficiencia del ciclo

Medido en la sesión que estrenó este ciclo: seis corridas, ~62 min y ~750k
tokens, y el mayor desperdicio no fue lentitud sino trabajo tirado — se
construyó una agrupación entera y después se retiró.

- **La pregunta de producto va antes que el modelo de dominio.** Antes de
  especificar cómo se guarda o cómo se agrupa algo, el PO responde qué necesita
  entender y hacer una pareja. Al revés se construye y se tira.
- **Dos maneras de ver los mismos datos son una de más.** Una vista nueva se
  justifica solo si contesta una pregunta que ninguna otra pantalla contesta.
- **Los encargos van en delta, no en resumen del repo.** Este archivo ya da el
  mapa del código, los comandos y la arquitectura, y los agentes lo cargan al
  arrancar. El encargo dice qué cambia, qué archivos y qué decisiones ya están
  tomadas; nada más.
- **Un defecto ya medido se arregla, no se reproduce.** Si el encargo trae el
  número, está comprobado.
- **Leer en paralelo, escribir en serie.** El validador puede correr mientras el
  PO escribe en `docs/`: uno lee la pantalla, el otro escribe documentos. Dos
  que escriben código, nunca a la vez.
- **Modelo según el trabajo.** El PO y el arquitecto deciden y diseñan: Opus.
  Una revalidación, que es instrumentar y medir lo que ya se sabe dónde mirar,
  va en Sonnet.
- **Presupuesto del validador**: ~60 llamadas en una pasada completa, ~25 en una
  revalidación. Al llegar al tope entrega lo que tiene y dice qué no miró.
  Censa por muestra: lo que el cambio tocó, más los peores casos que encuentre.
- **Una pasada, un cambio coherente, hasta ~6 archivos.** El arquitecto tarda de
  10 a 14 minutos cuando el encargo mete dos temas; con la lista ya escrita y en
  Sonnet, 33 segundos. El alcance manda más que el modelo.
- **Verificación una vez, al final**: `pnpm lint`, `pnpm test`, `npx tsc --noEmit`.
  `pnpm build` solo si el cambio toca rutas, `next.config.ts` o fronteras
  servidor/cliente: es lo más lento que hay.
- **Informes de ~250 palabras**, con la estructura fija que cada agente lleva en
  su archivo. Y al relevar un informe al usuario: los hallazgos y las decisiones,
  no el informe entero.

## Estilo telegráfico

Todo lo que se escribe entre agentes va en estilo telegráfico: sin artículos,
sin relleno, sin cortesías, frases cortas, una idea por frase, voz activa, mismo
término para la misma cosa. Aplica a los **encargos** que el orquestador manda a
un agente y a los **informes** que el agente devuelve.

Intactos y exactos, siempre: números con unidades, textos literales vistos en
pantalla, rutas, nombres de función y de API, comandos, y errores citados tal
cual. Nunca se eliminan "no", "nunca", "solo" ni "salvo". Si comprimir crea
ambigüedad técnica, gana la claridad.

Aplica también a las **specs en `docs/`** y a los **mensajes de commit y cuerpos
de PR**: frases cortas, tablas antes que párrafos, la razón de una decisión una
sola vez y no repetida en tres secciones. Una spec es un contrato, así que la
claridad gana siempre que choque con la brevedad: ante la duda, una frase más
larga y sin ambigüedad. El código y sus comentarios no cambian de estilo: siguen
el del repositorio, y el comentario explica el *por qué*.

## El servidor de desarrollo es del usuario

`pnpm dev` lo levanta el usuario y lo deja corriendo. **No lo arranques ni lo
pares**, ni tú ni ningún agente: un segundo servidor falla por el puerto
ocupado, y pararlo le quita al usuario lo que estaba mirando.

Un servidor corriendo no cuesta nada mientras nadie lo lea. Lo que cuesta es
mirar, y por orden de precio: una captura de pantalla vale varias páginas de
texto; `read_page`, `get_page_text` y las mediciones con `javascript_tool`
cuestan poco y además son más exactas. Si hace falta ver los logs, pídeselos al
usuario en vez de leerlos.

Lo exploratorio ("¿se ve bien?", "¿me gusta este orden?") lo mira el usuario en
su navegador y lo cuenta en una frase. El validador se reserva para verificar
con números: contrastes, píxeles, estados límite y regresiones.

## Puerta de calidad

Un cambio no está terminado hasta que todo esto se cumple y se puede mostrar:

- `pnpm lint` y `pnpm test` pasan, con la salida real a la vista.
- La spec en `docs/` refleja lo implementado.
- Cada pantalla afectada está validada en móvil y escritorio, con valores
  medidos por JavaScript y no por capturas. **El modo oscuro no entra en la
  puerta**: `app/globals.css` define `.dark`, nada lo activa y `next-themes`
  está instalado sin usar, así que ninguna pareja puede llegar ahí y validarlo
  sería inventar. Vuelve a la puerta el día que se pueda alcanzar.
- Estados vacío, de carga y de error cubiertos, no solo el caso feliz.
- Ruta de teclado y táctil donde haya arrastre con `dnd-kit`.
- Sin errores de consola ni peticiones fallidas en las pantallas tocadas.
- Toda consulta nueva filtra por `boda_id`.
- Columnas nuevas ya existen en Neon antes de mergear.

Si algo de esta lista no se cumple, se dice explícitamente qué falta y por qué.
No se reporta como hecho lo que no se corrió.
