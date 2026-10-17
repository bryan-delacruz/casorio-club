# Metas, días clave y el camino

> **Spec (SDD).** Este documento manda sobre el código de las metas, los días
> clave y el camino: si algo cambia, primero se actualiza aquí.
>
> **Estado:** aprobada e implementada. El orden entre acciones —cómo se arma y
> dónde se edita— se mudó a `docs/dependencias.md`, que manda sobre eso y
> corrige dos renglones de §14.
>
> **Glosario.** En el código, en la base y en esta spec la marca se llama
> **hito** (`es_hito`, `proximoHito`, `tira-hito.tsx`, `docs/metas.md`). En
> pantalla la pareja lee **día clave** (§11). Son la misma cosa con dos nombres,
> a propósito: renombrar el código no le aporta nada a la pareja.
>
> Este documento se consolidó: las tres enmiendas que tenía encima están
> fundidas en el cuerpo y su historia borrada. Dice lo que el producto es hoy,
> no cómo se llegó. Aun así sigue siendo largo para leerlo entero: si crece
> otra vez, se parte en dos — metas y camino en uno, días clave en otro.

## 1. Qué es una meta

Algo que la pareja quiere **lograr** y que necesita varias acciones encadenadas:
"Registro civil" no se consigue sin las partidas, el certificado médico, el
expediente, el edicto… y cada paso espera al anterior.

En la interfaz se llama **Meta**. Equivale a un **entregable** del PMBOK (un
paquete de trabajo de la EDT/WBS) o a una **épica** en Scrum. En un Gantt es la
**tarea resumen** que agrupa a sus subtareas.

Una acción pertenece a **una meta o a ninguna**: así el total de una meta nunca
cuenta dos veces el mismo gasto.

## 2. El tiempo: una sola fuente

`inicioSemanas` (semanas respecto a la fecha de la boda: positivo antes, cero el
mismo día, negativo después) es el **único** campo que dice si una acción está en
el camino:

| Estado | Cómo se reconoce |
|---|---|
| **Idea suelta** | `inicio_semanas IS NULL` |
| **En el camino** | `inicio_semanas` tiene un número |

Lo demás sale del número: antes de la boda es `> 0`, el mismo día es `= 0`,
después es `< 0`.

Hubo una columna `momento` (`idea` | `antes` | `el_dia` | `despues`) que hacía
además de carril del tablero. Se borró de Neon y de `db/schema.ts`: con semanas
puestas no decía nada nuevo, y dos datos que tienen que coincidir siempre acaban
no coincidiendo (se podía guardar `momento = "despues"` con `inicioSemanas = 10`
y el camino dibujaba la acción diez semanas **antes** de la boda, dentro del
carril "Después"). Con ella desapareció a propósito el estado "va en el camino
pero no sé cuándo", que el Gantt pintaba como barra punteada en la semana 8: al
poner algo en el camino **se escribe una semana** que la pareja ve y corrige, en
vez de una suposición invisible.

### 2.1 La semana por defecto

La decide una función pura **al escribir**, no al leer — `semanaPorDefecto` en
`lib/metas.ts`:

```
semanaPorDefecto({ hitoSemana, semanasHastaLaBoda, duracion }):
  hitoSemana !== null         → hitoSemana + duracion
  semanasHastaLaBoda !== null → max(1, semanasHastaLaBoda)
  si no                       → 8
```

- Con un hito de referencia, termina justo la semana anterior a él.
- Sin hitos, **cuántas semanas faltan para la boda**, mínimo 1. Ocho semanas
  fijas le ponían a una pareja que se casa en tres una acción con fecha pasada.
- Sin fecha de boda, 8: no hay nada mejor que suponer.

La semana se escribe en la fila, no se infiere al leer. Todo lo que está en el
camino tiene su número, y es editable.

## 3. Modelo de datos (Drizzle)

`metas`
- `id` uuid PK, `boda_id` text (orgId de Clerk), `titulo` text, `orden` int,
  `creada_el` timestamptz. Índice `metas_boda_orden_idx (boda_id, orden)` e
  **índice único `metas_boda_titulo_idx (boda_id, titulo)`**: no hay dos metas
  con el mismo nombre en una boda, y dos personas que aplican la plantilla a la
  vez no la duplican.

`acciones` — lo que toca a esta spec:
- `inicio_semanas` int null — el único campo que dice si está en el camino (§2).
- `duracion_semanas` int, default 1.
- `orden` int — contador de llegada para desempatar. **No se usa para ordenar a
  mano**: nunca hubo reordenar dentro de un carril.
- `meta_id` uuid null → `metas.id` **on delete set null**: borrar la meta no
  borra sus acciones, quedan sueltas.
- `es_hito` boolean default false — un **día clave** es un momento, no un
  periodo. En el Gantt es un **rombo**, no una barra. **No agrupa ninguna
  pantalla**: es una marca con cuenta regresiva (§5.3) y el corte interno que
  mide "cuánto falta antes de él" (§6).
- Índice `acciones_boda_orden_idx (boda_id, orden)`.

Todo derivado, nada guardado dos veces:
- **Avance** de la meta = acciones hechas / total.
- **Rango** = del inicio más temprano al fin más tardío de sus acciones.
- **Monto** = suma de los montos de sus acciones (incluye lo que vino de Bernie).
- **Etapa** de una acción = el día clave que la cierra (§6). No es columna y
  **no se ve en pantalla**: solo alimenta el "te faltan N cosas antes" de §5.3.

### 3.1 Despliegue: nada pendiente

Los tres pasos de la eliminación de `momento` (relleno de `inicio_semanas`,
merge del código sin la columna, `DROP COLUMN` más índice nuevo) y el renombrado
opcional de los títulos de plantilla a sustantivo **están ejecutados en Neon**.

> ⚠️ Para cualquier cambio futuro de este documento sigue valiendo la regla:
> Drizzle selecciona todas las columnas, así que una columna nueva tiene que
> existir en Neon **antes** de mergear. **§11 no añade ninguna columna**: su
> vocabulario es texto de pantalla y el orden entre metas se **deriva** de las
> acciones y sus dependencias (§11.3). Nada que empujar a Neon.

## 4. Plantilla "Registro civil" (Perú)

> Esta plantilla ya no se ofrece sola: es la meta 2 del **plan de cuatro metas**
> de `docs/plantillas.md`, que la reutiliza tal cual y sustituye el botón
> "Empezar con Registro civil" por uno solo, "Empezar con un plan de boda".
> Los nueve pasos, sus semanas, sus `alias` y su único día clave **no cambian**:
> se siguen definiendo aquí.

Crea la meta "Registro civil" y estas acciones, con dependencias y semanas típicas (todo editable
después). Si ya existe una acción con el mismo título —o con uno de sus títulos
antiguos (§4.1)—, comparado sin mayúsculas ni tildes, la reutiliza y le asigna la
meta en vez de duplicarla; si esa acción no tenía semanas, toma las de la
plantilla. Lo que la pareja ya había decidido se respeta. Todo va en un batch.
Las reglas exactas de la reutilización —una acción que ya tiene otra meta no se
mueve, y un día clave solo se marca, nunca se desmarca— están en
`docs/plantillas.md` §7.

| Acción | Semanas antes | Dura | Requiere | Día clave |
|---|---|---|---|---|
| Partida de nacimiento de los dos | 12 | 2 | — | |
| Copia del DNI de los dos | 12 | 1 | — | |
| Certificado domiciliario | 11 | 1 | — | |
| Certificado médico prenupcial | 9 | 2 | — | |
| Elegir a los dos testigos | 10 | 1 | — | |
| Expediente en la municipalidad | 7 | 1 | las 5 anteriores | |
| Edicto matrimonial | 6 | 2 | expediente | |
| Ceremonia civil | 0 | 1 | edicto | ✅ |
| Acta de matrimonio | −2 | 1 | ceremonia | |

La boda queda con **una** meta ("Registro civil") y **un** día clave, la
ceremonia civil. Es deliberadamente uno solo: es la forma de enseñar el concepto
sin texto. La pareja aplica la plantilla, ve la tira "Ceremonia civil · faltan 12
semanas · te faltan 8 cosas antes", y entiende qué hace un día clave antes de
leer ninguna explicación. Dos difuminarían cuál es el día que importa; cero
dejaría la tira vacía justo cuando la pareja acaba de poblar su boda. **No se
marca ninguno más**: ni el expediente ni el edicto ni el acta (§8.2).

> **Supuesto marcado.** Las semanas de esta tabla son estimaciones de calendario
> real, no plazos de ley: la ley fija ocho días de aviso, no las dos semanas que
> la plantilla da al edicto. Esas dos semanas cubren el trámite más la cola de la
> municipalidad, y la pareja las edita.

### 4.1 Títulos en sustantivo, y el alias de los viejos

El nombre de un día clave se lee solo, como etiqueta, así que en infinitivo se
lee mal: en pantalla se vio **"Hasta Publicar el edicto matrimonial"**. El
problema no es el artículo que falta, es el verbo. Hoy ese nombre sale solo en la
tira (§5.3): "Publicar el edicto matrimonial · faltan 2 semanas" frente a
"Edicto matrimonial · faltan 2 semanas".

Por eso **toda acción de la plantilla que pueda llegar a ser día clave se nombra
con un sustantivo**. Cambiaron tres títulos; el resto ya lo eran:

| Antes | Ahora | Por qué |
|---|---|---|
| Publicar el edicto matrimonial | **Edicto matrimonial** | Es día clave en la demo (§10). |
| Presentar el expediente en la municipalidad | **Expediente en la municipalidad** | Checkpoint real: el expediente admitido. |
| Recoger el acta de matrimonio | **Acta de matrimonio** | Cierra el trámite; candidato natural. |

"Ceremonia civil" no cambia: ya es un sustantivo, y la variante de la demo
("Ceremonia civil en la municipalidad") también. "Elegir a los dos testigos"
tampoco: es una tarea, no un checkpoint, y forzarla a sustantivo la empeoraría.

**El alias.** La plantilla reconoce también los títulos viejos: cada paso lleva
una lista `alias` con sus títulos anteriores y la comparación busca por el título
nuevo **o** por cualquier alias, siempre normalizado (minúsculas, sin tildes).
Sin eso, una boda que ya aplicó la plantilla no coincidiría con el título nuevo y
la segunda aplicación crearía un edicto duplicado: el índice único es
`(boda_id, titulo)` en `metas`, no en `acciones`, así que la base no lo atraparía.
La acción reutilizada **conserva su título**: el título es de la pareja y puede
haberlo editado. La lista de alias se queda en el código indefinidamente;
borrarla reabre el duplicado.

## 5. Camino (Gantt): una sola agrupación

**No hay selector.** El Camino agrupa **por meta** y nada más.

- Barra resumen por meta con nombre y avance ("3 de 8 hechas") y, si otra meta
  la precede, la línea *"↳ después de Registro civil"* (§11.3); debajo sus
  acciones en **orden de dependencia**, y al final el grupo **"Sin meta"**.
- Los grupos van en el orden derivado de `ordenarMetas` (§11.3), el mismo que los
  carriles del Mapa.
- **Flechas** de dependencia, **cadena principal** resaltada, **choques** en
  rojo, **"lista para empezar"** y el **rombo** del día clave.
- Las ideas sueltas quedan fuera del Gantt, en **"Todavía sin sitio"**.
- En pantallas angostas, scroll horizontal y columna de nombres fija.
- Si la URL trae `?por=…` (enlace viejo o marcador), se **ignora**: se muestra el
  Camino por meta. Sin redirección y sin aviso.
- Boda sin ninguna meta: un solo grupo, sin barra resumen, con la invitación
  *"Agrupa lo que va junto: crea una meta."* y, si la boda no tiene "Registro
  civil", el botón de la plantilla (§4).

### 5.1 Por qué una sola agrupación

Se probó una segunda, "Por hito", y se retiró. El argumento no es que cueste
explicarla: es que **no responde ninguna pregunta nueva**. Son las mismas
acciones reordenadas. La meta es un concepto que la pareja ya trae puesto — "el
papeleo", "la fiesta", "la luna de miel" — y no hay que enseñárselo.

La única pregunta que parecía propia de esa vista es *"¿llego al edicto a
tiempo?"*, y es **transversal a las metas**. Se responde mejor sin reagrupar
nada: el eje del Gantt ya coloca cada barra en su semana y el rombo está dibujado
ahí mismo, así que lo que falta antes del rombo **se ve**; y la tira de §5.3 lo
dice con palabras. Lo que de verdad la contestaría es el aviso "esto no llega",
que sigue fuera de alcance (§14) y no necesita una agrupación nueva.

### 5.2 Qué toca ahora

Hay una pregunta que ninguna agrupación contestaba y es la que una pareja abre la
app para resolver un lunes por la noche: **¿qué toca ahora?** Un Gantt es para
quien planifica; un tablero, para quien ordena. Nadie respondía a quien ejecuta.

Una **banda "Qué toca ahora"** en lo más alto del Mapa, antes de todo lo demás.
**No es una pantalla nueva**: es un bloque de la portada de la boda (`/mi-boda`).

- Muestra **hasta 5** acciones, una debajo de otra: título, su meta en letra
  pequeña, responsable y, si la boda tiene fecha, cuándo tocaba o toca
  ("esta semana", "la semana que viene", "hace 2 semanas").
- Cada línea lleva el mismo círculo de estado que la tarjeta, para marcarla hecha
  sin salir de la banda, y abre el formulario al tocar el título.
- Si hay más de 5, una línea al pie: *"y N más abajo"*. No hay "ver todas":
  abajo están los carriles.
- Vacía con cosas por hacer (todo lo pendiente está bloqueado o lejano):
  *"Nada urgente. Lo que sigue espera a otra cosa."*
- Boda sin nada en el camino: *"Todavía no hay nada con fecha."* y, si falta la
  meta "Registro civil", el botón de la plantilla (§4).

**La selección es una función pura**, `queTocaAhora(acciones, requisitos,
semanasHastaLaBoda, limite = 5)` en `lib/metas.ts`:

1. Candidatas: en el camino (`inicioSemanas` no nulo), estado distinto de
   `hecho`, y **desbloqueadas**: todos sus requisitos existentes están `hecho`
   (una acción sin requisitos está desbloqueada).
2. Orden: semana **descendente** (lo que tocaba antes, primero); a igualdad,
   `haciendo` antes de `por_hacer`; a igualdad, por título.
3. Devuelve las primeras `limite`.

Ojo con `listasParaEmpezar`: exige **tener** requisitos, porque su trabajo es
marcar el desbloqueo reciente en el Gantt. `queTocaAhora` no puede reusarla tal
cual — una boda recién empezada, sin dependencias, tendría la banda vacía. Son
dos funciones y las dos se quedan.

Sin fecha de boda la banda funciona igual: mismo orden, sin la columna de
"cuándo tocaba".

### 5.3 El día clave, como marca y no como modo

La mitad del concepto que se entiende sola es ser una **marca con cuenta
regresiva**. Está en tres sitios y en ninguno más:

1. **La tira del próximo día clave**, una línea sobria debajo de la banda "Qué
   toca ahora" en el Mapa y arriba del todo en el Camino:
   > ◆ **Ceremonia civil** · faltan 8 semanas · te faltan 3 cosas antes
   - El **próximo** es el que está en el camino, no `hecho`, con la semana más
     alta (el más temprano). Si no hay ninguno, §5.3.1.
   - "Faltan N semanas" = `semanasHastaLaBoda − semanaDelHito`. Si sale ≤ 0,
     **"es esta semana"**; sin fecha de boda, "N semanas antes de la boda" (o
     "el día de la boda" / "N semanas después").
   - "Te faltan N cosas antes" = las acciones **no hechas de su etapa** (§6), sin
     contar la marca misma. Si son 0: *"ya está todo listo"*.
2. El **rombo** en el Gantt.
3. La **insignia** de la tarjeta y la casilla "Es un día clave" del formulario.

La palabra "etapa" **nunca** aparece en pantalla, y tampoco los títulos
"Hasta …" / "Después de …": son internos (§6).

### 5.3.1 Los cuatro estados de la tira

Marcar un día clave como `hecho` lo saca de `proximoHito`, que es correcto. Pero
"no hay próximo" no significa siempre lo mismo: son cuatro situaciones y cada una
dice una cosa distinta.

| Situación | Qué se dibuja | Dónde |
|---|---|---|
| Hay uno en el camino sin hacer | La tira normal: rombo, nombre, cuenta regresiva, cuántas cosas faltan antes | Mapa y Camino |
| Hay en el camino y **todos** están `hecho` | La **tira de cierre** (abajo) | Mapa y Camino |
| La boda no tiene **ninguna** acción con `es_hito` | La invitación de §8.1 | Solo Mapa |
| Hay acciones con `es_hito` pero **ninguna en el camino** | *"Ponle una semana a tu día clave y verás cuánto falta."* | Solo Mapa |

**La tira de cierre.** Misma forma que la normal para que se lea como la misma
cosa, con un **check** en lugar del rombo y el nombre del **último hecho**:

> ✓ **Ceremonia civil** · hecho · no queda ningún día clave por delante

- El **último hecho** es el que está en el camino, `hecho`, con la semana **más
  baja** (el más tardío en el tiempo, porque las semanas se cuentan hacia atrás).
  Desempata por orden de meta y luego por título, igual que `proximoHito`.
  Función pura: `ultimoHitoHecho(acciones, metas)`.
- **No cuenta nada más.** Nada de "te quedan N cosas sin hacer": eso sería un
  aviso de retraso, fuera de alcance (§14). Lo pendiente de esa etapa sale donde
  ya salía, en "Qué toca ahora".
- Si dos empatan en la semana más baja, se nombran unidos por " y " con
  `nombreDeHitos`, como en la tira normal (§6.1).
- El verbo es **"hecho"** y no "cumplido" ni "logrado": es la misma palabra del
  estado `hecho` que la pareja ya toca en el círculo de la tarjeta.

**Quién decide el caso.** La tabla entera es una función pura,
`estadoDeHitos(acciones, metas)`, que devuelve `{ tipo: "proximo", hito }`,
`{ tipo: "cierre", hito }`, `{ tipo: "sin-semana" }` o `{ tipo: "ninguno" }`.
Compone `proximoHito` y `ultimoHitoHecho`, que se quedan y siguen usándose por
separado. Se hace así y no con tres condiciones dentro de `tira-hito.tsx` porque
la distinción entre "ninguno" y "sin-semana" es la que el componente se
equivocaría en reproducir, y porque es lo que se prueba de una vez (§12).

El cuarto caso es un callejón real: la pareja marcó la casilla, no vio nada y no
tiene cómo saber que falta la semana. Se resuelve con una frase, no con un aviso.
No se muestra en el Camino: ahí esa acción no está dibujada y la frase no tendría
a qué referirse.

### 5.4 Antes / El día / Después

Es la lectura natural del eje, anclada en la **fecha de la boda** (semana 0):

- **Antes** = `inicioSemanas > 0`
- **El día** = `inicioSemanas = 0`
- **Después** = `inicioSemanas < 0`

Se ancla en la semana 0 y **no** en la ceremonia civil: la pareja puede borrar esa
marca, renombrarla o ponerla en la semana 2, y entonces "el día" significaría dos
cosas en la misma pantalla. Es también el control "Cuándo" del formulario (§8),
donde la pareja escribe el signo sin verlo.

## 6. Etapas: definición exacta (cálculo interno, nunca pantalla)

`etapas()` no es una agrupación de pantalla: no titula grupos del Camino ni
carriles del Mapa. Su único trabajo es contestar *"¿cuántas cosas faltan antes
del próximo día clave?"* en la tira de §5.3. Todo en `lib/metas.ts`, puro.

Una acción ocupa las semanas `[finDe(a), inicioDe(a)]`, donde
`finDe = inicio − duracion + 1`. Como las semanas se cuentan hacia atrás, **más
tarde en el tiempo es un número más chico**: `finDe` es su final.

**Los cortes** son las acciones con `es_hito` **que están en el camino**
(`inicioSemanas` no nulo), por sus semanas de mayor a menor.

**La etapa de una acción A** es el corte más temprano que la sigue en el tiempo:

> etapa(A) = `max { h ∈ hitos : h ≤ finDe(A) }`

Si ese conjunto está vacío, A va al grupo final. Se usa `finDe` y no `inicioDe` a
propósito: la etapa de algo es **aquella en la que hay que terminarlo**. Una
acción que empieza antes de un corte pero acaba después cae en la etapa
siguiente, que es la verdad incómoda que hay que ver.

### 6.1 Casos borde

| Caso | Qué pasa |
|---|---|
| **Acciones posteriores al último corte** | Grupo final. Con la plantilla, "Acta de matrimonio" cae aquí. |
| **Acciones anteriores al primer corte** | No es caso borde: caen en la etapa de ese corte. |
| **Boda sin ningún día clave** | `etapas()` devuelve un solo grupo con todo; nadie lo dibuja. No hay tira; el Mapa invita una vez (§8.1). |
| **Boda sin fecha** | Igual: las semanas son relativas. Solo faltan las fechas de día en el eje. |
| **Días clave de varias metas mezclados en el tiempo** | Las etapas se ordenan por semana, no por meta. Lo único visible es que el próximo puede ser de otra meta que la que estás mirando: es correcto. |
| **Dos en la misma semana** | Una sola etapa, y la tira nombra los dos unidos por " y " en orden de meta y, a igualdad, por título ("Edicto matrimonial y Ceremonia civil · faltan 2 semanas"). |
| **El próximo ya está `hecho`** | No es el próximo: la tira salta al siguiente sin hacer. Si no queda ninguno, tira de cierre (§5.3.1). |
| **Uno `hecho` con cosas sin hacer en su etapa** | La tira ya no lo nombra; esas cosas siguen en "Qué toca ahora" si están desbloqueadas. No se inventa aviso de retraso (§14). |
| **Uno que es idea suelta** | No corta nada: no tiene semana. Queda en "Todavía sin sitio". Marcar algo como día clave no lo pone en el camino. |
| **Uno con duración > 1** | No dura: `duracionDe` lo fuerza a 1 y la etapa se corta en su semana. |
| **Dos acciones con la misma semana** | Desempatan por dependencia y, a igualdad, por título, como `ordenPorDependencia`. |
| **Todos los del camino `hecho`** | Tira de cierre con el último hecho (§5.3.1). |
| **El único está `hecho` y es idea suelta** | `estadoDeHitos` da `"sin-semana"`: el Mapa dice *"Ponle una semana a tu día clave y verás cuánto falta."* Es raro y es inofensivo; se prefiere a abrir un quinto mensaje. |

## 7. Mapa (el tablero): los carriles son las metas

- La portada, de arriba abajo: **1)** banda "Qué toca ahora" (§5.2), **2)** tira
  del próximo día clave (§5.3), **3)** los carriles de meta, **4)** la bandeja
  "Ideas sueltas", **5)** el Reparto (en `docs/pagos.md`).
- **El Reparto y la bandeja de ideas van abajo.** Encima de los carriles
  empujaban el primero a `y = 807` en un celular de 375 px y la estructura del
  tablero no se veía de un vistazo. Un carril vacío mide 140 px (168 con título de
  dos líneas): **caben cuatro en una pantalla de 812 px, cinco no**, así que lo
  que vaya arriba hay que ganárselo. Arriba, lo que se mira a diario.
- **Un carril por meta**, en el orden derivado de `ordenarMetas` (§11.3) y no en
  el de `metas.orden`, con el **título que la pareja escribió**. Al final, el carril **"Sin meta"**. Si la boda no tiene
  ninguna meta, ese carril único se titula **"Todo lo anotado"** y lleva la
  invitación *"Agrupa lo que va junto: crea una meta."*
- Un carril de meta muestra, bajo su título: `N · S/ monto` y el avance
  ("3 de 8 hechas"), que ya calcula `resumenMeta`. Vacío dice *"arrastra aquí lo
  que sea de esta meta"*; el de "Sin meta", *"arrastra aquí lo que no es de
  ninguna meta"*.
- Los carriles se **apilan**, con sus tarjetas en una rejilla que envuelve.
- Dentro de un carril, las tarjetas van **por semana** (lo más temprano primero)
  y, a igualdad, por título. Las acciones de esa meta que son **ideas sueltas** no
  salen en su carril: están en la bandeja. El carril es "lo de esta meta que ya
  tiene cuándo".
- **Arrastrar escribe la meta**, que es la pregunta que de verdad se contesta
  moviendo una tarjeta ("esto es de la fiesta, no del papeleo"):
  - a un carril de meta → `meta_id` = esa meta;
  - al carril "Sin meta" → `meta_id = null`;
  - a **"Ideas sueltas"** → `inicio_semanas = null`, **conservando la meta**, las
    dependencias, el monto, los pagos y el responsable;
  - **desde** "Ideas sueltas" a un carril → además de la meta, se escribe
    `inicio_semanas = semanaPorDefecto({ hitoSemana: null, semanasHastaLaBoda,
    duracion })` (§2.1). Es el único arrastre que toca la semana.
- Mover entre carriles de meta **nunca** cambia la semana. La semana se edita en
  el formulario (§8), donde es un número que se lee y se corrige, no un cubo al
  que se tira algo. Arrastrar nunca cambia duración, estado ni responsable.
- El menú **"Mover a"** de la tarjeta ofrece las mismas metas, "Sin meta" e
  "Ideas sueltas", y hace exactamente lo mismo. En el celular es la vía principal
  y la ruta obligatoria de teclado.
- `moverAccion(id, destino)` con `destino = metaId | "sin-meta" |
  "ideas-sueltas"`; el servidor resuelve qué columnas escribe.
  `ponerEnSemana(id, semanas | null)` es del formulario.

### 7.1 Por qué la meta y no otra cosa

- **Es el mismo agrupador que el Camino.** Una sola manera de partir el trabajo en
  toda la app: el tablero es para mover y marcar, el Camino para ver cuándo.
- **Los carriles no aparecen ni desaparecen solos.** Una meta la crea y la borra
  la pareja; existe aunque esté vacía.
- **El id del carril es el id de la meta**: estable entre renders, sin depender de
  la semana de nada.
- **El optimismo es trivial**: cambiar `meta_id` en el cliente no recalcula
  cortes de tiempo, así que la tarjeta no puede saltar dos veces.
- **El número de carriles lo decide la pareja** y cada uno lleva su nombre. Con la
  plantilla son dos; en la demo, tres.
- Se descartan: **por estado**, porque el estado ya se cambia con un toque en el
  círculo y un carril "Hecho" convierte la portada en un archivo; **por
  responsable**, porque en una boda de dos son dos carriles y una discusión; **por
  tramo de tiempo** ("Ahora / Pronto / Más adelante"), porque soltar una tarjeta
  en un cubo reescribiría la semana con un número inventado y porque "ahora" ya lo
  contesta la banda de §5.2 sin pedirle a nadie que arrastre nada.

## 8. Formulario de acción

- Campo **Meta**, con "Sin meta" y "+ Nueva meta…".
- Casilla **"Es un día clave"**, con la ayuda de §8.1 al lado.
- Control **"Cuándo"** de tres opciones — **Antes · El día · Después** — junto al
  número de semanas:
  - la opción se **deriva del signo de `inicioSemanas`** al abrir (sin semanas,
    ninguna marcada) y **no se guarda**: solo sirve para teclear el número en
    positivo, que es como habla la gente ("un mes después", no "−4");
  - al guardar: *Antes* → `+semanas`, *El día* → `0`, *Después* → `−semanas`.
- Dejar las semanas vacías guarda `inicioSemanas = null`: la acción es una idea
  suelta. El formulario lo dice: *"Sin semanas, queda en ideas sueltas."*
- "Cuántas dura" desaparece cuando la casilla está encendida: no dura.
- Al anotar desde un carril de meta llega **prellenada la meta** y la semana
  **prellenada** con `semanaPorDefecto({ hitoSemana: null, semanasHastaLaBoda,
  duracion })`, con su opción ya marcada. Desde "Sin meta" llega sin meta. Desde
  el botón **Anotar** del celular y desde la bandeja de ideas llega vacío.
- Este campo es **el único sitio donde se escribe la semana a mano**.
- **No** lleva la lista de dependencias: el orden tiene su propio diálogo
  (`docs/dependencias.md` §4), alcanzable desde el menú ⋯ de las dos pantallas.
- El diálogo nunca supera la pantalla, las acciones de servidor devuelven
  `{ error }` en vez de lanzar, y si guardar falla después de crear una meta
  nueva, esa meta se borra.

### 8.1 La ayuda del día clave

**La pregunta que contesta** y que ninguna pantalla contesta: *"¿esto que estoy
anotando es un día clave, y qué me cambia marcarlo?"*. Se contesta en el único
sitio donde se decide, el formulario. No hay pantalla nueva, ni página de ayuda,
ni recorrido guiado.

Tres piezas, y ninguna más:

1. **Un disparador siempre visible, junto a la etiqueta.** Icono `Info` de
   `size-3.5` inmediatamente después de "Es un día clave", con
   `aria-label="Qué es un día clave"`, que abre un **Popover** de shadcn. Popover
   y no Tooltip: un tooltip no tiene ruta táctil y la puerta de calidad la exige.
   El disparador va **fuera** del `<label>`: dentro, tocarlo cambiaría el
   interruptor. Su área de toque crece con un pseudo-elemento hasta 44 px de alto
   y 35 px de ancho, porque hacia la izquierda solo se come el hueco de 6 px.
2. **El contenido del popover**, en este orden y con este texto:
   > **Un día clave marca un día, no un trabajo.**
   >
   > El caso claro es la ceremonia civil: un día concreto que parte tu boda en
   > antes y después.
   >
   > No son días clave las cosas que te toman tiempo: juntar las partidas,
   > esperar el certificado médico, elegir a los testigos. Esas duran, y por eso
   > llevan semanas.
   >
   > Si lo marcas:
   > - aparece arriba con su cuenta regresiva;
   > - en el camino se dibuja como un rombo;
   > - desaparece "Cuántas dura", porque un día clave no dura.
3. **Una línea bajo la fila de interruptores, solo cuando está encendido**, para
   quien enciende sin leer nada: *"Un día clave no dura: marca el día. Lo verás
   arriba con su cuenta regresiva."* Se oculta al apagarlo. Misma pieza y mismo
   estilo que *"Sin semanas, queda en ideas sueltas."* (`text-muted-foreground
   text-xs`).

**La invitación del Mapa** (§5.3.1) nombra el ejemplo, porque es el primer sitio
donde la pareja se encuentra la palabra:

> **"Marca tu día clave, la ceremonia civil, y verás cuánto falta."**

`INVITA_HITO` cambia de valor, no de nombre ni de sitio.

### 8.2 Qué es día clave de verdad en el trámite peruano, y qué no

| Acción de la plantilla | ¿Día clave? | Por qué |
|---|---|---|
| **Ceremonia civil** | **Sí**, y viene marcada (§4) | Día fijado por la municipalidad o la notaría. No dura. Parte la boda en antes y después. Es el caso de libro. |
| **Expediente en la municipalidad** | Punto de paso real, pero **no viene marcado** | El día en que la municipalidad admite el expediente sí decide: hasta que no está admitido no hay aviso. Pero armarlo y presentarlo toma días, y nadie planifica una boda contando semanas hacia ese día. Queda como acción con duración; la pareja puede marcarlo. |
| **Edicto matrimonial** | **No**, y es el que más se confunde | El aviso del matrimonio proyectado se fija **ocho días** en la municipalidad o notaría (Código Civil, art. 250) y en ese plazo cabe la oposición de quien tenga interés legítimo (art. 253): es una **espera**, no un día. Marcarlo le fuerza la duración a 1 y le quita justo la espera, que es lo que hace esperar. |
| **Acta de matrimonio** | **No** | Es recoger un papel, después del día que importa. Cierra el trámite pero no condiciona nada. |
| Partidas, copia del DNI, certificado domiciliario, certificado médico prenupcial, elegir a los testigos | **No** | Son trabajos con duración, cada uno con su cola de espera. |

**El edicto en la demo no se reabre** (§10): allí sigue marcado para que la tira
tenga algo que contar antes de la semana 0, y tiene defensa propia —el día en que
el aviso sale publicado sí es un día— pero **la plantilla no lo marca** y la ayuda
lo usa como contraejemplo. Es la única discrepancia deliberada entre la demo y la
plantilla, y está escrita aquí para que nadie la "arregle" al revés.

**Contexto verificado que no entra en la plantilla:** la Ley 31643 (diciembre de
2022) habilitó a los notarios a celebrar el matrimonio civil y permitió publicar
el aviso por medios digitales; y, vencido el plazo sin oposición, la autoridad
declara la capacidad de los contrayentes y el matrimonio puede celebrarse dentro
de **cuatro meses** (art. 258). "Capacidad declarada" sería un día clave
impecable y aquí no se usa: nadie en una pareja llama así a nada.

## 9. Integración con Bernie

Sin cambios en el contrato. La subcategoría de Bernie sigue sugiriendo la
**acción**; al asignar un gasto, su pago suma a la acción y, por derivación, al
monto de su meta. `crearAccionConGasto` crea la acción con
`inicioSemanas = semanaPorDefecto` (sin referencia) y estado `haciendo`: un gasto
que ya existe no es una idea suelta, está pasando.

## 10. Demo

La boda demo usa la plantilla: sus trámites quedan en la meta "Registro civil" y
"Almuerzo con la familia" con el restaurante en una meta "Almuerzo". Marca
**también "Edicto matrimonial"** (semana 6) para que la tira tenga algo que contar
antes de la ceremonia: con una sola marca en la semana 0 diría siempre lo mismo.
La semilla usa los títulos en sustantivo de §4.1.

Con dos metas más el carril "Sin meta", la demo muestra **tres carriles** en el
Mapa, que es lo que hay que poder mirar en un celular. Las dos ideas sueltas
("Video corto", "Mesa de dulces") se quedan sin semanas.

## 11. Un solo enfoque, con palabras que se entienden

### 11.1 La pregunta de producto, antes del modelo

El dueño del producto no pidió menos estructura. Pidió **la misma estructura con
vocabulario entendible**, y describió su boda así: la meta 1 puede ser ahorrar X
cantidad, otra el registro civil, luego la ceremonia, luego la recepción; cada
una tiene sus propios requisitos y dependencias, y para llegar a una primero hay
que hacer otras.

Eso fija tres cosas y cierra una:

1. **"Meta" queda confirmada.** Él la usa sin que nadie se la enseñe. No se
   vuelve a abrir.
2. **Sus metas son fases con un orden lógico entre ellas**: ahorro → registro
   civil → ceremonia → recepción.
3. **Cada meta tiene requisitos y dependencias propias.** Las acciones ya los
   tienen; la meta, como tal, no.

Las tres preguntas que una pareja hace, y quién las contesta:

| Pregunta de la pareja | Quién la contesta hoy |
|---|---|
| ¿En qué fase estamos y qué viene después? | La **meta** (carril del Mapa, grupo del Camino) |
| ¿Qué día no se mueve y cuánto falta para él? | El **día clave** (§11.2) |
| ¿Qué me frena ahora? | La **dependencia** y la banda "Qué toca ahora" |

Ninguna palabra nueva entra si no contesta una de esas tres.

### 11.2 El día clave se queda como concepto; "hito" se va de la pantalla

**Qué contesta el día clave que la meta no contesta, en una frase:** un día fijo
del calendario con su cuenta regresiva, mientras que una meta es un tramo cuyo
rango se **deriva** de sus acciones y se mueve cada vez que se edita una.
"Ceremonia civil · faltan 8 semanas" es un compromiso con un tercero; "Registro
civil · termina hacia la semana 2" es una estimación. Por eso el concepto no se
retira.

Retirarlo, además, costaría: la columna `es_hito`, el rombo del Camino, la tira
de cuenta regresiva en sus cuatro estados (§5.3.1), la casilla del formulario, la
insignia de la tarjeta, el rombo de la imagen para compartir (`lib/historia.ts`),
las acciones ya marcadas de cada boda y de la demo, y siete funciones puras:
`proximoHito`, `ultimoHitoHecho`, `estadoDeHitos`, `nombreDeHitos`,
`faltanAntesDe`, `etapas()` (sus cortes **son** los días clave, §6) y
`semanaPorDefecto` (§2.1). Se perdería de paso el "te faltan N cosas antes", que
es lo único del producto que relaciona el calendario con el trabajo pendiente.

Lo que sí se va es **la palabra en pantalla**: "hito" no es español corriente y
la confusión era del par "meta frente a hito", dos sustantivos abstractos que
suenan los dos a logro. Se reemplaza por **día clave**: una meta es algo que se
logra, un día clave es un día del calendario, y la etiqueta ya contiene la
definición — la primera frase del popover era literalmente "Un hito es un día, no
un trabajo", o sea que la ayuda existía para decir lo que el nombre debía decir.
Plural "días clave" (invariable, correcto en español).

| Candidata descartada | Por qué |
|---|---|
| **fecha clave** | Choca con la "fecha de la boda" de la cabecera, la única fecha absoluta del producto. Y una marca puede no tener semana puesta (§5.3.1): "fecha" promete un dato que puede faltar. |
| **momento** | Fue una columna con otro significado (§2). Reusar la palabra siembra la próxima confusión. |
| **día señalado** | Largo, y el participio suena a invitación formal, no a casilla. |
| **checkpoint**, **milestone** | Inglés. El vocabulario del producto es español. |
| **hito, explicado** | Ya se hizo (§8.1) y la duda siguió. La explicación se paga en cada aparición; la palabra, una vez. |

### 11.3 Las metas no llevan precedencia propia: el orden se deriva

Las dos salidas, con su costo:

| Salida | Costo |
|---|---|
| **A. Precedencia entre metas** (par `(metaId, requiereMetaId)` o columna) | Segunda fuente de verdad que puede **contradecir** las semanas de sus acciones: "Recepción requiere Ahorro" con una acción de Recepción diez semanas antes que todo el Ahorro. Es exactamente el error de `momento` (§2): dos datos que tienen que coincidir acaban no coincidiendo. Pide además detección de ciclos, una pantalla nueva para declararla y flechas entre barras resumen. |
| **B. Elegida: la precedencia sigue entre acciones y la meta la hereda** | La pareja tiene que encadenar **acciones** para decir que una fase espera a otra; no hay un control de "esta meta espera a esta otra". A cambio, cero columnas, cero ciclos nuevos y ninguna contradicción posible. |

Con B, el orden lógico que el dueño describió **se ve** sin declararlo:

- **Orden de los carriles y de los grupos**, derivado: por la semana de inicio
  más temprana de sus acciones (`inicio_semanas` más alto primero), las metas sin
  ninguna acción en el camino al final, y a igualdad `metas.orden` y luego
  `creada_el`. Función pura `ordenarMetas(metas, acciones)`. Sustituye al
  `metas.orden` puesto a mano como criterio principal, en el Mapa (§7) y en el
  Camino (§5), que siguen ordenando igual entre sí. `metas.orden` se queda como
  desempate: ninguna columna cambia.
- **A quién espera la meta**, derivado: las metas **predecesoras**: las metas de
  las acciones que sus acciones requieren (de las que esta meta depende), sin
  contar ella misma. Se escribe en la **barra resumen** del
  Camino, debajo del título: *"↳ después de Registro civil"*; con dos o más, se
  unen por " y " en el mismo orden de `ordenarMetas`. Función pura
  `metasQueEspera(metaId, acciones, dependencias, metas)`.

Casos borde:

| Caso | Qué pasa |
|---|---|
| Meta sin ninguna acción | Va al final, sin "↳ después de". |
| Meta con todas sus acciones como ideas sueltas | Va al final: no tiene semana que ordenar. |
| Dependencia hacia una acción sin meta | No produce "↳ después de": "Sin meta" no es una fase. |
| Dependencia hacia una acción borrada | Se ignora, igual que en `queTocaAhora` (§12). |
| Dependencia dentro de la misma meta | No produce "↳ después de": ya se dibuja como flecha. |
| Dos metas que se esperan entre sí (ciclo a nivel de meta) | **Se dibujan las dos líneas y no se corrige nada.** No es un ciclo nuevo: la única fuente sigue siendo la dependencia entre acciones, donde el orden topológico ya ignora al miembro de un ciclo (`lib/metas.ts:158`). Es una descripción de lo que la pareja encadenó, no una regla que valide. |
| Meta cuyo "↳ después de" no cabe en una línea | Se trunca con elipsis; el nombre completo va en `title`. |

### 11.4 La meta gana ejemplos, no un popover ni una columna

El dueño pidió explicación y ejemplos **para el hito** porque el concepto no se
entendía. Con la meta el problema es otro: la palabra se entiende y lo que falta
es ver **de qué tamaño** es una meta. Un popover sería simetría sin demanda.

- **Ejemplos donde la boda está vacía**: `INVITA_META` nombra las cuatro fases
  del dueño en vez de describir la idea en abstracto.
- **Ejemplos donde se crea**: el campo "+ Nueva meta…" gana un `placeholder` con
  tres de ellas. Es el único sitio donde la pareja escribe el nombre.
- **Sin columna `descripcion` en `metas`.** El título más las acciones que
  contiene ya dicen qué es la meta, y una descripción libre sería un segundo
  sitio que mantener al día. **§11 no añade ninguna columna: nada pendiente en
  Neon** (§3.1).

### 11.5 Vocabulario de pantalla, cadena por cadena

Dieciséis cadenas. Son todas las que la pareja puede leer; el resto de las
apariciones son identificadores y comentarios (tabla de abajo).

| # | Archivo | Viejo (literal) | Nuevo (literal) |
|---|---|---|---|
| 1 | `_acciones/formulario-accion.tsx` | `Es un hito` | `Es un día clave` |
| 2 | `_acciones/formulario-accion.tsx` | `aria-label="Qué es un hito"` | `aria-label="Qué es un día clave"` |
| 3 | `_acciones/formulario-accion.tsx` | `Un hito es un día, no un trabajo.` | `Un día clave marca un día, no un trabajo.` |
| 4 | `_acciones/formulario-accion.tsx` | `No son hitos las cosas que te toman tiempo: …` | `No son días clave las cosas que te toman tiempo: …` (el resto de la frase no cambia) |
| 5 | `_acciones/formulario-accion.tsx` | `desaparece “Cuántas dura”, porque un hito no dura.` | `desaparece “Cuántas dura”, porque un día clave no dura.` |
| 6 | `_acciones/formulario-accion.tsx` | `Un hito no dura: marca el día. Lo verás arriba con su cuenta regresiva.` | `Un día clave no dura: marca el día. Lo verás arriba con su cuenta regresiva.` |
| 7 | `_acciones/tipos.ts` (`INVITA_HITO`) | `Marca como hito el día que más importa, tu ceremonia civil, y verás cuánto falta.` | `Marca tu día clave, la ceremonia civil, y verás cuánto falta.` |
| 8 | `_acciones/tipos.ts` (`HITO_SIN_SEMANA`) | `Ponle una semana a tu hito y verás cuánto falta.` | `Ponle una semana a tu día clave y verás cuánto falta.` |
| 9 | `_acciones/tira-hito.tsx` | `no queda ningún hito por delante` | `no queda ningún día clave por delante` |
| 10 | `_acciones/tarjeta-accion.tsx` | insignia `hito` | insignia `día clave` |
| 11 | `_acciones/camino.tsx` | `title={`${a.titulo} (hito)`}` | `title={`${a.titulo} (día clave)`}` |
| 12 | `_acciones/camino.tsx` (leyenda, `camino.tsx:266`) | `Hito` | `Día clave` |
| 13 | `_acciones/camino.tsx` (leyenda, `camino.tsx:263`) | `Cadena principal` | `Lo que no se puede atrasar` |
| 14 | `_acciones/tipos.ts` (`INVITA_META`) | `Agrupa lo que va junto: crea una meta.` | `Agrupa lo que va junto en metas: ahorro, registro civil, ceremonia, recepción.` |
| 15 | `_acciones/formulario-accion.tsx` | — (el campo no tiene `placeholder`) | `placeholder="Ahorro, ceremonia, recepción…"` |
| 16 | `_acciones/camino.tsx` (barra resumen) | — (no existe) | `↳ después de {metas}` (§11.3) |

Las 13 y 16 son las únicas que no son un cambio de palabra: "cadena principal"
no le dice nada a una pareja y lo que significa cabe en la frase, y el "↳ después
de" es el orden lógico que el dueño describió, hecho visible.

**Lo que NO cambia, censado a propósito:**

| Qué | Por qué |
|---|---|
| `metas`, `meta_id`, `es_hito`, `lib/metas.ts`, `docs/metas.md`, `proximoHito`, `ultimoHitoHecho`, `estadoDeHitos`, `nombreDeHitos`, `faltanAntesDe`, `cadenaPrincipal`, `tira-hito.tsx`, `TiraProximoHito`, `INVITA_HITO`, `HITO_SIN_SEMANA`, `AyudaHito`, `EstadoDeHitos` | Vocabulario de pantalla, no refactor. Renombrar identificadores es un diff de cientos de líneas que la pareja no ve, con riesgo de romper lo que funciona. El precio —"hito" en el código, "día clave" en pantalla— lo paga el glosario de la cabecera. |
| `Sin meta`, `NOMBRE_SIN_META`, `Todo lo anotado`, `Meta` (etiqueta), `+ Nueva meta…`, `Nombre de la meta nueva`, `arrastra aquí lo que sea de esta meta`, `arrastra aquí lo que no es de ninguna meta`, `o empieza con la meta Registro civil.`, `Meta Registro civil creada con sus pasos.`, `No se pudo crear la meta.`, `Esa meta no es de esta boda.`, `Ponle un nombre a la meta.`, `Ya tienen la meta Registro civil.`, `Ya tienen una meta llamada "…".` | "Meta" queda confirmada (§11.1). |
| `↳ requiere` (`REQUIERE`), `Cada requisito de la municipalidad…` de la portada | "Requisito" es la palabra que usa la municipalidad y la que la pareja ya oye en el trámite. Es la más entendible que hay para esto, no la menos. |
| `Quién responde`, `Todavía nadie` | Ya son lenguaje llano: "responsable" no se lee en ninguna pantalla. |
| `Acción creada con este pago.`, `Elegir acción`, `Anotar` | "Acción" se entiende por el sitio donde está, y es el nombre del producto para la unidad. |
| `Haciendo`, `Hecho`, `Lista para empezar`, `Hoy`, `Todavía sin sitio`, `Mover a`, `Ideas sueltas`, `Reparto` | Sin jerga. |
| Plantillas (los `alias` de §4.1 son títulos de acción), base de datos, contrato de Bernie | Fuera del vocabulario. |

### 11.6 Riesgo de pantalla

| Sitio | Qué medir |
|---|---|
| Fila de interruptores del formulario ("Cuesta tiempo", "Cuesta dinero", "Es un día clave" + icono `Info`) | Que la fila envuelva sin partir la etiqueta de su `Switch`, y que el icono conserve sus 44 px de área de toque. |
| Insignias de la tarjeta (meta, ⏱, 💰, responsable, día clave) | Que la insignia no se trunque ni empuje las otras a una tercera línea en la tarjeta más cargada. |
| Leyenda del Camino (ahora siete entradas, con "Lo que no se puede atrasar" de 26 caracteres) | Cuántas líneas ocupa a 375 px, y que no desplace la rejilla. |
| Barra resumen con "↳ después de …" | Que la línea nueva no cambie la altura de fila de la rejilla del Gantt ni desalinee las flechas, que se miden sobre el DOM real. |
| Orden derivado de los carriles (§11.3) | Que editar la semana de una acción no reordene los carriles **durante** un arrastre. Si lo hace, el orden se congela mientras `dnd-kit` tiene algo en la mano. |

Si una etiqueta no cabe, la salida **no** es volver a la palabra vieja: la
insignia de la tarjeta se queda solo con el rombo y su `aria-label`, porque ahí la
palabra es redundante con el icono. La etiqueta del formulario no se abrevia: es
el único sitio donde la pareja decide.

## 12. Pruebas

`node:test` sobre funciones puras de `lib/metas.ts`. Lo que existe sigue: orden de
dependencia, cadena principal, "lista para empezar", avance y rango de la meta,
plantilla que no duplica por título, y toda la batería de `etapas()`. Lo que la
tira y la banda exigen:

- **`queTocaAhora`**: excluye ideas sueltas y lo `hecho`; excluye lo bloqueado por
  un requisito sin hacer; **incluye** lo que no tiene ningún requisito (la
  diferencia con `listasParaEmpezar`, con una prueba que las compara en una boda
  sin dependencias); ordena por semana descendente, luego `haciendo` antes de
  `por_hacer`, luego por título; respeta el límite.
- Un requisito que apunta a una acción que ya no existe **no bloquea**.
- **`proximoHito`**: el que está en el camino, no hecho, con la semana más alta;
  null si no hay; ignora los que son idea suelta; salta el ya hecho.
- **`ultimoHitoHecho`**: en el camino, `hecho`, con la semana **más baja**; null
  si no hay ninguno hecho; ignora ideas sueltas y los que no están hechos.
- **`estadoDeHitos`**: los cuatro `tipo` de §5.3.1, uno por prueba, incluida la
  diferencia entre `"ninguno"` y `"sin-semana"`. Un hito hecho que es idea suelta
  no da `"cierre"`.
- **`nombreDeHitos`**: dos empatados en la semana más baja se unen con " y ", en
  orden de meta y luego por título.
- **Cuántas cosas faltan antes**: las no hechas de su etapa **sin contar la marca
  misma** — la frase dice "te faltan N cosas **antes**".
- **La cuenta regresiva**: `semanasHastaLaBoda − semanaDelHito`, con ≤ 0 → "es
  esta semana", y sin fecha de boda no hay cuenta.
- **etapas**: una acción cae en el corte más temprano que la sigue; una que
  **cruza** un corte cae en la etapa siguiente (se usa `finDe`); la marca
  pertenece a **su propia** etapa y se ordena **al final** de ella; lo posterior
  al último corte va al grupo final, que no aparece si está vacío; sin cortes, un
  solo grupo; dos en la misma semana, una sola etapa; uno sin semanas no corta; las
  ideas sueltas no aparecen en ninguna etapa.
- **Plantilla con alias**: una boda que ya tiene "Publicar el edicto matrimonial"
  no gana una segunda acción al aplicar la plantilla; la existente conserva su
  título y recibe la meta.
- **`semanaPorDefecto`**: con hito, sin hito y con fecha, sin hito y sin fecha, y
  el mínimo de 1 semana.

Lo que **§11** agrega (el vocabulario no se prueba: es texto de pantalla y lo
verifica el validador, §13; el orden derivado sí es función pura):

- **`ordenarMetas`**: ordena por la semana de inicio más temprana de sus acciones
  (`inicio_semanas` más alto primero); la meta sin acciones y la que solo tiene
  ideas sueltas van al final; a igualdad desempata por `orden` y luego por
  `creadaEl`; las ideas sueltas no cuentan para la semana de su meta.
- **`metasQueEspera`**: nombra las metas **predecesoras**, es decir las metas de
  las acciones que las acciones de esta meta requieren (aquellas de las que depende); excluye la propia meta y las acciones sin meta; ignora un requisito
  que apunta a una acción que ya no existe; dos metas que se esperan entre sí
  devuelven cada una a la otra, sin bucle ni excepción.

## 13. Orden de implementación de §11

**Dos cambios coherentes, en este orden.** El primero es solo texto; el segundo
toca `lib/` y las dos pantallas. No se mezclan en una pasada.

**Cambio 1 — vocabulario (una pasada, cinco archivos, sin `lib/` y sin base).**

1. `app/mi-boda/_acciones/tipos.ts`: nuevos valores de `INVITA_HITO`,
   `HITO_SIN_SEMANA` e `INVITA_META` (cadenas 7, 8 y 14).
2. `app/mi-boda/_acciones/formulario-accion.tsx`: cadenas 1–6 y el `placeholder`
   del campo de meta nueva (cadena 15).
3. `app/mi-boda/_acciones/tira-hito.tsx`: cadena 9.
4. `app/mi-boda/_acciones/tarjeta-accion.tsx`: cadena 10.
5. `app/mi-boda/_acciones/camino.tsx`: cadenas 11, 12 y 13.
6. `grep -rniE "hito" app components` y comprobar que lo que queda son
   identificadores, comentarios y referencias a esta spec, no texto de pantalla.

**Cambio 2 — el orden lógico de las metas, derivado (§11.3).**

7. `lib/metas.ts`: `ordenarMetas(metas, acciones)` y
   `metasQueEspera(metaId, acciones, dependencias, metas)`, puras, con las
   pruebas de §12.
8. `app/mi-boda/_acciones/datos.ts` o la página que arma los grupos: los
   carriles del Mapa (§7) y los grupos del Camino (§5) pasan a ordenarse con
   `ordenarMetas`. Las dos pantallas usan la misma llamada: si una se queda
   atrás, el orden de los carriles y el de los grupos deja de coincidir.
9. `app/mi-boda/_acciones/camino.tsx`: la línea `↳ después de …` en la barra
   resumen (cadena 16).

Validación: la tira en sus **cuatro** estados; el formulario con la casilla
apagada y encendida; la leyenda del Camino; una boda con cuatro metas encadenadas
(ahorro → registro civil → ceremonia → recepción) para ver el orden derivado y el
"↳ después de"; una meta sin acciones y una con todas sus acciones como ideas
sueltas. Todo en móvil (375×812) y escritorio, claro y oscuro, con el popover
abierto por toque y por teclado; más las cinco mediciones de §11.6.

## 14. Qué queda fuera

- **Una tabla `hitos` aparte.** Sigue siendo una acción con `es_hito`. Separarlos
  rompería la regla del producto: una sola entidad para todo.
- **Guardar la etapa en una columna.** Es derivada.
- **Fechas absolutas por acción.** El tiempo sigue en semanas relativas: mover la
  boda mueve todo con ella, que es lo que pasa de verdad.
- **Duraciones en días**, y etapas con inicio y fin propios.
- **Reordenar a mano** dentro de un carril o de un grupo.
- **Editar dependencias arrastrando**, en el Mapa o entre barras del Camino.
  Editarlas **sí** se puede, con la lista de `docs/dependencias.md`; lo que
  queda fuera es la vía del arrastre.
- **Validar o avisar si un título se escribe en infinitivo.** La pareja nombra sus
  acciones como quiera; solo se arreglan los nombres de la plantilla.
- **Cualquier segunda agrupación**: por día clave, por responsable, por estado,
  por tramo de tiempo. Una sola, la meta, en las dos pantallas. Si se reabre, que
  sea con una pregunta de una pareja que ninguna pantalla conteste.
- **"Qué toca ahora" como pantalla propia**, con su ruta y su historial. Hoy es un
  bloque del Mapa.
- **Más de 5 líneas en la banda**, filtros, "posponer", "en esto estoy hoy", o un
  orden a mano. La banda no es una lista editable: es un recordatorio.
- **Recordatorios por correo o notificación.**
- **Un aviso de retraso** ("esto no llega", "esta semana ya pasó y no está
  hecho"). Hay un atraso implícito en que la banda ordene por semana descendente,
  pero **no se pinta en rojo ni se cuenta**. Es otra spec, y la más probable.
- **Varios días clave a la vez en la tira**, o un historial de los pasados. Solo
  el próximo, o el último si ya no queda ninguno.
- **Celebrar el cierre** con confeti, insignia o cambio de color. La tira de
  cierre es una línea sobria. Si se quiere celebrar, es materia de
  `docs/compartir.md`.
- **Un botón de anotar en el Camino.** Se anota en el Mapa. El Camino sí se
  edita: tiene menú ⋯ por fila (`docs/dependencias.md` §9.1), pero no crea
  acciones nuevas.
- **Juntar el Mapa y el Camino** o renombrar las vistas.
- **El contrato de Bernie.** Intacto.

Lo que añade **§11**:

- **Renombrar "meta"** en pantalla. Se queda tal cual (§11.1).
- **Retirar el día clave del producto** y no solo la palabra (§11.2).
- **Renombrar identificadores, tablas, columnas, archivos o esta spec** (§11.5).
- **Precedencia propia entre metas** (tabla o columna "esta meta requiere esta
  otra"), **flechas entre barras resumen** del Camino y **detección de ciclos
  entre metas** (§11.3).
- **Una columna `descripcion` en `metas`** o cualquier otra columna nueva: §11 no
  añade ninguna (§11.4).
- **Un popover de "meta"** (§11.4).
- **Reordenar los carriles a mano.** El orden se deriva (§11.3).
- **Una plantilla de las cuatro fases** (ahorro, registro civil, ceremonia,
  recepción). Ya no queda fuera: es `docs/plantillas.md`, su propia spec.
- **Una migración de datos.** Ninguna fila guarda la palabra: las dos viven en
  cadenas del código.
- **Explicar "meta", "acción", "camino", "mapa" o "dependencia"** con el mismo
  popover. Esas se entienden por el sitio donde están. Si alguna resulta no
  entenderse, se arregla cuando se vea, no por simetría.
- **Retirar el popover de §8.1** ahora que la etiqueta dice más. Se queda: ya no
  tiene que definir la palabra, pero sigue siendo el único sitio que dice las
  **consecuencias** de marcar (rombo, cuenta regresiva, "Cuántas dura" que
  desaparece). Su primera frase se acorta, no se borra.
- **Marcar más días clave en la plantilla.** Uno, la ceremonia civil (§4).
- **Sugerir o validar** ("esto parece un día clave, ¿lo marcas?"). La pareja
  decide; la app no adivina.
- **Un glosario en la interfaz.** El glosario de la cabecera de este documento es
  para quien implementa, no para la pareja.

## 15. Preguntas abiertas para el arquitecto

1. **Insignia de la tarjeta** (§11.6): si "día clave" no cabe a 375 px, ¿se queda
   el rombo solo con `aria-label="día clave"`, o se abrevia de otro modo? La
   medición manda; la decisión escrita arriba es la preferida, confírmala.
2. **Fila de interruptores** (§11.6): con "Es un día clave" la fila de tres
   interruptores más el icono `Info` crece. ¿Envuelve bien, o conviene que esa
   casilla baje a su propia línea? Si baja, la línea de consecuencia de §8.1 tiene
   que seguir pegada a ella.
3. **Referencias de sección que quedaron viejas al consolidar** (son
   comentarios, no código; arréglalas cuando toques cada archivo):
   `lib/metas.ts:23` y `db/schema.ts:114` citan **§2.2**, que ahora es **§2**;
   `app/mi-boda/_acciones/datos.ts:49` cita **§14.4**, que era una pregunta
   abierta ya cerrada y hoy es la pregunta **5** de esta sección.
4. **Comentario desactualizado en `db/schema.ts`**: el comentario del índice
   `acciones_boda_orden_idx` todavía dice que en Neon existe
   `acciones_boda_momento_idx` y que se cambia "en el paso 3 del despliegue, no en
   este PR". Ese paso ya se ejecutó (§3.1). Es un comentario, no código: arréglalo
   cuando toques el archivo.
5. **Tipos**: `AccionEnCamino` ya existe con `inicioSemanas: number`. ¿Se usa en
   todas las firmas que no pueden recibir una idea suelta, o quedan sitios donde
   se filtra antes de llamar y el compilador no atrapa el caso?
6. **`metas.orden`**: con `ordenarMetas` (§11.3) deja de ser el criterio
   principal y queda solo como desempate. ¿Se mantiene la columna y su índice
   `(boda_id, orden)`, o el desempate se hace con `creada_el` y el índice se
   retira? No se toca en §13: decidirlo exige una migración y §11 no añade ni
   quita columnas.
7. **Dónde vive el orden derivado**: `ordenarMetas` es pura, pero los grupos se
   arman hoy en `camino.tsx` y en `mi-boda/page.tsx` por separado. ¿Se ordena una
   sola vez en `datos.ts` al leer las metas, o cada pantalla llama a la función?
   Lo que la spec exige es que las dos coincidan siempre.
8. **Reordenar durante un arrastre** (§11.6): si cambiar la semana reordena los
   carriles mientras `dnd-kit` tiene una tarjeta en la mano, ¿basta con congelar
   el orden durante el arrastre, o hace falta algo más? Arrastrar nunca escribe la
   semana (§7), así que el caso solo aparece con dos personas editando a la vez.
9. **`metasQueEspera` y el rendimiento**: recorre las dependencias por cada meta.
   ¿Se calcula una vez para todas las metas en una sola pasada, o importa poco con
   60 acciones?
10. **Rendimiento**: la banda, la tira y los carriles recorren la misma lista
    tres veces por render. ¿Importa con 60 acciones? Probablemente no; dicho por si
   acaso.
11. **El Mapa con muchas metas**: ¿qué pasa si una boda llega a quince, se
    colapsan los carriles vacíos o se deja crecer? Hoy: se deja crecer.
