# El orden de las cosas: armar y editar dependencias

> **Spec (SDD).** Este documento manda sobre el código de las dependencias
> entre acciones: cómo se arman, dónde se editan y qué se rechaza. Si algo
> cambia, primero se actualiza aquí.
>
> **Estado:** §1–§9, aprobadas, pendientes de implementar. §10 (mover la barra
> en el Camino) es la segunda pasada y tiene su propio alcance.
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

- `alcanzaDesde` es iterativa, con pila y conjunto de vistos: una boda con 60
  acciones encadenadas desborda la recursión mucho antes que la memoria.
- `tieneCiclo` es el Kahn de `ordenPorDependencia` sin ordenar: queda algo
  pendiente y sin entrada libre ⇒ ciclo.
- `candidatas` **nunca** incluye la propia acción.

## 8. La escritura

```ts
guardarDependenciasDe(accionId: string, antes: string[], despues: string[])
```

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

## 10. Segunda pasada: mover la barra en el Camino

Alcance aparte, **no** en esta pasada. Se escribe aquí para que no se invente
dos veces:

- Arrastre **horizontal** de la barra con `dnd-kit`, encajando en la columna de
  semana, escribiendo `inicio_semanas` con `ponerEnSemana`.
- Ruta sin arrastre obligatoria, en el mismo menú ⋯: `Una semana antes` /
  `Una semana después`, y flechas del teclado sobre la barra enfocada.
- Deja de ser verdad que el formulario es el único sitio donde se escribe la
  semana (`docs/metas.md` §8). Ese renglón se corrige en esa pasada, no en esta.
- La duración **no** se estira arrastrando el borde. Sigue en el formulario.

## 11. Qué queda fuera

- **Arrastrar de una barra a otra para crear la dependencia.** Se evaluó y se
  descartó para esta pasada: a 375 px la columna de semana mide 36 px y apuntar
  a la barra de destino con el dedo no es fiable. La lista es la ruta principal
  y además es la accesible. Si se reabre, es encima de la lista, nunca en su
  lugar.
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

## 13. Puerta de calidad

Lo de `CLAUDE.md`, y además:

- El diálogo validado en **375×812 y en escritorio**, midiendo con JavaScript:
  no supera la pantalla, las dos listas tienen scroll propio y el botón Guardar
  queda a la vista.
- El menú ⋯ del Camino validado en las dos anchuras, con su área táctil medida.
- Estados cubiertos: boda con una sola acción, lista con más de 6 candidatas
  (buscador), búsqueda sin resultados, candidata deshabilitada visible con su
  motivo, y el rechazo del círculo desde el servidor.
- Sin errores de consola en el Mapa y el Camino.
