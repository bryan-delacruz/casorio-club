# El orden de las cosas: armar y editar dependencias

> **Spec (SDD).** Este documento manda sobre el código de las dependencias
> entre acciones: cómo se arman, dónde se editan y qué se rechaza. Si algo
> cambia, primero se actualiza aquí.
>
> **Estado:** aprobada e implementada.
>
> Depende de `docs/metas.md` (§3 el modelo de datos, §5 el Camino, §7 el Mapa,
> §8 el formulario, §11.3 el orden derivado de las metas). No repite lo que ese
> documento decide. Reemplaza dos renglones de su §14: "editar dependencias" ya
> no queda fuera, y el Camino ya no es solo de lectura.

## 1. La pregunta de producto

Una pareja no abre la app para declarar un grafo. Abre para contestar dos
preguntas, y las dos son de orden:

- **"¿Puedo hacer esto ya, o falta algo antes?"**
- **"Si esto se atrasa, ¿qué se atrasa conmigo?"**

La primera ya se contesta: ✨ "lista para empezar", la banda "Qué toca ahora" y
la línea "↳ requiere …". La segunda **no se contesta en ninguna pantalla**, y es
la que justifica esta spec.

El dato que las contesta existe desde el principio (`dependencias`), pero
**armarlo es el cuello de botella**. Hoy se arma en un solo sitio: menú ⋯ →
Cambiar → al fondo del diálogo, una lista plana de casillas con todas las demás
acciones de la boda. Tres defectos medidos contra el uso real:

| Defecto | Consecuencia |
| --- | --- |
| Está al fondo de un formulario de otra cosa | Se arma al crear, nunca al revisar |
| La lista es plana y sin contexto | Con 24 acciones del plan no se distingue "Reservar local" de "Reservar fotógrafo" por meta ni por semana |
| Solo se dice "qué va antes de esto" | Para decir "esto va antes de aquello" hay que abrir *aquello*, que es justo la acción que no tienes en la cabeza |
| El Camino, que es donde el orden **se ve**, no se puede tocar | Ves la flecha que falta y no hay nada que pulsar |

## 2. Alcance

**Entra:**

1. Un diálogo propio para el orden, con las **dos direcciones**.
2. Lista **agrupada por meta**, con la **semana** de cada acción, y buscador.
3. Las que harían círculo se muestran **deshabilitadas y con el motivo**, no se
   esconden.
4. El diálogo se abre **desde el Mapa y desde el Camino**.
5. El Camino gana un **menú ⋯ por fila** con lo que ya existe: Cambiar, Pagos,
   Estado, Borrar, y el orden.
6. Una sola escritura: `guardarDependenciasDe(accionId, antes, despues)`, con un
   único rechazo de círculo sobre el grafo resultante.
7. Se **retira** la lista de casillas del formulario de acción.
8. **Manipulación directa en el gráfico**: el bloque se arrastra por la línea
   del tiempo (§10) y se une a otro tirando una flecha desde su asa (§10.1),
   que se deshace pulsando la flecha.

**No entra** (§11).

## 3. Vocabulario de pantalla

Una sola forma por concepto, en las dos pantallas. Nada de "dependencia",
"precedencia", "predecesora" ni "sucesora" en pantalla: son jerga, y la pareja
no las lee en ningún otro sitio.

| Sitio | Texto exacto |
| --- | --- |
| Opción del menú ⋯ | `Qué va antes` |
| Título del diálogo | `Antes y después de esto` |
| Descripción del diálogo | `Dos listas: lo que tiene que estar listo antes, y lo que espera a que esto esté.` |
| Lista 1 | `Qué tiene que estar listo antes` |
| Lista 2 | `Qué espera a que esto esté` |
| Línea en tarjeta y Camino | `↳ requiere …` (ya existe, `REQUIERE` en `tipos.ts`) |
| Vaciar una lista | `Quitar {n}` |
| Buscador | `Buscar entre las demás` |
| Lista sin resultados | `Ninguna se llama así.` |
| Motivo de una deshabilitada, lista 1 | `Esta ya te espera a ti.` |
| Motivo de una deshabilitada, lista 2 | `A esta la esperas tú.` |
| Semana de una candidata | `12 sem` · `la boda` · `+2` · `sin semana` |
| Al guardar | `Guardado.` |
| Nada que elegir | `Anota algo más y podrás poner el orden.` |

"Antes" y "después" son **lógicos, no de calendario**: una acción puede ir
"antes" en el orden y tener una semana más tardía. Eso **no se corrige ni se
avisa aquí**; el choque ya se pinta en rojo en el Camino (`docs/metas.md` §5), y
ese aviso es suficiente.

## 4. El diálogo

- Un `Dialog` de shadcn, controlado desde fuera, como `EditarAccion` y
  `PagosAccion`: lo abre un menú, y un diálogo dentro de un menú se desmonta al
  cerrarse el menú.
- **Cabecera**: el título y la descripción de §3, y debajo el título de la
  acción, truncado.
- **Dos listas**, una debajo de otra, con la misma forma: etiqueta, contador
  "Quitar {n}" cuando hay algo marcado, buscador cuando hay más de 6
  candidatas, y la lista con scroll a `max-h-40`.
- **Un solo botón Guardar** para las dos listas: es una sola escritura.
- El diálogo **nunca supera la pantalla**: los mismos `DIALOGO` y `PIE` que el
  formulario de acción.
- **Boda con una sola acción**: las dos listas quedan vacías y el diálogo
  muestra la línea de §3 en vez de dos cajas vacías. El botón Guardar no
  aparece.

### 4.1 Cada candidata

Una fila por acción, con casilla:

```
[x] Sacar el certificado médico        Registro civil · 10 sem
```

- La **casilla** marca o desmarca. La fila entera es el `label`.
- El **título** se trunca; el `title` del elemento trae el completo.
- A la derecha, la **semana** (§3). Sin semana, `sin semana`: la idea suelta
  también puede ir antes o después de algo.
- Las de la **misma meta** no llevan el nombre de la meta repetido: lo lleva la
  cabecera del grupo.
- Una candidata **deshabilitada** se dibuja atenuada, con la casilla
  deshabilitada y el motivo de §3 en `title` y como texto cuando cabe. No se
  esconde: quien la busca tiene que entender por qué no puede.

### 4.2 El orden de la lista

1. Por **meta**, en el orden derivado de `ordenarMetas` (`docs/metas.md` §11.3),
   el mismo que los carriles del Mapa y los grupos del Camino.
2. "Sin meta" al final, con ese nombre.
3. Dentro de cada grupo, por **semana** de la más lejana a la boda a la más
   cercana, y a igualdad por título. Es el mismo criterio de `porFecha` en
   `lib/metas.ts`.
4. Las ideas sueltas, al final de su grupo.

Las marcadas **no se suben arriba**. Reordenar al marcar mueve la fila bajo el
dedo y hace perder el sitio en una lista de 24.

## 5. Las dos direcciones, exactas

Con las filas de `dependencias` leídas como la arista
`accionId` **requiere** `requiereId`:

| Lista | Qué significa marcar `X` | Fila que se escribe |
| --- | --- | --- |
| `antes` | Esta acción requiere a `X` | `(accionId: esta, requiereId: X)` |
| `despues` | `X` requiere a esta acción | `(accionId: X, requiereId: esta)` |

Guardar deja las dos **exactamente** en lo elegido: se borran todas las filas de
esta acción en los dos sentidos y se escriben las nuevas. Igual que hoy en un
sentido, y por la misma razón: se elige todo de golpe y se manda una sola vez.

## 6. El círculo

Un círculo deja dos acciones esperándose para siempre, así que se rechaza.

- **En el cliente**, antes de poder equivocarse: una candidata que haría círculo
  llega deshabilitada (§4.1). Para la lista `antes`, las acciones que ya
  requieren a esta, directa o por cadena. Para la lista `despues`, las que esta
  ya requiere, directa o por cadena.
- **En el servidor**, porque la acción es un POST abierto: se arma el conjunto
  resultante de aristas y se rechaza si tiene cualquier ciclo, no solo uno que
  pase por esta acción. Editar las dos direcciones a la vez puede cerrar un
  círculo entre **otras dos** acciones, y la comprobación que hoy sale de esta
  acción hacia atrás no lo vería.
- Mensaje al usuario: `Ese orden se muerde la cola. Revisa lo que marcaste.` Y
  **nada se guarda**: con una sola escritura ya no hay "lo demás quedó
  guardado", que era el aviso del formulario y no se entendía.

## 7. Lógica pura: `lib/dependencias.ts`

Todo cálculo va aquí, probado con `node:test`. Nada de esto entra en un
componente.

| Función | Qué contesta |
| --- | --- |
| `requiereDe(requisitos)` | id → lo que requiere |
| `esperanA(requisitos)` | id → quién la requiere (el grafo al revés) |
| `alcanzaDesde(id, vecinos)` | todo lo que se alcanza, sin contar el punto de partida |
| `prohibidas(id, requisitos, lado)` | las que harían círculo en ese lado (§6) |
| `candidatas(id, acciones, requisitos, metas, lado)` | los grupos de §4.2, cada candidata con `prohibida` |
| `conNuevas(id, antes, despues, requisitos)` | el conjunto de aristas resultante (§5) |
| `tieneCiclo(requisitos)` | si un conjunto de aristas se muerde la cola |
| `semanaAlArrastrar(inicio, deltaX, ancho)` | dónde cae un bloque arrastrado (§10) |
| `unidasA(id, requisitos)` | con quién está unida, directo y en los dos sentidos (§10.2) |

- `alcanzaDesde` es iterativa, con pila y conjunto de vistos: una boda con 60
  acciones encadenadas desborda la recursión mucho antes que la memoria.
- `tieneCiclo` es el Kahn de `ordenPorDependencia` sin ordenar: queda algo
  pendiente y sin entrada libre ⇒ ciclo.
- `candidatas` **nunca** incluye la propia acción.

## 8. La escritura

```ts
guardarDependenciasDe(accionId: string, antes: string[], despues: string[])
agregarDependencia(accionId: string, requiereId: string)
quitarDependencia(accionId: string, requiereId: string)
ponerEnSemana(id: string, inicioSemanas: number | null)
```

Las dos del medio son de una sola arista, para el arrastre (§10.1). Las tres
primeras rechazan el círculo con el mismo `tieneCiclo` sobre el grafo
resultante. Todas devuelven `{ error }`.

- Reemplaza `guardarDependencias(accionId, requiere)`, que se retira con su
  único sitio de uso.
- Devuelve `{ error }` con mensaje para el usuario; no lanza
  (`CLAUDE.md`, lecturas y escrituras).
- Filtra por `boda_id` en **toda** consulta, y comprueba que las acciones
  nombradas —la propia y todas las elegidas, en los dos sentidos— son de esta
  boda. Un id de otra boda se descarta en silencio, como hoy.
- Ignora la propia acción si llega en cualquiera de las dos listas, y los
  duplicados.
- `revalidatePath("/mi-boda")`.
- **No** necesita columna nueva ni índice nuevo: la tabla `dependencias` y sus
  claves ya existen (`docs/metas.md` §3).

## 9. Dónde se abre

| Pantalla | Dónde | Qué más cambia |
| --- | --- | --- |
| Mapa | Menú ⋯ de la tarjeta, debajo de "Pagos" | La lista de casillas sale del formulario (§2.7) |
| Camino | Menú ⋯ nuevo al final de la fila | La fila gana el menú completo |

### 9.1 El menú ⋯ del Camino

El Camino dejaba de ser solo de lectura. El argumento viejo —"el Camino se
mira"— no aguanta: es la pantalla donde el orden **se ve**, con flechas, cadena
principal y choques en rojo, y mandaba a la otra pantalla a arreglar lo que aquí
se descubre.

- Un disparador ⋯ **al final de la columna de nombres**, no sobre la barra: la
  barra puede medir 36 px de ancho y en el celular queda fuera de la vista sin
  hacer scroll.
- Mismas opciones que la tarjeta del Mapa, en el mismo orden: `Cambiar`,
  `Pagos`, `Estado`, `Qué va antes`, `Borrar`. **Sin "Mover a"**: el carril es
  la meta, y la meta se cambia en Cambiar.
- `44 px` de área táctil, con pseudo-elemento si hace falta para no agrandar el
  dibujo, como el botón del plan.
- Visible siempre, no solo al pasar el ratón: en táctil no hay `hover`.
- No arranca ningún arrastre: `onPointerDown` detiene la propagación. Hoy la
  fila no arrastra, pero §10 la hará arrastrar.

## 10. Mover el bloque por la línea del tiempo

La lista y el diálogo contestan *qué va antes*. No contestan *cuándo*, y el
Camino es la pantalla donde el cuándo se ve: una barra fuera de sitio se
reconoce de un vistazo y hasta ahora había que ir al formulario y teclear un
número. El bloque se arrastra.

- Arrastre **horizontal** de la barra o del rombo, con `dnd-kit`.
- **Encaja en la columna de semana** mientras se arrastra, con un modificador
  propio (`porSemanas`): sin él parecería que algo puede quedar entre dos
  semanas, y la semana es la unidad.
- Escribe `inicio_semanas` con `ponerEnSemana`, que ya existía y ahora devuelve
  `{ error }` en vez de callarse.
- La aritmética vive en `semanaAlArrastrar` (`lib/dependencias.ts`), probada:
  el eje va de la semana más lejana a la izquierda hacia la boda a la derecha y
  `inicio_semanas` se cuenta hacia atrás, así que **arrastrar a la derecha
  resta semanas**. Es un signo que se invierte sin que se note.
- El ancho de columna **se mide en el DOM** (`gridTemplateColumns` del eje):
  `--col-semana` vale 36 px desde `sm` y 0 en el celular, donde las columnas se
  reparten el ancho con `1fr`. Con el valor fijo el arrastre encajaría en la
  semana equivocada justo en la pantalla más pequeña.
- Tope de **±260 semanas**, el mismo que aplica `ponerEnSemana`.
- **Optimista**: la barra se mueve antes de que el servidor conteste.
- Ruta **sin arrastre**, obligatoria: en el menú ⋯, bajo "Cuándo", `Una semana
  antes` / `Una semana después`. Solo en el Camino: en el Mapa la semana no
  está en pantalla y moverla a ciegas no diría nada. No aparece para una idea
  suelta, que no tiene semana que mover.
- **Solo con ratón** (`MouseSensor`), y la razón está medida: a 375 px una
  columna mide **16.75 px**, así que con el dedo no se puede apuntar a una
  semana. Peor: un arrastre táctil obligaría a `touch-action: none` en la
  barra, y entonces un deslizamiento que empiece encima de una barra no haría
  nada — ni la movería ni desplazaría el Gantt. En táctil la vía es el menú ⋯
  → "Cuándo", que además mueve exactamente una semana.
- La **duración no se estira** arrastrando el borde. Sigue en el formulario.
- Deja de ser verdad que el formulario es el único sitio donde se escribe la
  semana (`docs/metas.md` §8, ya corregido).

### 10.1 Unir dos bloques tirando una flecha

Armar el orden desde el gráfico, que es donde el orden se ve.

- Cada bloque lleva un **asa** en su **borde derecho**. La dependencia es
  fin-a-inicio, así que se tira desde donde esto **acaba** hasta donde
  **empieza** lo que lo espera: se lee de izquierda a derecha, en el mismo
  sentido que el eje.
- Soltar sobre otro bloque escribe `(accionId: el destino, requiereId: el
  origen)`. El destino pasa a esperar al origen.
- Mientras se tira, los demás bloques se **resaltan** como destinos posibles y
  el de debajo del cursor más fuerte; el origen se atenúa.
- Una sola arista, con `agregarDependencia(accionId, requiereId)`. **No**
  `guardarDependenciasDe`: mandar las dos listas completas borraría lo que el
  diálogo no estaba mirando.
- El círculo se rechaza igual, sobre el grafo resultante: *"Ese orden se muerde
  la cola: esa ya te espera a ti."* Soltar dos veces sobre el mismo bloque no
  es error (`onConflictDoNothing`: la clave primaria es el par).
- **Deshacer desde el gráfico**: la flecha se pulsa y se quita
  (`quitarDependencia`). Crear tirando una flecha y tener que abrir un diálogo
  para quitarla sería cojo. La flecha mide 1 px, así que debajo lleva un trazo
  transparente de 14 px que es el que recibe el clic, con `role="button"`,
  `aria-label` y Enter/Espacio.
- El lienzo SVG mantiene `pointer-events` apagado y lo enciende solo en cada
  flecha: si no, robaría los clics de las barras que tiene debajo.
- Las flechas son **optimistas**: aparecen y desaparecen antes de que el
  servidor conteste. Todo lo que se deriva de ellas —cadena principal, "lista
  para empezar", el orden de las metas— son funciones puras sobre la misma
  lista, así que las tres cosas se actualizan a la vez.
- Solo se dibujan flechas **dentro de un grupo**; una dependencia que cruza
  metas se nombra en texto ("↳ requiere …"). Por eso el asa **no** es la única
  vía: para unir con algo de otra meta está el diálogo.
- **Solo desde `sm`.** A 375 px una columna mide unos 16 px y el asa taparía la
  barra entera. En el celular la vía es el menú ⋯ → "Qué va antes". Esto es una
  limitación declarada, no un descuido: la ruta accesible y la táctil son la
  lista, y el asa es un atajo de ratón encima.

### 10.2 Con el dedo: elegir, y luego tocar

Arrastrar no sirve en el celular, y el menú ⋯ tampoco basta: es un formulario
disfrazado, no enseña el gráfico mientras decides. La vía táctil es **dos
toques**, y el segundo cae sobre una **fila entera**, que mide el ancho de la
pantalla: lo contrario de apuntar a una barra de 16.75 px.

| Paso | Qué se toca | Qué pasa |
| --- | --- | --- |
| 1 | El **nombre** de la fila | Queda elegido, resaltado en el gráfico, y sale la barra de abajo |
| 2a | `◀` / `▶` de la barra | Una semana exacta, y el bloque se mueve a la vista |
| 2b | `Unir con…` y luego una fila | Esa fila pasa a esperar a la elegida |
| 2c | `Quitar unión` y luego una fila | Suelta esa unión, apunte como apunte |

- El blanco del **primer** toque es el **nombre**, no la barra: en el celular
  el nombre ocupa su propia línea encima del Gantt, y la barra puede medir
  16.75 px.
- Mientras hay algo elegido, el botón **Anotar se aparta**: flota a 5rem del
  borde y asomaba 8 px por debajo de esta barra, lo que parecía un error de
  dibujo. Y elegir **trae el bloque a la vista**: la barra puede tapar justo
  la fila recién elegida, y entonces `◀` y `▶` mueven algo que no se ve.
- La barra de abajo se apoya **encima de la barra de secciones**
  (`bottom-[calc(4rem+env(safe-area-inset-bottom))]`) y va en `z-50`, por
  encima del `z-40` de esa barra y del botón Anotar: mientras algo está
  elegido, esto manda y tapa el botón Anotar a propósito.
- Botones de **44 px**, también la `✕`, que logra su área con un
  pseudo-elemento para no estirar la fila.
- Mientras la barra pide el segundo toque: las filas que **sí** valen llevan
  un marco de `ring-primary/70`, que se compone a 3.89:1 sobre el fondo
  oscuro. Al 50 % daba 2.64:1 —por debajo del 3:1 que pide un borde que
  transmite información— y en 1 px no se veía: el modo pedía tocar una fila y
  ninguna parecía tocable. Sigue siendo más tenue que los 2 px opacos de la
  elegida, así que la jerarquía se mantiene. Las que **no** valen se
  atenúan al 55 %, no al 40 %, donde su nombre caía a 3.9:1; los menús ⋯ y las flechas **no reciben clics** —pulsarlos
  contestaría otra pregunta— y `Cancelar` vuelve atrás.
- Los destinos de `Unir con…` excluyen los que harían círculo, con el mismo
  `prohibidas` de §6. Los de `Quitar unión` son las uniones **directas** en los
  dos sentidos, con `unidasA`: no hay ninguna flecha que soltar entre dos que
  solo se relacionan por una cadena.
- `Quitar unión` **no aparece** si la elegida no está unida a nada.
- **También en escritorio**, y no solo por debajo de `sm`: es la única vía para
  unir con algo de **otra meta**, porque el asa solo alcanza lo que tiene
  flecha dibujada y las flechas no cruzan grupos. Ahí flota centrada abajo.
- Teclado: el nombre es un `<button>` con `aria-pressed`, y cada fila-destino
  es un `role="button"` con `tabIndex` y Enter/Espacio.

## 11. Qué queda fuera

- **Arrastrar con el dedo**, el bloque o el asa. Queda fuera por el ancho de
  columna medido —16.75 px a 375 px— y no por principio (§10, §10.1). La vía
  táctil es §10.2, que además es exacta.
- **Elegir varios bloques a la vez** y moverlos juntos.
- **Deshacer** lo que la barra hace. Cada paso es una semana o una unión, y se
  repite al revés con el mismo gesto.
- **Estirar la duración** arrastrando el borde del bloque.
- **Arrastrar en vertical** para cambiar de meta. Eso es el Mapa.
- **Dependencias entre metas**, como dato propio. Se derivan (`docs/metas.md`
  §11.3) y eso no cambia.
- **Tipos de dependencia** (inicio-inicio, fin-fin, con holgura). Solo
  fin-a-inicio, como hoy.
- **Avisar que el orden lógico y las semanas no concuerdan** más de lo que ya
  avisa el choque rojo del Camino. Nada de recolocar semanas solo.
- **Mover la semana automáticamente** al armar una dependencia. Armar el orden
  no mueve nada de sitio: la pareja decide.
- **Reordenar a mano** dentro de un grupo. El orden se deriva de las
  dependencias (`docs/metas.md` §14) y ahora, además, se puede editar: es la
  misma respuesta por una vía mejor.
- **Anotar desde el Camino.** Se anota en el Mapa.
- **Deshacer.** Guardar es explícito y el diálogo se puede volver a abrir.
- **Una pantalla o un grafo del orden completo.** Las flechas del Camino ya lo
  dibujan.

## 12. Pruebas

En `lib/dependencias.test.ts`, con `node:test`:

1. `alcanzaDesde` no incluye el punto de partida.
2. `alcanzaDesde` atraviesa una cadena de tres y no se cuelga con un ciclo ya
   guardado.
3. `prohibidas` en `antes`: la que ya requiere a esta, directa.
4. `prohibidas` en `antes`: la que la requiere por una cadena de tres.
5. `prohibidas` en `despues`: la que esta ya requiere, directa y por cadena.
6. `prohibidas` nunca devuelve la propia acción como permitida ni como
   prohibida: no es candidata.
7. `candidatas` agrupa por meta en el orden dado y pone "Sin meta" al final.
8. `candidatas` ordena por semana descendente y, a igualdad, por título.
9. `candidatas` pone las ideas sueltas al final de su grupo.
10. `candidatas` marca `prohibida` donde `prohibidas` dice.
11. `conNuevas` borra las dos direcciones viejas de esa acción y deja el resto
    del grafo intacto.
12. `conNuevas` descarta la propia acción y los duplicados.
13. `tieneCiclo` es falso en un grafo vacío, en una cadena y en un diamante.
14. `tieneCiclo` es verdadero en un ciclo de dos y en uno de tres.
15. El caso que motiva §6: editar las dos listas a la vez cierra un círculo
    entre **otras dos** acciones y `tieneCiclo` lo atrapa.
16. `semanaAlArrastrar`: a la derecha resta, a la izquierda suma, encaja en la
    semana más cercana, no mueve por debajo de media columna, cruza la boda al
    otro lado, funciona con la columna estrecha del celular, topa en ±260, y
    sin ancho medido no divide por cero.
17. `unidasA`: recoge los dos sentidos, **no** recoge las indirectas ni las
    ajenas, y descarta la arista de una acción contra sí misma.

## 13. Puerta de calidad

Lo de `CLAUDE.md`, y además:

- El diálogo validado en **375×812 y en escritorio**, midiendo con JavaScript:
  no supera la pantalla, las dos listas tienen scroll propio y el botón Guardar
  queda a la vista.
- El menú ⋯ del Camino validado en las dos anchuras, con su área táctil medida.
- El arrastre del bloque validado con el ancho de columna real, que **no** es
  el de la variable CSS: 42.39 px a 1440, 36 px a 1024 y 16.75 px a 375, por
  el `1fr`. Un valor fijo habría encajado en la semana equivocada.
- El Gantt sigue desplazándose con el dedo, también empezando sobre una barra.
- El asa y la flecha pulsable validadas en escritorio; el asa **no** existe por
  debajo de `sm` y eso se comprueba, no se supone.
- La barra de §10.2 validada a 375 px: cabe sin desborde, se apoya encima de la
  barra de secciones, todos sus blancos miden 44 px, y los dos toques crean y
  sueltan una unión dejando el grafo como estaba.
- Estados cubiertos: boda con una sola acción, lista con más de 6 candidatas
  (buscador), búsqueda sin resultados, candidata deshabilitada visible con su
  motivo, y el rechazo del círculo desde el servidor.
- Sin errores de consola en el Mapa y el Camino.
