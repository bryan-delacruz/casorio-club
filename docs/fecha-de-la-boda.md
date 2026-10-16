# La fecha de la boda

**Estado: aprobada e implementada.**

Complementa `docs/metas.md` §2 (el tiempo relativo) y §5.4 (antes / el día /
después). No lo sustituye: aquí solo se decide cómo se pide la fecha, dónde
vive su control y qué cambia en pantalla cuando existe.

## 1. Qué es y por qué

Toda la app cuenta el tiempo en semanas respecto al día de la boda. Esa
referencia hoy puede no existir: `bodas.fecha` admite `null` y la app nunca la
pide. El único control para ponerla está en la cabecera de **El camino**, que
es la segunda pantalla; quien entra al Mapa y se queda ahí no la ve nunca.

Sin fecha la app sigue funcionando, pero deja de contestar tres cosas:

| Pregunta de la pareja | Sin fecha | Con fecha |
|---|---|---|
| ¿Cuánto falta de verdad? | "12 semanas antes de la boda" | "faltan 83 días" |
| ¿Qué día del calendario es esta barra? | nada | "5 mar" en el eje del Gantt |
| ¿Con cuántas semanas nace lo que anoto? | 8, supuesto fijo | las que faltan de verdad (`semanaPorDefecto`) |

La pregunta que contesta y que **ninguna otra pantalla contesta**: *cuántos
días faltan*. Las semanas relativas las contestan el Mapa y el Camino; los días
no los da nadie, porque la app no tiene de dónde restarlos.

No se añade pantalla ni vista nueva. Se añade un dato y se mueve un control.

## 2. Alcance

Entra:

1. El control de la fecha sube a la **cabecera** (`app/mi-boda/layout.tsx`) y
   es el único de la app: se quita de la cabecera de El camino.
2. La cabecera muestra la **cuenta regresiva en días**, derivada de la fecha.
3. El texto de bienvenida del Mapa pide la fecha cuando falta, sin ser un
   segundo control.
4. Al guardar una fecha que ya dejó acciones atrás, un aviso informativo dice
   cuántas. No se mueve nada solo.
5. Funciones puras nuevas en `lib/fecha-boda.ts`, probadas con `node:test`.

Queda fuera, y por qué:

| Fuera | Por qué |
|---|---|
| Hora de la ceremonia | El modelo cuenta semanas; la hora no cambia ningún cálculo. Es un dato de agenda, no de gestión. |
| Lugar o municipalidad | Dato de contacto, no de tiempo. No tiene dónde entrar todavía. |
| Fecha de la fiesta distinta de la civil | Dos fechas son dos orígenes de tiempo y parten los totales en dos. Si hace falta, se decide aparte. |
| Reprogramar acciones al mover la fecha | Las semanas son relativas: mover la fecha ya mueve todo. Tocar `inicioSemanas` rompería lo que la pareja decidió a mano. |
| Bloquear fechas demasiado cercanas | La app no es la municipalidad. Avisa, no impide. |
| Exportar a calendario (.ics) y recordatorios | Salida a otro sistema; alcance propio. |
| La fecha en la imagen de compartir | `lib/historia.ts` ya decide qué muestra. Esta spec no lo toca. |
| Modo oscuro, plantillas nuevas, índice de lectura | Otros candidatos, otra entrega. |

## 3. Modelo de datos (Drizzle)

**No hay columnas nuevas.** La fecha ya existe:

| Tabla | Columna | Tipo | Nota |
|---|---|---|---|
| `bodas` | `fecha` | `date("fecha")`, nullable | El día. `null` mientras no lo hayan decidido. |

Al no haber columna nueva, **no hay nota de despliegue ni riesgo de migración**:
nada que empujar a Neon antes de mergear. Es la razón principal por la que esta
entrega es barata.

Se rechaza añadir `fechaConfirmada` o similar: una fecha tentativa y una firme
se distinguen con la misma columna puesta o vacía, y un segundo campo obligaría
a mantener dos datos coherentes.

## 4. Comportamiento, pantalla por pantalla

### 4.1 Cabecera (`app/mi-boda/layout.tsx`) — el único control

El componente `FechaBoda` se monta en la cabecera, a la izquierda del bloque de
la derecha, y desaparece de `camino.tsx`. Un solo sitio para leerla y
escribirla, visible en Mapa, Camino, Gastos y Quién está.

| Estado | Qué se ve |
|---|---|
| `fecha === null` | Botón `outline`: **"Poner la fecha"** |
| Fecha puesta | Botón `ghost`: la fecha larga + `·` + la cuenta regresiva. Ej.: **"5 de marzo de 2026 · faltan 83 días"** |
| Celular (`max-sm`) | Solo la cuenta regresiva, o **"Poner la fecha"**. La fecha larga no cabe; se ve al abrir el popover. |

El popover no cambia: campo `date`, la nota *"El camino se cuenta desde aquí.
Si la mueven, se mueve todo."* y el botón Guardar.

La cuenta se calcula en el **servidor**, igual que `semanasHastaLaBoda` en
`app/mi-boda/page.tsx`: en el cliente "hoy" puede caer en otro día y la
hidratación avisaría.

### 4.2 Mapa (`/mi-boda`)

Solo cambia una frase, la de bienvenida, y solo cuando falta la fecha:

| Acciones | Fecha | Texto bajo el saludo |
|---|---|---|
| 0 | null | "Pon el día de la boda y anota lo que se les venga a la cabeza." |
| 0 | puesta | "Empieza por anotar lo que se les venga a la cabeza. Ya decidirán después cuándo va cada cosa." (sin cambio) |
| >0 | null | "3 de 11 hechas. Pon el día de la boda y las semanas se vuelven días." |
| >0 | puesta | "3 de 11 hechas, 2 en marcha." (sin cambio) |

Es texto, no un segundo botón: el control está arriba, a la vista, en la misma
pantalla. Dos disparadores del mismo popover serían el mismo dato dos veces.

La tira del próximo hito y la banda "Qué toca ahora" no cambian de reglas: ya
distinguen con y sin fecha (`docs/metas.md` §5.2, §5.3).

### 4.3 Camino (`/mi-boda/camino`)

- Se retira `<FechaBoda />` de la cabecera de `camino.tsx`.
- La nota del encabezado se mantiene en las dos variantes que ya tiene, porque
  explica qué gana el eje: con fecha, *"Cada barra es cuándo toca ocuparse de
  esa cosa."*; sin fecha, *"Pon la fecha y las semanas se vuelven días del
  calendario."*
- El día en el eje (`diaDeSemana`) ya funciona en cuanto hay fecha. No se toca.

### 4.4 Guardar, quitar y el aviso de lo que quedó atrás

- Guardar: toast **"Anotado. Faltan 83 días."** Con fecha pasada: **"Anotado.
  Fue hace 3 días."**
- Quitar (campo vacío): toast **"Fecha quitada. Las semanas siguen, los días
  no."**
- Si tras guardar quedan acciones en el camino cuya semana ya pasó
  (`cuantasYaPasaron > 0`), el toast añade una segunda línea: **"4 cosas
  quedaron en una semana que ya pasó."** Informa y nada más: no reprograma, no
  bloquea, no marca nada en rojo.

`guardarFechaBoda` debe devolver `{ error }` en vez de lanzar, como el resto de
`acciones-servidor.ts`: en producción Next oculta el mensaje de lo que se lanza.

## 5. Casos borde

| Caso | Qué pasa |
|---|---|
| `fecha === null` | Sin cuenta regresiva, sin días en el eje, `semanaPorDefecto` → 8. Nada se rompe. |
| Fecha = hoy | "es hoy". `semanasHastaLaBoda` → 0. |
| Fecha = mañana | "es mañana". |
| Fecha a 2..60 días | "faltan N días". |
| Fecha a más de 60 días | "faltan N semanas", redondeando como `semanasHastaLaBoda`. 400 días como "faltan 400 días" no se lee. |
| Fecha ayer | "fue ayer". |
| Fecha pasada hace más de 1 día | "fue hace N días". La app sigue entera: queda el acta y lo de después (semanas negativas). |
| Campo vacío al guardar | Se guarda `null`. Es la vía para quitarla. |
| Fecha imposible o mal formada | El `input type="date"` no la deja salir; si llega igual, la escritura devuelve `{ error: "Esa fecha no se entiende." }`. |
| Boda sin fila en `bodas` | El upsert la crea, como ya hace hoy. |
| Fecha a menos de 12 semanas con la meta Registro civil aplicada | Aviso de §4.4 con el conteo. Sin bloqueo: los plazos reales los fija la municipalidad, no la app. |
| Boda demo | Igual que cualquier otra; la semilla ya trae fecha. |
| Sin sesión | La lectura de la cabecera devuelve `null` y el control no se dibuja. La escritura falla. |

## 6. Funciones puras y pruebas esperadas

Nuevo `lib/fecha-boda.ts`. `diasHasta` **se muda** aquí desde `lib/historia.ts`
y se reexporta allí para no cambiar imports, igual que `soles` en
`app/mi-boda/_acciones/tipos.ts`.

| Función | Firma | Qué hace |
|---|---|---|
| `diasHasta` | `(fecha: string \| null, hoy: string) => number \| null` | Días enteros. Mudada, sin cambios. |
| `cuentaRegresiva` | `(fecha: string \| null, hoy: string) => string \| null` | El texto de §5. `null` sin fecha. |
| `fechaLarga` | `(fecha: string) => string` | "5 de marzo de 2026". Sale de `largo` en `fecha-boda.tsx` para poder probarse. |

En `lib/metas.ts`, junto al resto de la aritmética de acciones:

| Función | Firma | Qué hace |
|---|---|---|
| `cuantasYaPasaron` | `(acciones: AccionCamino[], semanasHastaLaBoda: number \| null) => number` | Cuántas acciones del camino, no hechas, empiezan en una semana que ya pasó: `inicioSemanas > semanasHastaLaBoda`. |

Pruebas, en `lib/fecha-boda.test.ts` y añadidas a `lib/metas.test.ts`:

| Función | Casos |
|---|---|
| `diasHasta` | misma fecha → 0; mañana → 1; ayer → −1; `null` → `null`; cruce de mes; cruce de año. |
| `cuentaRegresiva` | `null` → `null`; 0 → "es hoy"; 1 → "es mañana"; 13 → "faltan 13 días"; 60 → "faltan 60 días"; 61 → "faltan 9 semanas"; −1 → "fue ayer"; −3 → "fue hace 3 días". |
| `fechaLarga` | "2026-03-05" → "5 de marzo de 2026"; un día de un solo dígito y uno de dos. |
| `cuantasYaPasaron` | sin fecha (`null`) → 0; ideas sueltas (`inicioSemanas === null`) no cuentan; `inicioSemanas > semanas` cuenta; igual no cuenta; menor no cuenta; estado `hecho` no cuenta. |
| `semanaPorDefecto` | Ya probada (`docs/metas.md` §11). No cambia. |

## 7. Orden de implementación

1. Crear `lib/fecha-boda.ts` con `diasHasta` mudada, `cuentaRegresiva` y
   `fechaLarga`. Reexportar `diasHasta` desde `lib/historia.ts`.
2. Añadir `cuantasYaPasaron` a `lib/metas.ts`.
3. Escribir `lib/fecha-boda.test.ts` y los casos nuevos de `lib/metas.test.ts`.
4. `guardarFechaBoda`: validar el formato y devolver `{ error }` en vez de
   lanzar; devolver también el conteo de `cuantasYaPasaron` para el toast.
5. `fecha-boda.tsx`: usar `fechaLarga` y `cuentaRegresiva`, los toasts de §4.4
   y la variante de celular.
6. Montar `<FechaBoda />` en `app/mi-boda/layout.tsx` leyendo `obtenerBoda()`;
   quitarlo de `camino.tsx`.
7. Ajustar el texto de bienvenida del Mapa (§4.2).

## 8. Preguntas abiertas para el arquitecto

1. La cabecera pasa a leer `obtenerBoda()` en todas las rutas de `/mi-boda`.
   Está envuelta en `cache` de React, así que no se repite dentro de una misma
   petición, pero en `/mi-boda/equipo` y `/mi-boda/bernie` es una consulta que
   antes no existía. ¿Vale la pena, o el control solo se monta en Mapa y
   Camino?
2. ¿`diasHasta` se muda a `lib/fecha-boda.ts` con reexport en `lib/historia.ts`,
   o al revés —se queda y `lib/fecha-boda.ts` la importa—? La primera deja la
   fecha junta; la segunda no toca `historia.ts`.
3. `guardarFechaBoda` pasa a devolver `{ error }`. Hoy su único llamador espera
   que lance. ¿Algo más depende de esa firma?
4. En el celular la cabecera ya va en dos filas (`OrganizationSwitcher` baja a
   la suya). ¿Dónde cabe la cuenta regresiva sin añadir una tercera?

## 9. Supuestos no verificados

- **12 semanas de antelación** para el trámite de registro civil: sale de la
  plantilla `REGISTRO_CIVIL` del repo, no de una norma verificada. Se usa solo
  para el aviso informativo de §4.4, que no bloquea nada.
- Perú no aplica horario de verano, así que restar días entre fechas locales no
  necesita ajuste. Si algún día se mostrara una hora, habría que revisarlo.
