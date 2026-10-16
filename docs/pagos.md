# Pagos: quién puso la plata

> **Spec (SDD).** Este documento manda sobre el código de los pagos y del
> Reparto: si algo cambia, primero se actualiza aquí.
>
> **Estado: aprobada e implementada.**
>
> **Cero columnas nuevas.** Todo lo que pide esta spec sale de la tabla `pagos`
> tal como está hoy. No hay nota de despliegue porque no hay nada que empujar a
> Neon antes de mergear.

## 1. Qué es y por qué

Una acción que cuesta plata se paga, y en una boda civil peruana se paga **a
pedazos y entre varios bolsillos**: al fotógrafo se le deja un adelanto al
reservar, el certificado médico lo paga el que pasó por la clínica, el almuerzo
lo reparten. La tabla `pagos` ya existe para eso: una fila por cada vez que sale
plata, con su monto, su día, su nota y quién la puso.

El dueño del producto pidió tres cosas: registrar que una acción la pagó una
persona o varias, poder tener varios pagos ("1era parte", "2do pago"), y saber
cómo va la cuenta. **El modelo ya soporta las tres**: varios pagos son varias
filas, un gasto repartido son varias filas, y `pagado_por_id` guarda quién puso
cada una. Lo que falta está **entero en la pantalla**, y hay un defecto de
cálculo en el Reparto que la bloquea (§2).

### 1.0 Responsable y pagador son dos cosas distintas

Hay que decirlo explícito porque el código de hoy lo esconde. En palabras del
dueño: *"el responsable es quien se encarga de la gestión de esa tarea, pero lo
puede pagar otro o entre varias personas y/o con varios pagos"*.

- **`acciones.responsable_id` = quién se encarga.** Quién persigue el trámite,
  quién va a la municipalidad, a quién se le pregunta cómo va.
- **`pagos.pagado_por_id` = quién puso la plata**, en ese pago concreto.

**No hay ninguna regla que los ate.** Una acción la gestiona uno y la paga otro;
la gestiona uno y la pagan tres con cuatro pagos; o no tiene responsable y la
paga alguien. `registrarPago` copia hoy siempre `accion.responsableId` y por eso
la independencia no se ve — y por eso tampoco se notaba el defecto de §2. Ese
valor por defecto **se queda, pero como comodidad y no como regla** (§3.1): casi
siempre acierta y siempre se puede cambiar.

El Reparto hereda la distinción: su desglose dice **de qué responde cada uno**
(suma de montos por responsable) y la línea nueva dice **quién ha puesto plata**
(suma de pagos por pagador). Son dos números distintos y no hay que mezclarlos
en la misma fila (§4).

### 1.1 Las preguntas de la pareja, y dónde se contestan

| Pregunta | Dónde se contesta | ¿Falta algo? |
|---|---|---|
| ¿Cuánto cuesta esto y cuánto falta pagar? | Diálogo de pagos de la acción | No. Ya está. |
| ¿Cuándo pagué y cuánto? | La lista de pagos del diálogo | No. |
| ¿Cuánto va la boda y de qué responde cada uno? | El Reparto, en el Mapa | No. |
| **¿Quién pagó esto?** | En ningún sitio se puede **elegir** | **Sí: §3.1** |
| **¿Esto lo pusimos entre varios?** | Se puede, anotando un pago por persona | **Sí, el atajo: §3.2** |
| **¿Vamos parejos, o alguien puso más?** | En ningún sitio | **Sí: §4.2** |

Las tres últimas son las que abren esta spec. La última es *la* pregunta de una
boda que pagan varias personas con cuentas separadas, y hoy la app tiene el dato
y no lo dice.

**No hay pantalla nueva.** Lo de §3 es un campo más en un diálogo que ya existe;
lo de §4 es una línea más en una sección que ya existe. Una pantalla "Pagos"
mostraría los mismos pagos que ya están en cada acción, ordenados por fecha:
sería la segunda manera de ver los mismos datos, y eso ya se rechazó una vez
(`docs/metas.md` §5.1).

## 2. El defecto que hay que arreglar primero

`app/mi-boda/_acciones/reparto.tsx` construye una fila por persona **a partir de
los responsables** de las acciones con monto, y solo después reparte lo pagado:

```ts
for (const p of pagos) {
  const id = p.pagadoPorId ?? POR_REPARTIR;
  const cuenta = cuentas.get(id);
  if (cuenta) cuenta.hecho += Number(p.monto);   // ← si no hay fila, se pierde
}
```

Si quien pagó no es responsable de ninguna acción con monto, **su pago no tiene
fila y desaparece de la cuenta**: el total "ya pagados" sale corto y nadie se
entera. Hoy casi no se nota porque `registrarPago` copia siempre el responsable
de la acción, así que el pagador siempre tiene fila. En cuanto se pueda elegir
quién pagó (§3.1), lo que pone quien no es responsable se evapora: un gasto
repartido entre tres mostraría solo el tercio del responsable.

**La corrección.** El reparto de lo pagado se calcula sobre **todos** los pagos
de la boda, y una persona que pagó sin responder por nada **aparece igual**, con
`total = 0` y su `hecho`. Es la verdad: puso plata.

Consecuencia visible, y se acepta: una persona puede salir en el Reparto con
"S/ 0 · 0 %" de responsabilidad y aun así figurar en la línea de §4.2. El
Reparto deja de ser "la lista de responsables" y pasa a ser "la lista de quien
tiene algo que ver con la plata".

## 3. El diálogo de pagos de una acción

`app/mi-boda/_acciones/pagos-accion.tsx`. Lo que hay (el saldo grande, la barra,
la lista, el formulario de tres campos) no cambia. Entran dos cosas.

### 3.1 "Quién puso"

Un selector en el formulario de anotar, junto a "Cuánto" y "Cuándo":

- Opciones: los miembros de la boda (nombre de pila, como en el resto de la
  app) y **"Por repartir"**, que escribe `pagado_por_id = null`. Se llama "Por
  repartir" y no "Sin decidir" porque es exactamente la etiqueta que el Reparto
  ya usa para ese grupo, y dos nombres para la misma cosa es un nombre de más.
- **Por defecto, el responsable de la acción.** Es lo que `registrarPago` ya
  hace en silencio; ahora se ve y se puede cambiar. Si la acción no tiene
  responsable, por defecto "Por repartir".
- Ese valor por defecto es una **comodidad, no una regla** (§1.0): el
  responsable gestiona la tarea y el pago lo puede poner cualquiera. El selector
  no se presenta ni se redacta como "confirma que pagó el responsable"; es una
  pregunta abierta con una respuesta ya puesta. Por eso **no lleva ninguna
  marca de "recomendado"** ni deja fuera a nadie de la lista.
- El valor sigue siendo una **copia al momento de pagar**, no una lectura en
  vivo: si mañana la acción cambia de dueño, quien pagó sigue siendo quien pagó.
  Ese comentario del esquema se queda tal cual, y ahora además es cierto por
  elección de la pareja y no por herencia.

`registrarPago` gana el parámetro `pagadoPorId: string | null`. Cuando llega
`undefined` (una llamada vieja), se mantiene el comportamiento de hoy: el
responsable de la acción.

### 3.2 "Repartir", el atajo

Un gasto que ponen varios se puede anotar hoy a mano: un pago por persona. Son
tres formularios para un almuerzo que pagaron tres, con la misma fecha teclada
tres veces y una división mental de un número con céntimos. Es lo que más pasos
cuesta de toda la pantalla, así que lleva atajo.

- Un botón **"Repartir"** al lado de "Anotar pago", visible cuando la boda tiene
  **dos miembros o más**. Con un solo miembro no hay nada que repartir y el
  botón no se dibuja.
- Se llama **"Repartir"** y no "A medias" porque reparte entre **los que se
  elijan**, que pueden ser dos, tres o todos. Un solo nombre para una sola cosa:
  "A medias" no se puede decir de tres personas y tener dos etiquetas para el
  mismo botón sería vocabulario de más.
- **Reparte en partes iguales** entre los elegidos. Los montos desiguales no
  pasan por el atajo (§6): se anotan como pagos sueltos con su "Quién puso", que
  tras §3.1 ya es un flujo de primera clase.
- **A quiénes.** Con exactamente **dos** miembros no hay nada que elegir: el
  botón reparte entre los dos y actúa de inmediato. Con **tres o más**, el botón
  despliega una fila de fichas con los miembros, **todas marcadas**, y pasa a
  decir **"Repartir entre N"**; se desmarca a quien no puso. Hacen falta al
  menos dos marcados: con uno, el botón se desactiva y lo que corresponde es
  anotar un pago normal.
- Usa el monto, la fecha y la nota del mismo formulario y escribe **una fila por
  persona elegida** en un solo viaje y una sola revalidación.
- La nota, si la hay, va **igual en todas las filas**. No se le añade "(mitad)"
  ni ningún sufijo: las filas se distinguen por el nombre de quien pagó, que la
  lista ya muestra.
- **Los céntimos que no dividen** se reparten de uno en uno entre los primeros,
  en el orden de miembros que ya usa el Reparto. Determinista, para que la misma
  operación dé siempre el mismo resultado:
  `partes("100.00", 3) → ["33.34", "33.33", "33.33"]`. La suma de las partes es
  **exactamente** el monto, siempre.
- El selector "Quién puso" se **ignora** al usar este botón: el atajo reparte
  entre los elegidos, pase lo que ponga el selector.

### 3.3 El nombre de cada pago, derivado

El dueño pidió poder nombrar los pagos ("1era parte", "2do pago"). Eso ya se
puede: el campo "Qué fue" lo guarda en `nota`, con el placeholder "Adelanto,
saldo, la mitad…". **No se añade ninguna numeración guardada** (§6).

Lo que sí cambia: cuando la nota está vacía, la lista dice hoy **"Pago"** para
todas las filas, y tres filas que dicen "Pago" no se distinguen. En su lugar se
muestra el número **derivado de la posición** en orden de fecha (y, a igualdad,
de `creado_el`): **"1.er pago"**, **"2.º pago"**, **"3.º pago"**.

- Es derivado, no guardado: borrar el primero renumera los demás, que es
  correcto, porque el número solo describe el orden de lo que se ve.
- **Nunca pisa la nota.** Si la pareja escribió "Adelanto", se lee "Adelanto".
- Si la acción tiene un solo pago sin nota, dice **"Pago"** como hoy: "1.er
  pago" cuando no hay un segundo es un número que no informa.

## 4. El Reparto (en el Mapa)

`app/mi-boda/_acciones/reparto.tsx`. Sigue donde está, al final de la portada
del Mapa (`docs/metas.md` §7).

### 4.1 Lo que no cambia

El número grande, el "Entre los dos, S/ N ya pagados", la barra de un trozo por
persona del mismo color y el desglose con avatar, nombre, monto y porcentaje. Y
sobre todo **el principio**, que está escrito en el propio archivo: *es la cuenta
de un bote común, no una deuda entre ustedes*; por eso el orden sigue al de los
miembros y no al monto, para no hacer un podio. El desglose sigue hablando de
**de qué responde cada uno**, no de quién pagó.

### 4.2 La línea del desbalance (lo nuevo, y lo único nuevo)

Una línea, debajo del desglose. Con **dos** personas:

> **"Bryan puso S/ 401 más que Ana. Si quieren ir parejos, los próximos S/ 401
> los pone Ana."**

Con **tres o más**, "quién le debe a quién" ya no es una resta, así que la línea
nombra solo a quienes van por debajo de su parte y cuánto les falta:

> **"Para ir parejos, faltan S/ 320 de Ana y S/ 180 de Luis."**

Dos frases cortas en el primer caso, una en el segundo. La frase que dice qué
hacer es siempre **condicional** ("si quieren ir parejos", "para ir parejos").
Así se contesta "¿vamos parejos?" sin abrir un libro de deudas y sin imponer el
reparto igual: quien se reparte 70/30 lee los números y se salta el consejo.

**La regla, una sola, y las dos frases son su lectura.** La *parte* de cada
persona es `pagado con pagador conocido / número de miembros de la boda`. Quien
está por debajo de su parte "le falta" la diferencia; quien está por encima "va
por delante". Con dos personas eso da exactamente la mitad de la diferencia
entre las dos, y la frase se redacta como la resta directa porque es como habla
la gente: *"puso S/ 401 más"*, no *"va S/ 200.50 por encima de su parte"*.

- Se nombra a quien va por debajo **por su falta, de mayor a menor**; a igualdad,
  por el orden de miembros. Los nombres van unidos por comas y un " y " final.
- Un miembro que **no ha pagado nada** entra igual: su falta es su parte entera.
  Es la verdad, y es justo el caso que la pareja quiere ver.
- No se nombra a quien va **por delante** cuando hay tres o más: con varios por
  delante la frase se alarga y no cambia lo que hay que hacer.

Por qué esto **no** rompe el principio del bote común: el bote es el número
grande y la barra, y no se tocan. Lo que la línea compara es **plata que ya
salió de un bolsillo**, que es otra pregunta y hoy no tiene respuesta en ninguna
pantalla. Lo que sí se evita con cuidado: la palabra "debe", ordenar a las
personas por lo que pusieron, pintar nada en rojo y poner la línea arriba.

Cuándo se dibuja — las tres condiciones, todas obligatorias:

1. La boda tiene **dos miembros o más**. Con uno no hay con quién comparar.
2. Hay **al menos un pago con pagador conocido**. Sin eso no hay nada que
   repartir.
3. Al menos una persona va por debajo de su parte en **S/ 50 o más**. Por debajo
   de esa cifra nadie reequilibra nada, y una línea que aparece y desaparece con
   cada adelanto es ruido. Quien va por debajo en menos de S/ 50 **no se nombra**
   aunque la línea se dibuje por otro.
   ⚠️ **Supuesto no verificado**: el umbral es un juicio de producto, no un dato.
   Si se ve ruidoso en uso real, se sube; está en una constante.

El cálculo va **en céntimos enteros**, no en soles con decimales, y solo se
convierte a soles al escribir el texto: comparar y restar sumas de `numeric` en
coma flotante arrastra medio céntimo y dispara el umbral por error.

Los pagos de "Por repartir" (`pagado_por_id = null`) **no entran** en la
comparación ni se reparten entre nadie: no se sabe quién los puso, y adivinarlo
es inventar el número que la línea vende como exacto. Por eso la parte se
calcula sobre lo pagado **con pagador conocido**: si entrara lo anónimo, la parte
de todos subiría y todo el mundo parecería ir por detrás.

## 5. Modelo de datos (Drizzle)

**Sin cambios. Cero columnas nuevas, cero índices nuevos.** Se deja escrito qué
hace cada columna de `pagos` con esta spec, porque es la que las usa de verdad:

`pagos`
- `id` uuid PK.
- `boda_id` text — orgId de Clerk. Toda consulta filtra por él.
- `accion_id` uuid → `acciones.id` **on delete cascade**. Borrar la acción se
  lleva sus pagos: un pago sin acción no es nada.
- `monto` `numeric(12, 2)` **not null** — nunca float.
- `pagado_por_id` text null — userId de Clerk de quien puso la plata. **Null =
  "Por repartir"**. Copia al momento de pagar.
- `fecha` date **not null** — solo el día.
- `nota` text null — lo que la pareja escribió. Vacía, el nombre se deriva
  (§3.3).
- `creado_el` timestamptz — desempata dos pagos del mismo día (§3.3).
- Índice `(boda_id, accion_id)`: ya existe y sirve para las dos lecturas.

Derivado, nunca guardado: **el adelanto y el saldo** (suma de filas contra el
`monto` de la acción), **lo que puso cada persona**, **el desbalance**, **el
número de orden de un pago** y **`deBernie`** (sale de `gastosBernie.pagoId`).

Lo que **no** se añade y por qué: ni `es_mitad` (dos filas ya lo dicen), ni
`orden` (la fecha lo dice), ni `pagado_por_nombre` (§6), ni un campo "ya pagado"
en `acciones` (es la suma de las filas, y el esquema ya explica por qué no).

## 6. Qué queda fuera

- **Numerar los pagos como campo guardado** ("1era parte" escrito por la app en
  la nota). La numeración es derivada (§3.3). Guardarla se desincroniza en
  cuanto se borra un pago o se anota uno con fecha anterior, y encima pisaría lo
  que la pareja quiso escribir.
- **Montos desiguales dentro del atajo** (60/40, "yo pongo S/ 500 y tú el
  resto"). El atajo reparte en **partes iguales** entre los elegidos (§3.2), que
  es el caso que se repite; un reparto desigual se anota como un pago por
  persona con su "Quién puso", que ya se puede y ahora se ve. Lo que costaría de
  verdad no son los campos: es la validación de que N montos sumen exactamente
  el total, con su mensaje de error, su redondeo y su estado a medio llenar —
  una clase de error nueva para algo que pasa una o dos veces en una boda.
- **Repartir entre varios con porcentajes guardados** ("este gasto siempre va
  70/30"). Un pago es un hecho con fecha, no una regla.
- **Que pague alguien que no es miembro de la boda** — los papás, un padrino, un
  tío. Es realísimo en una boda peruana y **queda fuera a propósito**:
  `pagado_por_id` es un userId de Clerk, así que admitirlo pide o invitar a esa
  persona a la boda (y entonces ve todo) o una columna `pagado_por_nombre` de
  texto libre, que es cambio de esquema y despliegue. Mientras tanto hay una
  salida honesta: "Por repartir" más la nota ("lo puso mi mamá"). Es la
  ampliación más probable después de esta spec, y va en su propia spec. **El
  reparto entre varios no lo vuelve inevitable**: reparte entre miembros de la
  boda, y a quien no es miembro se le puede invitar a la organización, que es la
  decisión que esa otra spec tendrá que pesar.
- **Editar un pago.** Hoy se crea y se borra, y borrar más crear es la misma
  operación en dos toques. No se añade edición.
- **Una pantalla o sección "Pagos"** con todos los pagos de la boda, su
  historial o su calendario. Serían los mismos datos que ya están en cada acción
  (§1.1).
- **Recordatorios** de un saldo que vence, y cualquier noción de **fecha de
  vencimiento** de un pago. Un pago tiene el día en que se hizo, no el día en
  que toca.
- **Monedas distintas de soles.** `moneda` existe en el esquema y la interfaz
  sigue mostrando `S/` con `soles()`. Un gasto de Bernie en otra moneda es
  materia de `docs/integracion-bernie.md`.
- **Presupuesto previsto contra gastado** por meta o por boda. El `monto` de la
  acción ya hace de previsto y los pagos de real; una capa de presupuesto aparte
  es otra spec.
- **Tocar el contrato de Bernie.** Intacto. Un gasto asignado sigue creando su
  pago, y ese pago entra en todo lo de aquí como cualquier otro, con su
  `pagado_por_id` resuelto como hoy.

## 7. Casos borde

| Caso | Qué pasa |
|---|---|
| **La acción no tiene monto** | El diálogo sigue diciendo *"Esta acción no tiene monto. Ponle uno desde Cambiar."* y no muestra formulario. Igual que hoy. |
| **La acción tenía monto, se pagó y después le quitaron el monto** | Los pagos siguen existiendo y **siguen contando** en el Reparto: la plata salió. El diálogo no deja anotar más. |
| **Lo pagado supera el monto** | El saldo no baja de cero (`cuentaDe` ya hace `Math.max(total - pagado, 0)`) y la barra se corta al 100 %. En el Reparto, "ya pagados" puede salir **mayor** que el total: se muestra el número tal cual, sin recorte, porque es lo que de verdad salió del bolsillo. |
| **Un pago de alguien que no responde por nada** | Aparece en el Reparto con `total = 0` y su `hecho` (§2). |
| **Todos los pagos son "Por repartir"** | No hay línea de desbalance: no hay ningún pago con pagador conocido que repartir. |
| **Una sola persona ha pagado, y la boda tiene dos** | Sí se dibuja: la otra va por debajo de su parte en la mitad de lo pagado. Es el caso que la línea existe para contar. |
| **Todos pusieron exactamente su parte** | Nadie va por debajo en S/ 50 o más: no se dibuja la línea. El silencio es la buena noticia. |
| **Boda de una sola persona** (todavía sin su pareja en la organización) | Sin botón "Repartir" y sin línea de desbalance. El selector "Quién puso" muestra esa persona y "Por repartir". |
| **Tres o más miembros y uno no ha pagado nada** | Se nombra con su parte entera como falta, junto a los demás que vayan por debajo, de mayor a menor (§4.2). |
| **Tres o más miembros y solo uno va por debajo** | La línea nombra a uno solo: *"Para ir parejos, faltan S/ 320 de Ana."* |
| **Un monto que no divide entre los elegidos** | Los céntimos sobrantes van de uno en uno a los primeros, en el orden de miembros (§3.2). Nunca se pierde ni se inventa un céntimo. |
| **"Repartir" con un solo miembro marcado** | El botón se desactiva. Repartir entre uno es anotar un pago normal. |
| **Un miembro entra en la boda a mitad del camino** | Su parte se calcula igual, sobre lo pagado hasta ahora, así que entra con una falta grande y se corrige con sus pagos. No se recalcula nada hacia atrás: no hay historial de membresía que leer. |
| **Un miembro sale de la boda después de pagar** | Su `pagado_por_id` se queda en la fila y ya no hay nombre que mostrar: se dibuja como **"Por repartir"**, Antes de este cambio no se dibujaba nada. No se borra el pago: la plata salió. |
| **Dos pagos el mismo día sin nota** | Desempatan por `creado_el` para numerarlos (§3.3). |
| **Un pago venido de Bernie sin nota** | La insignia "de Bernie" ya lo identifica, así que el número derivado se muestra igual y no estorba. |
| **Dos personas anotan a la vez** | Son dos `INSERT` independientes; no hay nada que colisione. El Reparto se recalcula al revalidar. |

## 8. Pruebas esperadas

`node:test` sobre un archivo nuevo `lib/pagos.test.ts`, contra funciones puras
nuevas en **`lib/pagos.ts`**. Hoy `cuentaDe` vive en
`app/mi-boda/_acciones/tipos.ts` y no tiene pruebas; **se mueve a `lib/pagos.ts`
y se prueba** (es la función que decide el saldo de todo).

- **`cuentaDe`**: sin monto; con monto y sin pagos; pagado parcial; pagado
  exacto; pagado de más (el `falta` no baja de 0).
- **`partes(monto, n)`**: `n = 2` con monto par y con monto impar en céntimos
  (el extra al primero); `n = 3` con `"100.00"` → `["33.34", "33.33", "33.33"]`;
  la suma de las partes es **exactamente** el monto en los tres casos,
  comprobada en céntimos enteros; `partes("0.01", 2)` → `["0.01", "0.00"]`;
  `partes("0.02", 3)` → `["0.01", "0.01", "0.00"]`; `n = 1` devuelve el monto
  entero; `n = 0` devuelve lista vacía y no divide por cero.
- **`repartoDePagos(pagos, miembros)`**: suma por persona; **incluye a quien
  pagó sin ser responsable de nada** (la corrección de §2); agrupa los
  `pagado_por_id` nulos en "Por repartir"; un `pagado_por_id` que no está en
  `miembros` cae en "Por repartir".
- **`desbalance(pagadoPorPersona, miembros, umbral)`**: null con un solo
  miembro; null sin ningún pago con pagador conocido; null cuando nadie va por
  debajo en el umbral o más; con **dos** miembros devuelve quién va por delante,
  quién por detrás y la diferencia entre los dos (no la mitad); con **tres**
  devuelve la lista de los que van por debajo con su falta, de mayor a menor;
  **incluye a un miembro que no pagó nada**, con su parte entera como falta;
  **excluye del cálculo los pagos "Por repartir"**, comprobado con un caso donde
  incluirlos cambiaría el resultado; omite de la lista a quien va por debajo en
  menos del umbral aunque la línea se dibuje por otro; el cálculo en céntimos no
  se desvía con montos como `"333.33"` repetidos (el caso que delata el float).
- **`etiquetaDePago(pagos, pago)`**: devuelve la nota si la hay; devuelve
  "1.er pago" / "2.º pago" por orden de fecha cuando no la hay; con un solo pago
  sin nota devuelve "Pago"; desempata por `creado_el`; borrar el primero
  renumera.
- **`reparte`** (la que ya existe en `reparto.tsx` y reparte el sobrante por
  resto mayor): **se mueve también a `lib/pagos.ts`** y se prueba, porque es
  aritmética pura y hoy está dentro de un componente, contra la regla de
  `lib/`. Casos: los porcentajes suman exactamente 100; los montos suman
  exactamente el objetivo; todas las partes en cero.

## 9. Orden de implementación

1. **`lib/pagos.ts`** con `cuentaDe` (movida), `reparte` (movida), `partes`,
   `repartoDePagos`, `desbalance` y `etiquetaDePago`, más `lib/pagos.test.ts`
   (§8). Nada de interfaz todavía.
2. **Reparto**: consumir `repartoDePagos` — con eso queda arreglado el defecto
   de §2 — y añadir la línea de §4.2. Sin tocar el número grande ni la barra.
3. **Acción de servidor**: `registrarPago` con `pagadoPorId`, y el atajo de
   §3.2 que escribe **una fila por persona elegida** en un solo viaje y un solo
   `revalidatePath("/mi-boda")`.
4. **Diálogo de pagos**: selector "Quién puso" (§3.1), botón "Repartir" con su
   fila de fichas cuando hay tres o más miembros (§3.2) y el nombre derivado en
   la lista (§3.3).
5. **Validación** en móvil (375×812) y escritorio, claro y oscuro: el formulario
   con cuatro campos a 375 px sin desbordar el diálogo; la fila de fichas con
   cuatro miembros a 375 px; el Reparto con la línea de desbalance de dos
   personas, con la de tres o más y sin ninguna; y los estados de §7 que se
   pueden montar en la boda demo.

## 10. Preguntas abiertas para el arquitecto

1. **Validar `pagadoPorId` en el servidor.** ¿Se comprueba que el userId sea
   miembro de la organización antes de escribirlo, o se acepta tal cual? No es
   una fuga entre bodas (el `boda_id` lo pone el servidor), pero sí permite
   escribir un userId cualquiera en una fila de esta boda. Comprobarlo cuesta
   una llamada a Clerk por pago; `listarMiembros` ya existe y está en `cache`.
2. **Una acción o dos para "Repartir".** ¿`registrarPago` acepta un arreglo de
   pagos y el atajo manda N, o hay una segunda acción
   `registrarPagoRepartido(...)` que recibe el monto y la lista de pagadores? Lo primero es un solo endpoint con una firma más
   suelta; lo segundo son dos endpoints y la mitad del parseo duplicado. Es la
   misma disyuntiva que `docs/metas.md` §14.8; decide quien implemente, pero que
   sea **un solo viaje y una sola revalidación**, no N `registrarPago`
   encadenados desde el cliente. Si el reparto lo hace el servidor a partir del
   monto y la lista, `partes` tiene que correr allí y no en el cliente, para que
   los céntimos no dependan de quién sumó.
3. **Dónde vive el umbral de S/ 50.** ¿Constante exportada de `lib/pagos.ts` con
   el valor por defecto en la firma de `desbalance`, para que la prueba pueda
   pasar otro? Lo supongo así en §8; confírmalo.
4. **Mover `cuentaDe` de `tipos.ts` a `lib/pagos.ts`.** La importa el diálogo de
   pagos y puede importarla algo más. ¿Rompe algún límite de `server-only` o de
   frontera cliente/servidor, o es un mover y reimportar?
5. **El `Select` de shadcn dentro del diálogo.** El formulario de pagos ya vive
   en un `Dialog`; es el mismo riesgo de foco y de `Esc` que `docs/metas.md`
   §14.12 plantea para el popover. ¿Se resuelven igual los dos?
6. **El Reparto es cliente y lee los pagos de la boda entera.** Con la
   corrección de §2 recorre todos los pagos y todas las acciones en cada render,
   igual que ya hacía. ¿Importa con cien pagos? Probablemente no; dicho por si
   acaso.
7. **La fila de fichas de "Repartir"** (§3.2) con tres o más miembros: ¿se
   dibuja con el `AvatarPersona` que ya existe en modo conmutable, o hace falta
   un control nuevo? Y a 375 px con cinco miembros, ¿envuelve o hace scroll
   horizontal? Lo supongo envolviendo.
8. **El número de miembros en el Reparto.** `desbalance` necesita cuántos
   miembros tiene la boda, no cuántos pagaron. `Reparto` ya recibe `miembros`,
   así que sale de ahí; confírmalo, y confírmame que `listarMiembros` devuelve
   **todos** los miembros de la organización y no solo los que tienen algo
   asignado.
