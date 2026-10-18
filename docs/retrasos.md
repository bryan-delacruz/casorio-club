# Lo que se pasó de su semana, y lo que no llega

> **Spec (SDD).** Este documento manda sobre el código del aviso de retraso.
> Si algo cambia, primero se actualiza aquí.
>
> **Estado:** aprobada e implementada.
>
> Depende de `docs/metas.md` (§2 el tiempo, §5.2 "Qué toca ahora"),
> `docs/fecha-de-la-boda.md` (de dónde sale "hoy") y `docs/dependencias.md`
> (el grafo que se recorre). Cierra el renglón de `docs/metas.md` §14 que
> dejaba esto fuera y lo llamaba "la más probable".

## 1. La pregunta de producto

Dos preguntas que ninguna pantalla contesta hoy:

- **"¿Voy tarde?"**
- **"¿Esto llega a tiempo a la boda?"**

La primera se puede deducir mirando: el Camino pinta la línea de "hoy" y cada
barra está en su semana. Pero deducirla es contar barras una por una, y nadie
abre la app para hacer eso.

La segunda **no se puede deducir mirando**, y es la que justifica esta spec. Si
el certificado médico se atrasa dos semanas, el expediente no puede empezar
cuando estaba previsto, y el edicto tampoco, y la ceremonia se va detrás. Esa
cuenta la hace un grafo, no un ojo.

## 2. Una sola cuenta, dos avisos

El error a evitar es tratarlas como dos cosas. **Son la misma cuenta**: dónde
cae de verdad cada cosa si se empieza hoy y se respetan las dependencias.

| Aviso | Qué es, en la misma cuenta |
| --- | --- |
| "Se pasó de su semana" | Su final real cae después de su final planeado |
| "No llega" | Su final real cae **después de la boda** |

Una sola función pura, `proyeccion`, y los dos avisos salen de leerla.

## 3. La cuenta, exacta

Recordatorio del signo (`docs/metas.md` §2): `inicioSemanas` cuenta **hacia
atrás** desde la boda. **Más grande es más temprano.** 12 = doce semanas antes,
0 = el día, −4 = cuatro después.

- `hoy` = `semanasHastaLaBoda(fecha)`. **Sin fecha de boda no hay aviso
  ninguno**: no hay con qué comparar. La proyección devuelve vacío.
- Se recorren las acciones **en orden de dependencia**
  (`ordenPorDependencia`), para que cuando se calcula una ya estén calculadas
  las que espera.
- Para cada acción **del camino** (las ideas sueltas no entran: no tienen
  semana):

| Caso | Regla |
| --- | --- |
| Está **hecha** | No se atrasa, y **no empuja** a las que la esperan |
| No está hecha | `inicioReal = min(inicioPlaneado, hoy)` — no se puede empezar en una semana que ya pasó |
| …y espera a algo no hecho | `inicioReal = min(inicioReal, finReal(requisito) − 1)` — empieza como pronto la semana siguiente a que acabe |

- `finReal = inicioReal − duracion + 1`, con `duracionDe` (un día clave dura 1).
- `atraso = finPlaneado − finReal`, en semanas. Positivo = tarde. Cero o
  negativo = a tiempo, y **no se avisa**.
- `noLlega = finReal < 0 && finPlaneado >= 0`. La segunda mitad importa: lo que
  la pareja planeó **a propósito** para después de la boda —cambiar el DNI, la
  luna de miel— no es un retraso.

**"Haciendo" cuenta como no hecha.** Se podría descontar lo que lleve avanzado,
pero la app no guarda cuánto, y descontarlo a ojo sería inventar. Que una cosa
empezada salga como "se pasó" es correcto: todavía no está.

### 3.1 El ciclo no cuelga la cuenta

La base rechaza el círculo (`docs/dependencias.md` §6), pero datos viejos
podrían traerlo. `ordenPorDependencia` ya deja al final lo que no pudo ordenar
en vez de colgarse; `proyeccion` hereda eso: a lo que llegue sin sus requisitos
calculados se le aplican solo las reglas que pueda. Nunca un bucle infinito.

## 4. Dónde se ve

### 4.1 Mapa: una línea en "Qué toca ahora"

Es la pantalla con la que se abre la app un lunes por la noche
(`docs/metas.md` §5.2), así que el aviso vive ahí, **encima** de la banda, como
una sola línea.

| Situación | Texto exacto |
| --- | --- |
| Nada tarde | *(no se dibuja nada)* |
| Algo se pasó | `2 cosas se pasaron de su semana.` |
| Una sola | `1 cosa se pasó de su semana.` |
| Algo no llega | `Si nada cambia, «Ceremonia civil» se pasa 2 semanas de la boda.` |
| Las dos | La de "no llega", que es la grave, y la cuenta de las otras detrás |

- "No llega" nombra **una** acción, la que más se pasa. Nombrar cinco sería una
  lista, y la banda no es una lista (`docs/metas.md` §14).
- **Una línea, nunca dos.** La banda ya tiene hasta cinco líneas suyas.

### 4.2 Camino: en la línea que ya existe

Cada fila tiene **una** línea secundaria bajo el nombre. Gana la más grave, y
**no se apilan**:

1. **Choque** (un requisito acaba después de que esto empieza) — rojo, ya existe.
2. **No llega** — rojo: `no llega: 2 semanas tarde`.
3. **Se pasó** — apagado: `2 semanas tarde`.
4. **Requiere algo de otra meta** — apagado, ya existe.

El `title` de la línea sigue llevando la lista completa de requisitos, así que
no se pierde información al ganar la más grave.

### 4.3 Nada de rojo donde no toca

El precedente es `desbalance` en el Reparto (`docs/pagos.md` §4.2): consejo
condicional, sin "debe", sin rojo y sin podio. **"Se pasó" sigue ese tono**: es
un hecho, no un reproche, y la pareja puede ignorarlo.

**"No llega" sí es rojo**, y por coherencia: el Camino ya pinta el choque en
rojo, y esto es la misma clase de problema — una cuenta que no cuadra — solo
que mirando a la boda en vez de a dos barras.

## 5. Lógica pura: `lib/retrasos.ts`

| Función | Qué contesta |
| --- | --- |
| `proyeccion(acciones, requisitos, hoy)` | id → `{ inicioReal, finReal, atraso, noLlega }`, solo de lo del camino y no hecho |
| `resumenRetraso(acciones, requisitos, hoy)` | `{ cuantas, peor }` para la línea del Mapa |

- `proyeccion` **no** incluye lo hecho ni las ideas sueltas: no tienen nada que
  contestar.
- Con `hoy === null` las dos devuelven vacío.
- `resumenRetraso.peor` es la acción con mayor `atraso` entre las que
  `noLlega`, o `null` si ninguna.

## 6. Qué queda fuera

- **Reprogramar solo.** Nada se mueve de semana sin que la pareja lo mueva. Es
  la misma regla que al cambiar la fecha de la boda
  (`docs/fecha-de-la-boda.md` §4.4): las semanas las puso ella a mano.
- **Proponer una fecha nueva** ("muévelo a la semana 8"). La proyección dice
  dónde cae; decidir es de la pareja.
- **Descontar lo avanzado** de lo que está "haciendo" (§3).
- **Recordatorios por correo o notificación.**
- **Una pantalla de retrasos**, con su ruta. Son dos líneas en pantallas que ya
  existen.
- **Avisar por meta** ("La recepción va tarde"). La meta no tiene fecha propia;
  su rango se deriva (`docs/metas.md` §11.3).
- **Días**, en vez de semanas. El tiempo sigue en semanas relativas.
- **Guardar el retraso en una columna.** Es derivado, como todo lo demás.
- **Contar los días clave aparte.** Un día clave es una acción y se atrasa igual.

## 7. Pruebas

En `lib/retrasos.test.ts`, con `node:test`:

1. Sin fecha de boda, `proyeccion` y `resumenRetraso` devuelven vacío.
2. Una acción cuya semana todavía no llegó no se atrasa.
3. Una acción cuyo inicio ya pasó se atrasa exactamente las semanas que pasaron.
4. Una acción **hecha** nunca se atrasa, aunque su semana haya pasado.
5. Una acción hecha **no empuja** a la que la espera.
6. Una acción no hecha empuja a la que la espera: el requisito acaba en 4, la
   siguiente empieza como pronto en 3.
7. El empuje se propaga por una cadena de tres.
8. `noLlega` es verdadero cuando el final real cae después de la boda.
9. `noLlega` es **falso** para lo que estaba planeado después de la boda a
   propósito.
10. Un día clave dura 1 semana en la cuenta.
11. Las ideas sueltas no entran en la proyección.
12. Un ciclo guardado no cuelga la cuenta.
13. `resumenRetraso` cuenta las atrasadas y elige como `peor` la que más se
    pasa entre las que no llegan.
14. `resumenRetraso.peor` es `null` cuando hay retraso pero todo llega.

## 8. Puerta de calidad

Lo de `CLAUDE.md`, y además:

- Las dos pantallas validadas en móvil y escritorio, midiendo con JavaScript.
- El caso **sin fecha de boda** comprobado en pantalla: no se dibuja ninguna
  línea, ni vacía ni con cero.
- El caso **nada tarde** comprobado por la misma puerta que el anterior: al
  quitar la fecha, `cuantas` baja a cero y no se dibuja nada. En el demo
  siempre hay algo tarde, así que el cero no se alcanza de otro modo.
- La línea del Camino comprobada en su orden de prioridad: que un choque gana a
  "no llega", y "no llega" a "se pasó".
