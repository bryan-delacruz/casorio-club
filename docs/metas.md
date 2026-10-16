# Metas, hitos y el camino

> **Spec (SDD).** Este documento manda sobre el código de las metas y del
> camino: si algo cambia, primero se actualiza aquí.
>
> **Estado:**
> - §1, §4, §9 (metas, plantilla, Bernie): **aprobadas e implementadas**.
> - §2, §3 (**el tiempo como única fuente**, sin `momento`): **aprobadas,
>   pendientes de implementar**.
> - **Enmienda 1 (validado en pantalla):** los títulos de la plantilla que
>   pueden llegar a ser hito pasan de infinitivo a sustantivo (§4, §4.1, §3.1
>   paso 1b), y se retira el botón de anotar desde una etapa del camino, que
>   nunca existió (§13).
> - **Enmienda 2 — se retira la agrupación "Por hito" (§5, §6, §7, §10–§14).**
>   El camino se agrupa de **una sola** manera, por meta, en el Camino y en el
>   Mapa; el hito deja de ser un modo de ver y pasa a ser una **marca con cuenta
>   regresiva** (§5.3); entra la banda **"Qué toca ahora"** (§5.2). Los carriles
>   del Mapa son las **metas** (§7). Está escrita contra código ya implementado
>   pero **no mergeado**: parte de §5–§7 y §10–§12 hay que deshacerla.
>   Qué **no** se reabre: la eliminación de `momento` (§2), el edicto como hito
>   en la demo (§10) y la enmienda 1.
> - **Enmienda 3 — la app explica qué es un hito (§8.1), y la tira cubre el
>   caso "todos los hitos hechos" (§5.3).** Escrita contra la enmienda 2 ya
>   mergeada. No toca el modelo de datos: **cero columnas nuevas**. Qué **no**
>   se reabre: que el hito sea una acción con `es_hito` (§13), que la
>   agrupación sea una sola (§5.1) y el edicto como hito en la demo (§10).

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

### 2.1 El problema

`momento` (`idea` | `antes` | `el_dia` | `despues`) hacía dos trabajos a la vez:
era el carril con el que se agrupaba el camino y el tablero, y era el valor por
defecto de cuándo cae una acción sin fecha (`POR_DEFECTO` en `lib/metas.ts`:
`antes` = 8, `el_dia` = 0, `despues` = −2).

Pero el tiempo real ya vive en `inicioSemanas` (semanas respecto a la fecha de
la boda: positivo antes, cero el mismo día, negativo después). Con semanas
puestas, `momento` no dice nada nuevo: "después" **es** semanas negativas. Dos
datos que tienen que coincidir siempre acaban no coincidiendo, y la interfaz
muestra la contradicción: hoy se puede guardar una acción con `momento =
"despues"` e `inicioSemanas = 10`, y el camino la dibuja diez semanas **antes**
de la boda dentro del carril "Después".

### 2.2 La decisión

**`momento` se elimina.** No se reduce a dos valores: se borra la columna. Lo
único que aportaba y no es derivable es la distinción "esto está en el camino" /
"esto es una idea", y eso ya lo dice `inicioSemanas`:

| Estado | Cómo se reconoce |
|---|---|
| **Idea suelta** | `inicio_semanas IS NULL` |
| **En el camino** | `inicio_semanas` tiene un número |

Lo demás sale del número: antes de la boda es `> 0`, el mismo día es `= 0`,
después es `< 0`.

> **Enmienda 2.** Lo que sigue se escribió cuando "Por hito" todavía iba a ser
> una agrupación de pantalla. Esa agrupación ya **no existe** (§5.1); lo que
> este párrafo decide y sigue vigente es que `momento` se borra de una vez y no
> convive con nada.

Se rechaza la ruta por etapas que proponía añadir "Por hito" como tercera opción
conviviendo con `momento`. Conviviendo, cada pantalla tendría que seguir
manteniendo los cuatro carriles vivos, la contradicción de §2.1 seguiría ahí, y
lo que se probaría en la boda demo sería un híbrido que nadie va a enviar a
producción. La gradualidad que **sí** hace falta es de **despliegue**, no de
alcance: el código deja de usar la columna en un PR y la columna se borra en un
segundo paso (§3.1). Eso no es alcance que se arrastra, es el orden obligado
porque Drizzle selecciona todas las columnas.

### 2.3 Lo que se pierde a propósito

Desaparece el estado "esto va en el camino pero todavía no sé cuándo" (hoy:
`momento = "antes"` con `inicioSemanas` nulo, que el Gantt dibuja como barra
punteada en la semana 8 y la leyenda llama "Sin semanas puestas"). A cambio, al
poner algo en el camino **se escribe una semana** que la pareja ve y puede
cambiar, en vez de una suposición invisible. La barra punteada y su leyenda se
retiran.

### 2.4 El valor por defecto

`POR_DEFECTO` no desaparece sin más: se materializa una vez en el relleno de
datos (§3.1) y después se borra de `lib/metas.ts`. `inicioDe` deja de tener
respaldo: solo recibe acciones que ya tienen semana.

En su lugar, una función pura decide la semana **al escribir**, no al leer:

```
semanaPorDefecto({ hitoSemana, semanasHastaLaBoda, duracion }):
  hitoSemana !== null        → hitoSemana + duracion
  semanasHastaLaBoda !== null → max(1, semanasHastaLaBoda)
  si no                       → 8
```

- Anotar o soltar algo **dentro de una etapa** le da `hitoSemana + duracion`,
  así termina justo la semana anterior al hito y cae con seguridad en esa etapa
  (§6).
- Sin hitos, la semana por defecto es **cuántas semanas faltan para la boda**,
  mínimo 1. Ocho semanas fijas le ponían a una pareja que se casa en tres una
  acción con fecha ya pasada.
- Sin fecha de boda, 8: es el número que ya traía `POR_DEFECTO` y no hay nada
  mejor que suponer.

La semana se escribe en la fila, no se infiere al leer. Todo lo que está en el
camino tiene su número, y es editable.

## 3. Modelo de datos (Drizzle)

`metas` — sin cambios.
- `id` uuid PK, `boda_id` text (orgId de Clerk), `titulo` text, `orden` int,
  `creada_el` timestamptz. Índice `(boda_id, orden)` e **índice único
  `(boda_id, titulo)`**: no hay dos metas con el mismo nombre en una boda, y dos
  personas que aplican la plantilla a la vez no la duplican.

`acciones` — sin columnas nuevas. Cambia el significado de dos y se va una:
- `inicio_semanas` int null — **ahora es el único campo que dice si una acción
  está en el camino**. Null = idea suelta.
- `orden` int — era "posición dentro de su carril". El carril ya no existe, así
  que queda como simple contador de llegada para desempatar. **No se usa para
  ordenar a mano**: nunca hubo reordenar dentro de un carril (`moverAccion` solo
  escribía `max(orden) + 1`), así que no se pierde nada.
- `momento` enum — **se borra**, junto con el tipo `momento` y el índice
  `acciones_boda_momento_idx`.
- `meta_id` uuid null → `metas.id` **on delete set null** (borrar la meta no
  borra sus acciones: quedan sueltas). Sin cambios.
- `es_hito` boolean default false — un **hito** es un momento, no un periodo (la
  ceremonia civil). En el Gantt se dibuja como **rombo**, no como barra. Sin
  cambios en la columna. **No agrupa ninguna pantalla** (enmienda 2): es una
  marca con cuenta regresiva (§5.3) y el corte interno que mide "cuánto falta
  antes de él" (§6).

Todo derivado, nada guardado dos veces:
- **Avance** de la meta = acciones hechas / total.
- **Rango** = desde el inicio más temprano hasta el fin más tardío de sus acciones.
- **Monto** = suma de los montos de sus acciones (incluye lo que vino de Bernie).
- **Etapa** de una acción = el hito que la cierra (§6). No es una columna y
  **no se ve en pantalla**: solo alimenta el "te faltan N cosas antes" de §5.3.

**La enmienda 2 no toca el modelo de datos: cero columnas nuevas.** El único
riesgo de migración sigue siendo el de §3.1, que no cambia.

### 3.1 Nota de despliegue (tres pasos, en este orden)

> ⚠️ Drizzle selecciona todas las columnas de `acciones`. Borrar `momento` antes
> de que el código deje de pedirla rompe producción; y borrar la columna sin
> rellenar `inicio_semanas` convierte en ideas sueltas todo lo que estaba en el
> camino sin semanas puestas. Por eso el orden importa.

1. **Relleno, antes de mergear.** `POR_DEFECTO` se ejecuta una sola vez contra
   Neon:
   ```sql
   UPDATE acciones
      SET inicio_semanas = CASE momento
            WHEN 'antes'   THEN 8
            WHEN 'el_dia'  THEN 0
            WHEN 'despues' THEN -2
          END
    WHERE inicio_semanas IS NULL
      AND momento <> 'idea';
   ```
   Después de esto, "idea" e `inicio_semanas IS NULL` significan lo mismo en
   todas las filas existentes. Es idempotente y solo agrega información.

   **1b. Renombrado de los títulos de plantilla (misma autorización, mismo
   paso).** Las bodas que ya aplicaron la plantilla tienen los títulos en
   infinitivo. Se renombran a sustantivo (§4.1), saltando la fila si esa boda ya
   tiene otra acción con el título nuevo — `acciones` no tiene índice único por
   título, así que la colisión no la atrapa la base:
   ```sql
   UPDATE acciones a
      SET titulo = m.nuevo
     FROM (VALUES
            ('publicar el edicto matrimonial',          'Edicto matrimonial'),
            ('presentar el expediente en la municipalidad',
                                                        'Expediente en la municipalidad'),
            ('recoger el acta de matrimonio',           'Acta de matrimonio')
          ) AS m(viejo, nuevo)
    WHERE lower(unaccent(a.titulo)) = m.viejo
      AND NOT EXISTS (
            SELECT 1 FROM acciones b
             WHERE b.boda_id = a.boda_id
               AND b.id <> a.id
               AND lower(unaccent(b.titulo)) = lower(unaccent(m.nuevo)));
   ```
   Es cosmético, no obligatorio: el reconocimiento de alias de §4.1 ya evita el
   duplicado aunque este renombrado no se ejecute nunca. Si `unaccent` no está
   disponible en Neon, los tres títulos no llevan tildes y basta con `lower()`.
   **Pregunta abierta nº 6** para el arquitecto.
2. **Merge del código.** Nadie escribe ni lee `momento`. La columna sigue
   existiendo con su `NOT NULL DEFAULT 'idea'`, así que los `INSERT` que la
   omiten siguen siendo válidos y un despliegue anterior que vuelva a entrar en
   servicio no se cae.
3. **Limpieza, después de verificar en producción.** `DROP COLUMN momento`,
   `DROP TYPE momento`, borrar `acciones_boda_momento_idx` y crear
   `acciones_boda_orden_idx (boda_id, orden)`. Toda consulta filtra por boda; sin
   un índice que empiece por `boda_id` se escanea la tabla entera.

El `README.md` menciona el índice `(boda_id, momento, orden)`: hay que
actualizarlo en el paso 3. Está fuera de `docs/`, lo hace quien implemente.

## 4. Plantilla "Registro civil" (Perú)

Botón **"Empezar con Registro civil"** cuando la boda aún no tiene esa meta. Crea la
meta y estas acciones, con dependencias y semanas típicas (todo editable después).
Si ya existe una acción con el mismo título —o con uno de sus títulos antiguos
(§4.1)—, comparado sin mayúsculas ni tildes, la reutiliza y le asigna la meta
en vez de duplicarla; si esa acción no tenía
semanas, toma las de la plantilla. Lo que la pareja ya había decidido se
respeta. Todo va en un solo batch.

| Acción | Semanas antes | Dura | Requiere | Hito |
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

La plantilla ya no calcula ningún carril: `momentoDe` se borra. La condición
"esa acción no tenía fecha" pasa de `momento === "idea" || inicioSemanas ===
null` a solo `inicioSemanas === null`.

Con esta plantilla la boda queda con **una** meta ("Registro civil") y **un**
hito, la ceremonia civil, que es el que verá la pareja en la tira con su cuenta
regresiva (§5.3).

> **Enmienda 3.** Ese único hito **se queda y es deliberadamente uno solo**: es
> la forma de enseñar el concepto sin texto. La pareja aplica la plantilla, ve
> la tira "Ceremonia civil · faltan 12 semanas · te faltan 8 cosas antes", y
> entiende qué hace un hito antes de leer ninguna explicación. Dos hitos en la
> plantilla difuminarían cuál es el día que importa; cero hitos dejaría la tira
> vacía justo cuando la pareja acaba de poblar su boda. **No se marca ningún
> hito más**: ni el expediente ni el edicto ni el acta (el por qué, en §8.1).

### 4.1 Títulos en sustantivo, y el alias de los viejos

> **Enmienda 2.** Esta sección se queda entera, con menos motivo pero con
> motivo. Los títulos de etapa desaparecen de la pantalla (§5), pero el nombre
> del hito **sigue saliendo solo** en la tira del próximo hito (§5.3), y ahí un
> verbo también se lee mal: "Publicar el edicto matrimonial · faltan 2 semanas"
> frente a "Edicto matrimonial · faltan 2 semanas". El renombrado de datos
> (§3.1 paso 1b) sigue siendo **opcional**; los alias, obligatorios.

El nombre del hito se lee solo, como etiqueta, así que un hito en infinitivo se
lee mal: en pantalla se vio **"Hasta Publicar el edicto matrimonial"** y
**"Después de Publicar el edicto matrimonial"**. El problema no es el artículo
que falta, es el verbo. Con un sustantivo la frase se lee como etiqueta.

Por eso **toda acción de la plantilla que pueda llegar a ser hito se nombra con
un sustantivo**. Cambian tres títulos; el resto ya lo eran:

| Antes | Ahora | Por qué |
|---|---|---|
| Publicar el edicto matrimonial | **Edicto matrimonial** | Es hito en la demo (§10). |
| Presentar el expediente en la municipalidad | **Expediente en la municipalidad** | Checkpoint real: el expediente admitido. |
| Recoger el acta de matrimonio | **Acta de matrimonio** | Cierra el trámite; candidato natural a hito. |

"Ceremonia civil" **no cambia**: ya es un sustantivo, y la variante de la demo
("Ceremonia civil en la municipalidad") también. "Elegir a los dos testigos"
tampoco: es una tarea, no un checkpoint, y forzarla a sustantivo la empeoraría.
Los certificados y las partidas ya son sustantivos.

**El riesgo de duplicado y qué se hace.** La plantilla reutiliza una acción
existente comparando el título normalizado (minúsculas, sin tildes). Si el
título cambia, una boda que ya aplicó la plantilla guarda el nombre viejo, no
coincidiría con el nuevo y la segunda aplicación **crearía un edicto
duplicado**. El índice único es `(boda_id, titulo)` en `metas`, no en
`acciones`: la base no atraparía ese duplicado.

La decisión:

1. **La plantilla reconoce también los títulos viejos.** Cada paso lleva, además
   de su título, una lista `alias` con los títulos anteriores. La comparación
   busca por el título nuevo **o** por cualquiera de sus alias, siempre
   normalizados. Si encuentra uno, lo reutiliza como hasta ahora: le asigna la
   meta y, si no tenía semanas, las de la plantilla. Esta es la garantía
   duradera: funciona aunque nunca se toquen los datos.
2. **La acción reutilizada conserva su título.** La plantilla **no** renombra
   filas existentes: el título es de la pareja y puede haberlo editado. Una boda
   vieja sigue viendo "Publicar el edicto matrimonial" hasta que la pareja lo
   cambie o se ejecute el renombrado de datos.
3. **Renombrado en Neon, opcional y autorizado por el dueño**, como paso **1b**
   de §3.1, para que las bodas ya existentes no se queden con el infinitivo en
   el título de su etapa.

La lista de alias se queda en el código indefinidamente: borrarla reabre el
duplicado para cualquier boda que no se haya renombrado.

## 5. Camino (Gantt): una sola agrupación

**No hay selector.** El Camino agrupa **por meta** y nada más. Se retira
"Por meta | Por hito", el parámetro `?por=` y la rama de agrupación por etapa.

- Barra resumen por meta con nombre y avance ("3 de 8 hechas"), debajo sus
  acciones en **orden de dependencia**, y al final el grupo **"Sin meta"**.
- **Flechas** de dependencia, **cadena principal** resaltada, **choques** en
  rojo, **"lista para empezar"** y **hito como rombo**: igual que hoy.
- Las ideas sueltas siguen fuera del Gantt, en **"Todavía sin sitio"**.
- En pantallas angostas, scroll horizontal y columna de nombres fija.
- Si la URL trae `?por=hito` (enlace viejo o marcador), se **ignora**: se
  muestra el Camino por meta. Sin redirección y sin aviso.
- Boda sin ninguna meta: un solo grupo, sin barra resumen, con la invitación
  *"Agrupa lo que va junto: crea una meta."* y, si la boda no tiene "Registro
  civil", el botón de la plantilla (§4).

### 5.1 Por qué se retira "Por hito"

El dueño del producto, que conoce el trámite y escribió esta app, preguntó en
qué se diferencia una meta de un hito y, tras dos explicaciones, respondió que
no le quedaba claro. Una pareja de 25 a 35 años, sola frente a la pantalla y sin
nadie que se lo explique, no va a distinguirlos mejor.

El argumento no es "cuesta explicarlo": es que **la segunda agrupación no
responde ninguna pregunta nueva**. Son las mismas acciones reordenadas. La meta
es un concepto que la pareja ya trae puesto — "el papeleo", "la fiesta", "la
luna de miel" — y no hay que enseñárselo.

La única pregunta que parecía propia de "Por hito" es *"¿llego al edicto a
tiempo?"*, y es una pregunta **transversal a las metas**. Se responde mejor sin
reagrupar nada: el eje del Gantt ya coloca cada barra en su semana y el rombo
del hito está dibujado ahí mismo, así que lo que falta antes del rombo **se ve**;
y la tira de §5.3 lo dice con palabras. Partir la pantalla en dos modos para
contestar eso es caro y, encima, deja la pregunta a medias: lo que de verdad la
contestaría es el aviso "esto no llega al hito", que sigue fuera de alcance
(§13) y que no necesita una agrupación nueva para existir.

Que "Por hito" ya esté construido, probado y validado en pantalla **no es un
motivo para conservarlo**: ese costo ya está pagado y no se recupera
manteniéndolo. Nada está mergeado; retirarlo cuesta una pasada del arquitecto.

### 5.2 Qué toca ahora (lo nuevo, y lo único nuevo)

Hay una pregunta que ni "Por meta" ni "Por hito" contestaban y es la que una
pareja abre la app para resolver un lunes por la noche: **¿qué toca ahora?** Un
Gantt es para quien planifica; un tablero, para quien ordena. Nadie respondía a
quien ejecuta, aunque la lógica ya está en `lib/metas.ts`.

Entra una **banda "Qué toca ahora"** en lo más alto del Mapa, antes de todo lo
demás. **No es una pantalla nueva**: es un bloque de la pantalla que ya existe y
que ya es la portada de la boda (`/mi-boda`).

- Muestra **hasta 5** acciones, una debajo de otra: título, su meta en letra
  pequeña, responsable y, si la boda tiene fecha, cuándo tocaba o toca
  ("esta semana", "la semana que viene", "hace 2 semanas").
- Cada línea lleva el mismo círculo de estado que la tarjeta, para marcarla
  hecha sin salir de la banda, y abre el formulario al tocar el título.
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
cual — si lo hiciera, una boda recién empezada, sin ninguna dependencia, tendría
la banda vacía. Son dos funciones distintas y las dos se quedan.

Sin fecha de boda la banda funciona igual: el orden es el mismo y se omite la
columna de "cuándo tocaba".

### 5.3 El hito, como marca y no como modo

La mitad del hito que sí se entiende sola es ser una **marca con cuenta
regresiva**. Se queda en tres sitios y en ninguno más:

1. **La tira del próximo hito**, una línea sobria debajo de la banda "Qué toca
   ahora" en el Mapa y arriba del todo en el Camino:
   > **Ceremonia civil** · faltan 8 semanas · te faltan 3 cosas antes
   - El **próximo hito** es el que está en el camino, no `hecho`, con la semana
     más alta (el más temprano). Si no hay ninguno, lo que se dibuja depende de
     por qué no hay: ver §5.3.1.
   - "Faltan N semanas" = `semanasHastaLaBoda − semanaDelHito`. Si sale ≤ 0,
     dice **"es esta semana"**; si la boda no tiene fecha, se sustituye por
     "N semanas antes de la boda" (o "el día de la boda" / "N semanas después").
   - "Te faltan N cosas antes" = las acciones **no hechas de su etapa** (§6).
     Si son 0: *"ya está todo listo"*.
2. El **rombo** en el Gantt, como hoy.
3. La **insignia de hito** en la tarjeta y la casilla "Es un hito" del
   formulario, como hoy.

La palabra "etapa" **nunca** aparece en pantalla, y tampoco los títulos
"Hasta …" / "Después de …": son internos (§6).

### 5.3.1 Cuando no hay próximo hito (enmienda 3)

**El defecto.** Marcar un hito como `hecho` lo saca de `proximoHito`, que es
correcto, pero hoy el Mapa interpreta "no hay próximo hito" como "esta pareja
nunca marcó uno" y vuelve a mostrar *"Marca lo importante como hito y verás
cuánto falta."* La pareja que ya se casó lee una invitación a hacer lo que ya
hizo. Son **tres situaciones distintas** y hasta ahora compartían un mensaje.

Lo que se dibuja, según el caso:

| Situación | Qué se dibuja | Dónde |
|---|---|---|
| Hay un hito en el camino sin hacer | La tira normal: rombo, nombre, cuenta regresiva, cuántas cosas faltan antes | Mapa y Camino |
| Hay hitos en el camino y **todos** están `hecho` | La **tira de cierre** (abajo) | Mapa y Camino |
| La boda no tiene **ninguna** acción con `es_hito` | La invitación de §8.1 | Solo Mapa |
| Hay acciones con `es_hito` pero **ninguna en el camino** (todas son ideas sueltas) | *"Ponle una semana a tu hito y verás cuánto falta."* | Solo Mapa |

**La tira de cierre.** Misma forma que la tira normal para que se lea como la
misma cosa, con un **check** en lugar del rombo y el nombre del **último hito
hecho**:

> ✓ **Ceremonia civil** · hecho · no queda ningún hito por delante

- El **último hito hecho** es el que está en el camino, `hecho`, con la semana
  **más baja** (el más tardío en el tiempo, porque las semanas se cuentan hacia
  atrás). Desempata por orden de meta y luego por título, igual que
  `proximoHito`. Función pura nueva: `ultimoHitoHecho(acciones, metas)`.
- **No cuenta nada más.** Nada de "te quedan N cosas sin hacer": eso sería un
  aviso de retraso, que sigue fuera de alcance (§13). Si quedan pendientes de
  esa etapa, salen donde ya salían, en "Qué toca ahora".
- Si dos hitos empatan en la semana más baja, se nombran unidos por " y " con
  `nombreDeHitos`, como ya hace la tira normal (§6.1).
- El verbo es **"hecho"** y no "cumplido" ni "logrado": es la misma palabra del
  estado `hecho` que la pareja ya toca en el círculo de la tarjeta.

**Quién decide el caso.** La tabla entera es una función pura,
`estadoDeHitos(acciones, metas)`, que devuelve uno de cuatro:
`{ tipo: "proximo", hito }`, `{ tipo: "cierre", hito }`, `{ tipo: "sin-semana" }`
o `{ tipo: "ninguno" }`. Compone `proximoHito` y `ultimoHitoHecho`, que se
quedan como están y siguen usándose por separado. Se hace así y no con tres
condiciones dentro de `tira-hito.tsx` porque la distinción entre "ninguno" y
"sin-semana" es la que el componente se equivocaría en reproducir, y porque es
lo que se prueba de una vez (§11).

La cuarta situación (hitos que son ideas sueltas) es un callejón real: la pareja
marcó la casilla, no vio nada y no tiene cómo saber que falta la semana. Se
resuelve con una frase, no con un aviso: la invitación cambia de texto, no de
sitio ni de estilo. Se descarta mostrarla también en el Camino: ahí el hito sin
semana no está dibujado y la frase no tendría a qué referirse.

### 5.4 Antes / El día / Después no se pierden

Siguen siendo la lectura natural del eje, ancladas en la **fecha de la boda**
(semana 0), que es donde `inicioSemanas` ya está anclado:

- **Antes** = `inicioSemanas > 0`
- **El día** = `inicioSemanas = 0`
- **Después** = `inicioSemanas < 0`

Se ancla en la semana 0 y **no** en el hito de la ceremonia civil: la pareja
puede borrar ese hito, renombrarlo o ponerlo en la semana 2, y entonces "el día"
significaría dos cosas distintas en la misma pantalla. El eje del Gantt ya marca
la semana 0 como "la boda" y eso no cambia. Es también el control "Cuándo" del
formulario (§8), que es donde la pareja escribe el signo sin verlo.

### 5.5 El nombre que ve la pareja

Con la enmienda 2 ya no hay ningún grupo que nombrar: los del Camino y los
carriles del Mapa se llaman **como la meta que la pareja escribió**. "Fase",
"etapa", "tramo" y "hito como modo de ver" desaparecen de la interfaz. La
palabra **hito** se queda solo en la casilla del formulario ("Es un hito") y en
la insignia de la tarjeta, que es donde ya estaba y donde se entiende por el
sitio: algo que se marca, no una manera de ordenar la pantalla.

## 6. Etapas: definición exacta (cálculo interno, nunca pantalla)

**Qué queda de las etapas tras la enmienda 2.** `etapas()` **sobrevive**, pero
deja de ser una agrupación de pantalla: ya no titula grupos del Camino ni
carriles del Mapa. Su único trabajo es contestar *"¿cuántas cosas faltan antes
del próximo hito?"* en la tira de §5.3 — las acciones no hechas de la etapa de
ese hito. Por eso la definición se queda tal cual: es exactamente la cuenta que
hace falta, y usar `finDe` (lo que hay que **terminar** antes del hito) es lo
correcto también para esto.

Lo que se retira de `lib/metas.ts`: **`carriles()`** (existía solo para que el
Mapa tuviera un tramo final vacío donde soltar) y **`TITULO_TODO`** /
**`PISTA_SIN_HITOS`**, que eran textos de pantalla. `CLAVE_TODO` se queda si
`etapas()` lo sigue necesitando para su grupo único; no se muestra.

Todo en `lib/metas.ts`, puro.

Una acción ocupa las semanas `[finDe(a), inicioDe(a)]`, donde `finDe = inicio −
duracion + 1`. Como las semanas se cuentan hacia atrás, **más tarde en el tiempo
es un número más chico**: `finDe` es su final.

**Los hitos que delimitan** son las acciones con `es_hito` **que están en el
camino** (`inicioSemanas` no nulo). Sus semanas, ordenadas de mayor a menor, son
los cortes.

**La etapa de una acción A** es el hito más temprano que la sigue en el tiempo:

> etapa(A) = `max { h ∈ hitos : h ≤ finDe(A) }`

Si ese conjunto está vacío (no hay ningún hito igual o posterior al final de A),
A va al grupo final "Después de …".

Se usa `finDe` y no `inicioDe` a propósito: la etapa de algo es **aquella en la
que hay que terminarlo**. Una acción que empieza antes de un hito pero acaba
después cae en la etapa siguiente, que es la verdad incómoda que hay que ver.

### 6.1 Casos borde

| Caso | Qué pasa |
|---|---|
| **Acciones posteriores al último hito** | Grupo final **"Después de <último hito>"**. Con la plantilla, "Acta de matrimonio" cae aquí. |
| **Acciones anteriores al primer hito** | No es caso borde: caen en la etapa del primer hito. Todo lo anterior en el tiempo tiene ese hito por delante. |
| **Boda sin ningún hito** | `etapas()` devuelve un solo grupo con todo; nadie lo dibuja. En pantalla no hay tira (§5.3) y el Mapa invita una vez: *"Marca lo importante como hito y verás cuánto falta."* |
| **Boda sin fecha** | Las etapas funcionan igual: las semanas son relativas y no necesitan calendario. Solo faltan las fechas de día en el eje, como ya pasa hoy. |
| **Hitos de varias metas mezclados en el tiempo** | Las etapas se ordenan por semana, no por meta. Como no se dibujan, lo único visible es que el próximo hito puede ser de otra meta que la que estás mirando: es correcto. |
| **Dos hitos en la misma semana** | Una sola etapa, y la tira nombra los dos unidos por " y " en orden de meta y, a igualdad, por título ("Edicto matrimonial y Ceremonia civil · faltan 2 semanas"). |
| **El próximo hito ya está `hecho`** | No es el próximo: la tira salta al siguiente hito no hecho. Si no queda ninguno, no hay tira. |
| **Un hito `hecho` con cosas sin hacer en su etapa** | La tira ya no lo nombra; esas cosas siguen apareciendo en "Qué toca ahora" si están desbloqueadas. No se inventa ningún aviso de retraso (§13). |
| **Un hito que es idea suelta** | No corta nada: no tiene semana. Queda en "Todavía sin sitio" como cualquier idea. Marcar algo como hito no lo pone en el camino. |
| **Un hito con duración > 1** | Un hito no dura: `duracionDe` ya lo fuerza a 1 y la etapa se corta en su semana. |
| **Dos acciones con la misma semana** | Desempatan por dependencia y, a igualdad, por título, como ya hace `ordenPorDependencia`. |
| **Todos los hitos del camino están `hecho`** (enmienda 3) | Tira de cierre con el último hito hecho (§5.3.1). Ya no se muestra la invitación. |
| **El único hito está `hecho` y es idea suelta** (enmienda 3) | `estadoDeHitos` da `"sin-semana"`, así que el Mapa dice *"Ponle una semana a tu hito y verás cuánto falta."* Es raro y es inofensivo: un hito sin semana no pasó por ninguna parte del camino, y se prefiere eso a abrir un quinto mensaje. |

## 7. Mapa (el tablero): los carriles son las metas

**Esta es la decisión que desbloquea todo lo demás.** Si el camino deja de
agruparse por etapa, el Mapa se queda sin eje: los carriles arrastraban por
`momento`, que se va (§2), y las etapas se retiran (§5.1). El eje es la **meta**.

- La portada del Mapa, de arriba abajo: **1)** banda "Qué toca ahora" (§5.2),
  **2)** tira del próximo hito (§5.3), **3)** los carriles de meta, **4)** la
  bandeja "Ideas sueltas", **5)** el Reparto (lo que muestra y la línea del
  desbalance, en `docs/pagos.md`).
- **El Reparto y la bandeja de ideas bajan**. Hoy van encima de los carriles y
  empujan el primer carril a `y = 807` en un celular de 375 px: la estructura
  del tablero no se ve de un vistazo. Un carril vacío mide 140 px (168 con
  título de dos líneas), o sea que **caben cuatro en una pantalla de 812 px,
  cinco no**: lo que vaya arriba hay que ganárselo. Arriba va lo que se mira a diario; el
  Reparto es una foto del equipo y las ideas son el cajón de lo que no tiene
  cuándo.
- **Un carril por meta**, en el orden de `metas.orden`, con el **título que la
  pareja escribió**. Al final, el carril **"Sin meta"**. Si la boda no tiene
  ninguna meta, ese carril único se titula **"Todo lo anotado"** y lleva la
  invitación *"Agrupa lo que va junto: crea una meta."*
- Un carril de meta muestra, bajo su título: `N · S/ monto` y el avance
  ("3 de 8 hechas"), que ya calcula `resumenMeta`. Un carril vacío dice
  *"arrastra aquí lo que sea de esta meta"*.
- Los carriles se **apilan**, con sus tarjetas en una rejilla que envuelve.
- Dentro de un carril, las tarjetas van **por semana** (lo más temprano primero)
  y, a igualdad, por título. Las acciones de esa meta que son **ideas sueltas**
  no salen en su carril: están en la bandeja. El carril es "lo de esta meta que
  ya tiene cuándo".
- **Arrastrar escribe la meta**, que es la pregunta que de verdad se contesta
  moviendo una tarjeta ("esto es de la fiesta, no del papeleo"):
  - a un carril de meta → `meta_id` = esa meta;
  - al carril "Sin meta" → `meta_id = null`;
  - a **"Ideas sueltas"** → `inicio_semanas = null`, **conservando la meta**,
    las dependencias, el monto, los pagos y el responsable;
  - **desde** "Ideas sueltas" a un carril → además de la meta, se escribe
    `inicio_semanas = semanaPorDefecto({ hitoSemana: null, semanasHastaLaBoda,
    duracion })` (§2.4). Es el único arrastre que toca la semana.
- Mover entre carriles de meta **nunca** cambia la semana. La semana se edita
  en el formulario, con su control "Cuándo" (§8), donde es un número que se lee
  y se corrige — no un cubo al que se tira algo.
- Arrastrar nunca cambia duración, estado ni responsable.
- El menú "Mover a …" de la tarjeta ofrece las mismas metas, "Sin meta" e
  "Ideas sueltas", y hace exactamente lo mismo. En el celular es la vía
  principal.
- La acción de servidor: `moverAccion(id, destino)` con
  `destino = metaId | "sin-meta" | "ideas-sueltas"`. El servidor resuelve qué
  columnas escribe según la regla de arriba. `ponerEnSemana(id, semanas | null)`
  se queda para el formulario.

### 7.1 Por qué la meta y no otra cosa

- **Es el mismo agrupador que el Camino.** Una sola manera de partir el trabajo
  en toda la app. Dos pantallas, un modelo mental: el tablero es para mover y
  marcar, el Camino para ver cuándo. Eso es justo lo contrario de lo que hacía
  "Por hito".
- **Los carriles no aparecen ni desaparecen solos.** Una meta la crea y la borra
  la pareja; existe aunque esté vacía. Desaparece el defecto del carril final
  que se esfumaba al vaciarse y dejaba de ser destino alcanzable, y con él la
  necesidad de `carriles()` (la variante de `etapas()` que fabricaba un tramo
  final vacío solo para que hubiera dónde soltar). **`carriles()` se borra.**
- **El id del carril es el id de la meta**: estable entre renders, sin depender
  de la semana del hito. Cierra la pregunta §14.5.
- **El optimismo es trivial**: cambiar `meta_id` en el cliente no recalcula
  cortes de tiempo, así que la tarjeta no puede saltar dos veces. Cierra §14.7.
- **El número de carriles lo decide la pareja** y cada uno lleva su nombre. Con
  la plantilla son dos ("Registro civil" y "Sin meta"); en la demo, tres. Si una
  pareja llega a diez, son diez cosas que ella misma nombró, no diez tramos que
  le apareció el sistema.
- Se descartan: **por estado** (Por hacer / Haciendo / Hecho) porque el estado
  ya se cambia con un toque en el círculo de la tarjeta y un carril "Hecho"
  convierte la portada en un archivo; **por responsable**, porque en una boda de
  dos personas son dos carriles y una discusión; **por tramo de tiempo**
  ("Ahora / Pronto / Más adelante"), porque soltar una tarjeta en un cubo
  reescribiría la semana con un número inventado y porque "ahora" ya lo contesta
  la banda de §5.2 sin pedirle a nadie que arrastre nada.

## 8. Formulario de acción

- Campo **Meta** ("+ Nueva meta…"): sin cambios.
- Casilla **"Es un hito"**: el interruptor y su etiqueta no cambian, pero deja
  de estar sola. Gana la ayuda de **§8.1** (enmienda 3).
- Las semanas ya no sacan el signo del carril. El formulario gana un control
  **"Cuándo"** de tres opciones — **Antes · El día · Después** — junto al número
  de semanas:
  - la opción se **deriva del signo de `inicioSemanas`** al abrir (sin semanas,
    ninguna marcada) y **no se guarda en ninguna parte**: solo sirve para
    teclear el número en positivo, que es como habla la gente ("un mes después",
    no "−4");
  - al guardar: *Antes* → `+semanas`, *El día* → `0`, *Después* → `−semanas`.
- Dejar las semanas vacías guarda `inicioSemanas = null`: la acción es una idea
  suelta. El formulario lo dice en una línea: *"Sin semanas, queda en ideas
  sueltas."*
- Al anotar desde un carril de meta del Mapa, llega **prellenada la meta** y el
  número de semanas **prellenado** con `semanaPorDefecto({ hitoSemana: null,
  semanasHastaLaBoda, duracion })`, con su opción ya marcada. Desde el carril
  "Sin meta" llega sin meta. Desde el botón **Anotar** del celular y desde la
  bandeja de ideas llega vacío (idea suelta), como hoy.
- El campo "Cuándo" + semanas es **el único sitio donde se escribe la semana a
  mano**: tras la enmienda 2, arrastrar ya no la cambia salvo al sacar algo de
  ideas sueltas (§7).
- Lo demás igual: el diálogo nunca supera la pantalla, las acciones de servidor
  devuelven `{ error }` en vez de lanzar, y si guardar falla después de crear
  una meta nueva, esa meta se borra.

### 8.1 La ayuda del hito (enmienda 3)

**El problema.** Hoy el formulario tiene un interruptor que dice "Es un hito" y
nada más: ni qué es, ni qué pasa al encenderlo. El dueño del producto, que
conoce el trámite, no distinguía meta de hito hasta que se lo explicaron con una
tabla; una pareja de 25 a 35 años que nunca gestionó un proyecto tiene menos
contexto, no más. "Hito" es la única palabra del producto que **no** viene
puesta: "meta", "acción", "camino" y "mapa" se entienden solas (§5.1); esta no.

**La pregunta que contesta la ayuda** y que ninguna pantalla contesta: *"¿esto
que estoy anotando es un hito, y qué me cambia marcarlo?"*. Se contesta en el
único sitio donde se decide, el formulario. No hay pantalla nueva, ni página de
ayuda, ni recorrido guiado.

**Tres piezas, y ninguna más:**

1. **Un disparador siempre visible, junto a la etiqueta.** Un icono `Info` de
   3.5 (`size-3.5`) inmediatamente después de "Es un hito", con
   `aria-label="Qué es un hito"`, que abre un **Popover** de shadcn. Popover y
   no Tooltip: un tooltip no tiene ruta táctil y la puerta de calidad la exige.
   El disparador va **fuera** del `<label>`: dentro, tocarlo cambiaría el
   interruptor.
2. **El contenido del popover.** Define, da ejemplos, da contraejemplos y dice
   las consecuencias. Texto literal, en este orden:
   > **Un hito es un día, no un trabajo.**
   >
   > El caso claro es la ceremonia civil: un día concreto que parte tu boda en
   > antes y después.
   >
   > No son hitos las cosas que te toman tiempo: juntar las partidas, esperar el
   > certificado médico, elegir a los testigos. Esas duran, y por eso llevan
   > semanas.
   >
   > Si lo marcas:
   > - aparece arriba con su cuenta regresiva;
   > - en el camino se dibuja como un rombo;
   > - desaparece "Cuántas dura", porque un hito no dura.
3. **Una línea bajo la fila de interruptores, solo cuando está encendido.**
   Quien enciende sin leer nada también se lleva la consecuencia:
   *"Un hito no dura: marca el día. Lo verás arriba con su cuenta regresiva."*
   Se oculta al apagarlo. Es la misma pieza que ya hace *"Sin semanas, queda en
   ideas sueltas."*, y se escribe igual (`text-muted-foreground text-xs`).

**Y la invitación del Mapa cambia de texto** (§5.3, §5.3.1). Era *"Marca lo
importante como hito y verás cuánto falta."*; pasa a nombrar el ejemplo, porque
es el primer sitio donde la pareja se encuentra la palabra:

> **"Marca como hito el día que más importa, tu ceremonia civil, y verás cuánto
> falta."**

Lleva la palabra, su significado y un caso concreto en una frase. `INVITA_HITO`
cambia de valor, no de nombre ni de sitio.

#### Qué es hito de verdad en el trámite peruano, y qué no

| Acción de la plantilla | ¿Hito? | Por qué |
|---|---|---|
| **Ceremonia civil** | **Sí**, y viene marcada (§4) | Día fijado por la municipalidad o la notaría. No dura. Parte la boda en antes y después. Es el hito de libro. |
| **Expediente en la municipalidad** | Es un punto de paso real, pero **no viene marcado** | El día en que la municipalidad admite el expediente sí decide: hasta que no está admitido no hay aviso. Pero armarlo y presentarlo toma días, y nadie planifica una boda contando semanas hacia ese día. Queda como acción con duración; la pareja puede marcarlo si quiere. |
| **Edicto matrimonial** | **No**, y es el que más se confunde | El aviso del matrimonio proyectado se fija **ocho días** en la municipalidad o notaría (Código Civil, art. 250) y en ese plazo cabe la oposición de quien tenga interés legítimo (art. 253): es una **espera**, no un día. Marcarlo como hito le fuerza la duración a 1 y le quita justo la espera, que es lo que hace esperar. |
| **Acta de matrimonio** | **No** | Es recoger un papel, después del día que importa. Cierra el trámite pero no condiciona nada. |
| Partidas, copia del DNI, certificado domiciliario, certificado médico prenupcial, elegir a los testigos | **No** | Son trabajos con duración, cada uno con su propia cola de espera. |

**El edicto en la demo no se reabre** (§10): allí sigue marcado como hito para
que la tira tenga algo que contar antes de la semana 0, y tiene defensa propia
—el día en que el aviso sale publicado sí es un día— pero **la plantilla no lo
marca** y la ayuda lo usa como contraejemplo. Es la única discrepancia
deliberada entre la demo y la plantilla, y está aquí escrita para que nadie la
"arregle" en la dirección contraria.

**Contexto verificado que no entra en la plantilla:** la Ley 31643 (diciembre de
2022) habilitó a los notarios a celebrar el matrimonio civil y permitió publicar
el aviso por medios digitales; y, vencido el plazo sin oposición, la autoridad
declara la capacidad de los contrayentes y el matrimonio puede celebrarse dentro
de **cuatro meses** (art. 258). "Capacidad declarada" sería un hito impecable y
aquí no se usa: nadie en una pareja llama así a nada. La plantilla sigue con
"Ceremonia civil" como único hito.

> **Supuesto marcado.** Las semanas de la plantilla (§4) siguen siendo
> estimaciones de calendario real, no plazos de ley: la ley fija ocho días de
> aviso, no las dos semanas que la plantilla da al edicto. Esas dos semanas
> cubren el trámite más la cola de la municipalidad, y la pareja las edita.

## 9. Integración con Bernie

Sin cambios en el contrato. La subcategoría de Bernie sigue sugiriendo la
**acción**; al asignar un gasto, su pago suma a la acción y, por derivación, al
monto de su meta.

Un detalle sí cambia: `crearAccionConGasto` creaba la acción con `momento:
"antes"` y sin semanas, o sea una barra punteada supuesta. Ahora nace con
`inicioSemanas = semanaPorDefecto` (sin hito de referencia) y estado `haciendo`.
Un gasto que ya existe no es una idea suelta: está pasando.

## 10. Demo

La boda demo usa la plantilla: sus trámites quedan en la meta "Registro civil"
(la ceremonia como hito) y "Almuerzo con la familia" con el restaurante en una
meta "Almuerzo". `lib/demo.ts` deja de escribir `momento` y de contar el orden
por carril.

La demo marca **también "Edicto matrimonial" como hito** (semana 6). El dueño
lo confirmó y se queda, aunque el motivo cambia: ya no es "para que se vea la
agrupación por hito" sino para que la **tira del próximo hito** (§5.3) tenga
algo que contar antes de la ceremonia — con un solo hito en la semana 0, la
tira diría siempre lo mismo. La semilla usa los títulos en sustantivo de §4.1.
Es además fiel al trámite: el edicto publicado es el permiso para casarse, un
checkpoint real.

Con dos metas ("Registro civil" y "Almuerzo") más el carril "Sin meta", la demo
muestra **tres carriles** en el Mapa, que es lo que hay que poder mirar en un
celular.

Las dos ideas sueltas de la demo ("Video corto", "Mesa de dulces") se quedan sin
semanas.

## 11. Pruebas

`node:test` sobre funciones puras en `lib/metas.ts`. Lo que ya existe sigue
(orden de dependencia, cadena principal, "lista para empezar", avance y rango de
la meta, plantilla que no duplica por título). Se quita `momentoDe` y, con la
enmienda 2, **las pruebas de `carriles()`** (la función se borra); las de
`etapas()` se quedan todas, porque la función se queda.

Se agrega para la enmienda 2:

- **`queTocaAhora`**: excluye ideas sueltas y lo `hecho`; excluye lo bloqueado
  por un requisito sin hacer; **incluye** lo que no tiene ningún requisito (la
  diferencia con `listasParaEmpezar`, y por eso hay una prueba que las compara
  en una boda sin dependencias);
- `queTocaAhora` ordena por semana descendente, luego `haciendo` antes de
  `por_hacer`, luego por título, y respeta el límite;
- un requisito que apunta a una acción que ya no existe **no bloquea**;
- **`proximoHito`**: el hito en el camino, no hecho, con la semana más alta;
  null si no hay ninguno; ignora los hitos que son idea suelta; salta el hito
  ya hecho;
- **cuántas cosas faltan antes del próximo hito**: las acciones no hechas de su
  etapa **sin contar el hito mismo** — la frase dice "te faltan N cosas
  **antes**";
- la cuenta regresiva: `semanasHastaLaBoda − semanaDelHito`, con ≤ 0 → "es esta
  semana", y sin fecha de boda no hay cuenta.

Se agrega para la **enmienda 3**, todo sobre `lib/metas.ts`:

- **`ultimoHitoHecho`**: devuelve el hito en el camino, `hecho`, con la semana
  **más baja**; null si no hay ninguno hecho; **ignora** los hitos que son idea
  suelta; **ignora** los hitos sin hacer (no es "el último que toqué", es "el
  último que pasó").
- `proximoHito` y `ultimoHitoHecho` sobre la misma lista: con un hito pendiente
  y otro hecho, el primero devuelve el pendiente y el segundo el hecho, y la
  pantalla dibuja la tira normal (§5.3.1).
- **Todos los hitos hechos**: `proximoHito` null y `ultimoHitoHecho` no null, que
  es la condición exacta de la tira de cierre.
- **Dos hitos hechos empatados en la semana más baja**: `nombreDeHitos` los une
  con " y ", en orden de meta y luego por título.
- **Ningún hito en toda la boda**: las dos funciones devuelven null (condición
  de la invitación).
- **Hitos que existen pero todos son ideas sueltas**: las dos funciones
  devuelven null.
- **`estadoDeHitos`**: los cuatro `tipo` de §5.3.1, uno por prueba, incluida la
  diferencia entre `"ninguno"` y `"sin-semana"`, que es la que el componente no
  debe reproducir a mano. Un hito hecho que es idea suelta no da `"cierre"`.

Y del plan original se mantiene:

- **etapas**: una acción cae en el hito más temprano que la sigue;
- una acción que **cruza** un hito cae en la etapa siguiente (se usa `finDe`);
- un hito pertenece a **su propia** etapa y se ordena **al final** de ella;
- acciones posteriores al último hito van al **grupo final**, y ese grupo no
  aparece si no hay ninguna;
- **sin hitos**: un solo grupo con todo lo que tiene semanas;
- **dos hitos en la misma semana**: una sola etapa, con los dos hitos y sin
  etapa vacía;
- un hito **sin semanas** no corta el camino;
- las ideas sueltas (`inicioSemanas === null`) **no** aparecen en ninguna etapa;
- **plantilla con alias**: una boda que ya tiene "Publicar el edicto
  matrimonial" no gana una segunda acción al aplicar la plantilla con el título
  nuevo; la existente conserva su título y recibe la meta;
- `semanaPorDefecto`: con hito, sin hito y con fecha, sin hito y sin fecha, y el
  mínimo de 1 semana;
- `inicioDe` / `finDe` / `resumenMeta` / `cadenaPrincipal` filtran por
  `inicioSemanas === null` y no por `momento`.

`lib/historia.test.ts` deja de construir acciones con `momento` y el collar sin
metas filtra por `inicioSemanas !== null`.

## 12. Orden de implementación

1. Relleno en Neon (§3.1 paso 1) y renombrado de títulos (paso 1b), con tu OK.
2. `lib/metas.ts`: borrar `POR_DEFECTO` y `momentoDe`, `inicioDe` sin respaldo,
   `etapas`, `semanaPorDefecto`, y cambiar los filtros de idea. Tests.
3. `lib/historia.ts` y su test.
4. Esquema y tipos: quitar `momento` del modelo Drizzle y de `AccionCamino`,
   `Momento`, `DESTINOS`.
5. Acciones de servidor: `moverAccion` → `ponerEnSemana`, `crearAccion` y
   `editarAccion` sin `momento`, `orden` sin carril, plantilla (títulos en
   sustantivo y alias de §4.1) y Bernie.
6. Formulario: control "Cuándo" y semana prellenada.
7. Mapa: carriles por meta, arrastre que escribe la meta, menú "Mover a …",
   y el nuevo orden de la portada (banda, tira, carriles, ideas, Reparto).
8. Camino: una sola agrupación por meta; fuera el selector y `?por=`.
9. Banda "Qué toca ahora" y tira del próximo hito.
10. Demo (con el edicto como hito).
11. PR → merge → verificación en producción → limpieza del esquema (§3.1 paso 3)
    y del `README.md`.

### 12.1 Lo que hay que deshacer (enmienda 2, sobre código ya escrito)

Nada de esto está mergeado; es una pasada, no un revert en producción.

1. `lib/metas.ts`: borrar **`carriles()`** y sus pruebas. **Conservar
   `etapas()`**, `Etapa`, `CLAVE_TODO` y toda su batería de pruebas: ahora
   sirven a §5.3.
2. `lib/metas.ts`: añadir **`queTocaAhora`**, **`proximoHito`** y la cuenta de
   lo que falta antes de un hito, con sus pruebas (§11).
3. `app/mi-boda/_acciones/camino.tsx`: quitar el selector, el tipo `Agrupar`,
   la rama de agrupación por etapa y los títulos "Hasta …"/"Después de …".
   Queda solo la agrupación por meta, que ya existía y no se toca.
4. `app/mi-boda/camino/page.tsx`: quitar `searchParams.por` y la elección de
   agrupación por defecto.
5. `app/mi-boda/_acciones/mapa.tsx`: los carriles pasan de `carriles(...)` a las
   metas; `semanaDe` se reduce al caso "sale de ideas sueltas"; `etapaDe` pasa a
   ser "en qué meta está"; el nuevo orden vertical de la portada.
6. `app/mi-boda/_acciones/tipos.ts`: fuera **`PISTA_SIN_HITOS`**; el comentario
   de `IDEAS` y de `Destino` deja de hablar de etapas (ahora los destinos son
   metas y su id es el de la meta).
7. Acciones de servidor: `moverAccion(id, destino)` según §7; `ponerEnSemana`
   se queda para el formulario.
8. `lib/demo.ts`: sin cambios respecto a lo ya planeado (§10).

**De los 11 defectos de UX que está arreglando el arquitecto, dejan de aplicar
los que son del carril por etapa** (el tramo final que desaparece al vaciarse,
los títulos de carril, el pie `pieDe`, la pista sin hitos). Todo lo que es del
componente `Carril` en sí —el anillo en todos los carriles al levantar, el
opacado del origen, los anuncios de lector de pantalla, el interior de la
tarjeta— **se conserva tal cual**: el componente sigue, solo cambia la lista
que se le pasa.

### 12.2 Orden de implementación de la enmienda 3

Independiente de todo lo anterior y sin tocar la base de datos:

1. `lib/metas.ts`: `ultimoHitoHecho` y `estadoDeHitos`, con sus pruebas (§11).
2. `app/mi-boda/_acciones/tira-hito.tsx`: consumir `estadoDeHitos` y dibujar los
   cuatro casos (tira normal, tira de cierre con `Check`, invitación,
   "Ponle una semana…"). `app/mi-boda/_acciones/tipos.ts`: nuevo valor de
   `INVITA_HITO` y la constante del cuarto mensaje.
3. `app/mi-boda/_acciones/formulario-accion.tsx`: el `Popover`, su disparador
   `Info` y la línea bajo la fila de interruptores (§8.1).

Validación: la tira en sus **cuatro** estados, en móvil (375×812) y escritorio,
claro y oscuro; y el popover abierto con toque, con teclado y con lector de
pantalla, comprobando que no desborda el diálogo del formulario a 375 px.

## 13. Qué queda fuera

- **Una tabla `hitos` aparte.** Un hito sigue siendo una acción con `es_hito`.
  Separarlos rompería la regla del producto: una sola entidad para todo.
- **Guardar la etapa en una columna.** Es derivada. Guardarla repetiría el error
  que este cambio viene a corregir.
- **Fechas absolutas por acción.** El tiempo sigue en semanas relativas a la
  boda: mover la boda mueve todo con ella, que es lo que pasa de verdad.
- **Duraciones en días**, y etapas con inicio y fin propios.
- **Reordenar a mano** dentro de un carril o de un grupo. Nunca funcionó y el
  orden por tiempo es mejor.
- **Editar dependencias arrastrando** en el Mapa.
- **Validar o avisar si un hito se escribe en infinitivo.** La pareja nombra sus
  acciones como quiera; solo se arreglan los nombres que trae la plantilla.
- **El contrato de Bernie.** Intacto.

Lo que añade la **enmienda 2**:

- **Cualquier segunda agrupación**: por hito, por responsable, por estado, por
  tramo de tiempo. Una sola, la meta, en las dos pantallas. Si alguna vez se
  reabre, que sea con una pregunta de una pareja que ninguna pantalla conteste,
  no con un reordenamiento de los mismos datos.
- **"Qué toca ahora" como pantalla propia**, con su ruta, su entrada en la
  barra de abajo y su historial. Hoy es un bloque del Mapa. Si se usa, se
  promueve en otra spec.
- **Más de 5 líneas en la banda**, filtros, "posponer", marcar "en esto estoy
  hoy", o un orden a mano. La banda **no** es una lista de tareas editable: es
  un recordatorio de lo que ya está en el camino.
- **Recordatorios por correo o notificación** de lo que toca esta semana.
- **Un aviso de retraso** ("esto no llega al hito", "esta semana ya pasó y no
  está hecho"). Hay un `atrasado` implícito en que la banda ordene por semana
  descendente, pero **no se pinta en rojo ni se cuenta**. Es otra spec, y la
  más probable después de esta.
- **Varios hitos a la vez en la tira.** Solo el próximo. Una lista de hitos es
  un calendario y ya hay uno.
- **Barra resumen por etapa** en el Gantt: no hay etapas en el Gantt.
- **Un botón de anotar en el Camino.** El Camino se mira; para anotar está el
  Mapa, con su botón por carril de meta (§7, §8), y el botón flotante del
  celular.
- **Juntar el Mapa y el Camino** o renombrar las vistas.

Lo que añade la **enmienda 3**:

- **Renombrar "hito".** Se evaluó "fecha clave", "día señalado" y "momento".
  "Momento" ya está ocupado por otra cosa en la historia del producto, y las
  otras dos obligan a traducir el vocabulario en cinco sitios para ganar poco:
  el problema no era la palabra, era que no venía explicada. La palabra se
  queda y se explica (§8.1).
- **Una pantalla o página de ayuda**, un recorrido guiado, un tour de bienvenida
  o un "¿sabías que…?". La ayuda vive donde se decide: al lado del interruptor.
- **Explicar también "meta", "acción" o "dependencia"** con el mismo popover.
  Esas tres se entienden por el sitio donde están (§5.1). Si alguna resulta no
  entenderse, se arregla cuando se vea, no por simetría.
- **Marcar más hitos en la plantilla.** Uno, la ceremonia civil (§4).
- **Sugerir o validar hitos** ("esto parece un hito, ¿lo marcas?"). La pareja
  decide; la app no adivina.
- **Contar lo que quedó sin hacer en la tira de cierre.** Sería un aviso de
  retraso, que sigue fuera (arriba, enmienda 2).
- **Una tira por cada hito pasado**, o un historial de hitos cumplidos. La tira
  de cierre nombra uno: el último.
- **Celebrar el cierre** con confeti, insignia o cambio de color. La tira de
  cierre es una línea sobria como las otras tres. Si se quiere celebrar, eso es
  materia de `docs/compartir.md`.

## 14. Preguntas abiertas para el arquitecto

1. **El relleno (§3.1 paso 1)**: ¿SQL a mano en Neon, o un script versionado?
   `drizzle-kit push` no lleva datos. ¿Y conviene dejarlo escrito en el repo para
   que quede constancia de qué valores se supusieron?
2. **El paso 3 del despliegue**: ¿se puede hacer en el mismo `push` que el resto
   si se verifica primero, o hace falta un PR aparte? ¿Vale la pena conservar el
   tipo `momento` en Postgres por si hay que volver atrás, o se borra entero?
3. **Tipos**: ¿conviene un tipo `AccionEnCamino` con `inicioSemanas: number`
   (distinto de `AccionCamino`) para que `inicioDe` no pueda recibir una idea y
   el compilador atrape el caso, o basta con filtrar antes de llamar?
4. **`orden`**: queda casi vestigial. ¿Se mantiene como contador de llegada con
   índice `(boda_id, orden)`, o se cambia el orden de `datos.ts` (hoy `momento,
   orden, creadaEl`) por `(inicio_semanas DESC NULLS LAST, creada_el)` con su
   propio índice?
5. ~~**dnd-kit con un número variable de carriles**~~: **cerrada por la
   enmienda 2.** El id del `useDroppable` es el id de la meta, que no cambia
   nunca. Queda el resto: ¿qué hace el Mapa si una boda llega a quince metas,
   se colapsan los carriles vacíos o se deja crecer? Hoy: se deja crecer.
6. **El renombrado 1b**: ¿`unaccent` está habilitado en Neon, o se hace con
   `lower()` a secas? ¿Se versiona junto al script del paso 1?
7. ~~**Optimismo en el Mapa**~~: **cerrada por la enmienda 2.** El optimista
   cambia `metaId`, que no recalcula ningún corte de tiempo; no hay segundo
   salto. El único arrastre que escribe dos columnas es el que saca algo de
   ideas sueltas, y se aplica en el mismo `aplicar`.
8. **`moverAccion(id, destino)` con destino polimórfico** (`metaId` |
   `"sin-meta"` | `"ideas-sueltas"`): ¿se prefiere una sola acción de servidor
   que resuelve el destino, o dos (`asignarMeta` y `ponerEnSemana`) que el
   cliente encadena? Lo segundo son dos viajes y dos revalidaciones por
   arrastre; lo primero mete una rama en el servidor. Decide quien implemente.
9. **El carril "Sin meta"**: ¿necesita su propio id reservado (`"sin-meta"`) o
   basta con la cadena vacía? Y en una boda sin ninguna meta, ¿se dibuja el
   carril único con título "Todo lo anotado" (§7) desde el cliente, o conviene
   que el servidor mande ya la lista de carriles resuelta?
10. **Dónde vive la banda "Qué toca ahora"**: el Mapa es un componente cliente
    con `useOptimistic`. ¿La banda se calcula dentro de él para que marcar algo
    hecho la actualice al instante, o es un componente servidor aparte que
    revalida? Lo primero la mantiene viva; lo segundo la mantiene simple.
11. **Rendimiento**: la banda, la tira y los carriles recorren la misma lista
    tres veces por render. ¿Importa con 60 acciones? Probablemente no; dicho
    por si acaso.
12. **El popover dentro del diálogo** (enmienda 3): el formulario de acción es
    un `Dialog` de shadcn, y el popover abre dentro. ¿Hace falta ajustar
    `modal`, el `z-index` o el foco para que cerrar el popover con `Esc` no
    cierre también el diálogo? Es el riesgo técnico de §8.1 y no sé evaluarlo.
13. **El disparador de la ayuda** (enmienda 3): se pide un icono `Info` con
    `aria-label`. ¿Es suficientemente visible a 375 px, o conviene texto
    ("¿qué es?") aunque alargue la fila de tres interruptores? Si el validador
    mide que el icono queda por debajo del área de toque de 44 px, manda la
    medición y se pasa a texto.
14. **`estadoDeHitos` y el optimismo del Mapa** (enmienda 3): marcar hecho el
    último hito pendiente cambia el estado de la tira de "proximo" a "cierre".
    Con la tira dentro del componente cliente eso es instantáneo; fuera, espera
    la revalidación. Es la misma decisión de la pregunta 10 y conviene que las
    dos se resuelvan igual.
