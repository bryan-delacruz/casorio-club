# Pagos: quién puso la plata

> **Spec (SDD).** Este documento manda sobre el código de los pagos y del
> Reparto: si algo cambia, primero se actualiza aquí.
>
> **Estado: aprobada e implementada.** Lo último en entrar, lo de §9.1: la
> etiqueta con el estimado y lo puesto juntos (§3.4), la línea del Reparto sin
> umbral (§4.2), la palabra "estimado" en lugar de "calculado", la invitación a
> escribir el total y el diálogo vacío. Queda pendiente la validación en
> pantalla (§9.1, paso 7).
>
> **Consolidada.** Las enmiendas están integradas en el cuerpo; lo que
> contradecían se borró. Lo último en corregirse: **pagar y terminar son ejes
> independientes**, así que el estado **hecho** no dice nada de la plata (§3.5).
>
> **Enmienda posterior:** aviso al guardar un total menor que lo puesto (§3.5.1).
>
> **Cero columnas nuevas.** Todo sale de `pagos` y de `acciones` tal como
> están. No hay nota de despliegue porque no hay nada que empujar a Neon antes
> de mergear.

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

| Pregunta | Dónde se contesta | Dónde se decide |
|---|---|---|
| ¿Cuánto cuesta esto y cuánto falta pagar? | Diálogo de pagos de la acción | §3.4 |
| ¿Cuándo pagué y cuánto? | La lista de pagos del diálogo | §3.3 |
| ¿Cuánto va la boda y de qué responde cada uno? | El Reparto, en el Mapa | §4.3 |
| ¿Quién pagó esto? | El selector "Quién puso" | §3.1 |
| ¿Esto lo pusimos entre varios? | El atajo "Repartir" | §3.2 |
| ¿Vamos parejos, o alguien puso más? | La línea del Reparto | §4.2 |
| ¿Cuánto llevo puesto en algo cuyo total no sé? | La tarjeta y el diálogo | §3.4 |
| ¿Ya está pagado del todo, si no sé el total? | El total que la pareja escribe al final | §3.5 |

La de "¿vamos parejos?" es *la* pregunta de una boda que pagan varias personas
con cuentas separadas; la última es la del total que se sabe al final.

**No hay pantalla nueva.** Lo de §3 es un campo más en un diálogo que ya existe;
lo de §4 es una línea más en una sección que ya existe. Una pantalla "Pagos"
mostraría los mismos pagos que ya están en cada acción, ordenados por fecha:
sería la segunda manera de ver los mismos datos, y eso ya se rechazó una vez
(`docs/metas.md` §5.1).

## 2. El defecto del Reparto, corregido

Queda escrito porque explica por qué el Reparto se calcula como se calcula.
`app/mi-boda/_acciones/reparto.tsx` construía una fila por persona **a partir de
los responsables** de las acciones con monto, y solo después sumaba lo pagado
sobre esas filas (`if (cuenta) cuenta.hecho += …`). Si quien pagó no es
responsable de ninguna acción con monto, **su pago no tiene fila y desaparece de
la cuenta**: el total "ya pagados" sale corto y nadie se entera. Con "Quién
puso" (§3.1), un gasto repartido entre tres mostraría solo el tercio del
responsable.

**La corrección.** El reparto de lo pagado se calcula sobre **todos** los pagos
de la boda, y una persona que pagó sin responder por nada **aparece igual**, con
`total = 0` y su `hecho`. Es la verdad: puso plata.

Consecuencia visible, y se acepta: una persona puede salir en el Reparto con
"S/ 0 · 0 %" de responsabilidad y aun así figurar en la línea de §4.2. El
Reparto deja de ser "la lista de responsables" y pasa a ser "la lista de quien
tiene algo que ver con la plata".

## 3. El diálogo de pagos de una acción

`app/mi-boda/_acciones/pagos-accion.tsx`. El saldo grande, la barra y la lista
se quedan como estaban; lo que decide esta sección es quién puso cada pago
(§3.1), el atajo de repartirlo (§3.2), cómo se llama cada pago (§3.3), y qué
pasa cuando el total no se sabe (§3.4, §3.5).

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

### 3.4 El estimado y lo puesto, los dos a la vez

En palabras del dueño: *"es posible que yo ya sepa el total que me va a salir,
como aún no lo sepa y voy pagando por partes y el total se sabrá al final"*.
Son dos números y la pantalla hoy nombra uno solo, y mal: trata el `monto` como
el total.

- **El estimado** = `acciones.monto`, lo que la pareja cree que va a costar.
  La palabra en la interfaz es **"estimado"**, la que usó el dueño: *"yo
  colocaria el estimado y el hasta ahora"*. Nombra un número, se lee sola y no
  es jerga de gestión. **"Calculado" se retira entera**: el formulario pide
  *"Cuánto estimas (S/)"* y el diálogo abre con *"Estimado S/ 1,200. Anota aquí
  cada vez que salga plata."* Dos palabras para el mismo número es una de más.
  No "presupuesto", reservado a lo que sigue fuera (§6).
- **Lo puesto** = la suma de los pagos, el número que crece pago a pago. La
  palabra para él es **"puestos"**, la que el producto ya usa en *"quién puso"*
  y en el diálogo, y ahora también en la tarjeta: *"S/ 450 puestos de
  S/ 1,200"*. Se lee sola, no se conjuga con nadie y no dice si la cuenta está
  cerrada. Por qué no las otras: **"pagado"** ya significa cuenta cerrada
  (§3.5); **"gastado"** choca con *gasto*, que aquí es la fila de Bernie
  (`gastosBernie`); **"acumulado"** es de contabilidad; **"llevamos"** es verbo
  conjugado y da por hecho que pagan los dos, cuando puede pagar uno (§1.0);
  **"lo que va saliendo"** son cuatro palabras para un número.
- **"Hasta ahora" sobrevive, pero no como nombre del número**: es la marca de
  que la cuenta sigue abierta, y por eso aparece **solo cuando no hay
  estimado**, donde no hay un *"de S/ N"* que ponga el techo.

`monto` nulo con pagos dentro significa **"cuesta plata y todavía no sé
cuánto"**, y hoy esa acción no se ve como gasto en ninguna pantalla aunque haya
plata puesta. Así que **la marca de gasto (💰) pasa a ser "tiene monto o tiene
pagos"**: el pago es la prueba, y no hace falta columna. Por lo mismo **"Pagos"
aparece siempre en el menú ⋯**, que es la única puerta para empezar a pagar algo
sin total; cuesta una fila de menú y la 💰 sigue apareciendo solo cuando hay
plata de verdad.

Los dos números se muestran **juntos** siempre que existan. Antes se excluían y
la tarjeta nunca decía las dos cosas a la vez. Las palabras viven en la función
pura `etiquetaDeDinero`, no en el JSX. Una cadena por cuadrante, ninguna más:

| Estimado | Pagos | Texto de la tarjeta |
|---|---|---|
| no hay | ninguno | sin 💰 y sin texto (`null`) |
| no hay | S/ 450 | **"S/ 450 puestos hasta ahora"** |
| S/ 1,200 | ninguno | **"S/ 1,200 estimado"** |
| S/ 1,200 | S/ 450 | **"S/ 450 puestos de S/ 1,200"** |

La última fila es **una sola plantilla** para los tres casos que antes eran tres
textos: a medias *"S/ 450 puestos de S/ 1,200"*, completo *"S/ 1,200 puestos de
S/ 1,200"*, pasado *"S/ 1,380 puestos de S/ 1,200"*. Ni el exceso ni el saldo
se nombran: **se deducen de los dos números**, que es el total real que el dueño
pidió en vez del aviso. `soles()` redondea los dos, así que un céntimo no cambia
el texto.

El **estado no entra** en ninguna fila (§3.5). El saldo sigue sin bajar de cero
y la barra sigue cortándose al 100 %.

**A 375 px.** El peor caso es *"S/ 1,380 puestos de S/ 1,200"*: 28 caracteres,
tres más que *"faltan S/ 750 de S/ 1,200"* (25), que ya se mostraba. La fila de
insignias es `flex-wrap`: si no cabe, la insignia **salta de línea** y no se
corta. **Ningún número se trunca nunca**, ni se abrevia "puestos"; cede el alto
de la tarjeta (§9.1).

El diálogo dice ahora **lo mismo, palabra por palabra**: la línea de la derecha
es siempre *"S/ 450 puestos de S/ 1,200"*, con *"falta · "* delante mientras
falte plata. Con cero pagos sigue
diciendo *"sin pagar todavía"*, porque el número grande ya es el estimado.

El diálogo con `monto` nulo **deja anotar pagos**, al contrario que hoy: en vez
de *"Esta acción no tiene monto. Ponle uno desde Cambiar."* dice **"Todavía no
sabes cuánto cuesta. Anota lo que vayas pagando y el total se irá sumando."**,
el número grande es lo puesto con *"puestos hasta ahora"* al lado, **no hay
barra** porque no hay total que llenar, y "Cuánto" arranca en blanco. Lista,
"Quién puso" y "Repartir" funcionan igual. **Sin monto y sin ningún pago, el
bloque del número no se dibuja**: diría *"S/ 0 puestos hasta ahora"*, que es
ruido; quedan la frase y el formulario.

**El aviso de exceso se retira entero.** Con él se van dos cosas de
`lib/pagos.ts`: la constante **`UMBRAL_DE_MAS`** y **`cuentaDe().deMas`**, cuyos
únicos clientes eran ese aviso en la tarjeta y en el diálogo. En la meta y en el
Reparto nunca se avisó (§4.3).

### 3.5 "Pagado del todo" cuando el total se sabe al final

En palabras del dueño: *"pagado todo significa que ya se cumplió con el 100 %
del pago, respecto a la gestión no se puede precisar porque uno paga por
adelantado algunas cosas"*. **Pagar y terminar son ejes independientes**: del
estado **hecho** no se deduce que no quede plata por salir, y del saldo en cero
no se deduce que la gestión esté hecha. Ninguno de los dos se usa como señal
del otro, ni aquí ni en la tarjeta (§3.4).

Entonces, con el total sin saber, ¿quién dice que ese fue el último pago? **La
pareja, escribiendo el total en cuanto lo sabe**, que es justo el momento en que
lo descubre: el último pago. Desde ahí "pagado del todo" se deriva como siempre
—lo puesto contra el estimado— y no hace falta ninguna marca.

Para que no dependa de que alguien se acuerde, el diálogo lo invita donde pasa.
Mientras la acción **no tenga total y tenga al menos un pago**, debajo de la
lista aparece una línea con un campo y un botón:

> **"¿Ya sabes cuánto fue en total? Escríbelo y verás si queda algo por
> pagar."** — campo *"Cuánto (S/)"* y botón **"Guardar"**, que escribe
> `acciones.monto` y nada más.

- **No bloquea nada.** Anotar pagos funciona sin tocarla, y la línea no se
  convierte en obligación ni en error: es una invitación y se puede ignorar para
  siempre.
- **No bloquea ni corrige el número contra lo puesto.** Si lo escrito queda por
  debajo, se guarda igual y la acción pasa a decir *"S/ N puestos de S/ M"* con
  lo puesto por encima del estimado. Puede ser correcto, o puede ser un pago
  mal anotado; la app no sabe cuál. Solo avisa, una vez, al guardar (§3.5.1).
- Se deja de ver en cuanto hay total, porque entonces el saldo ya lo cuenta.

#### 3.5.1 Aviso al guardar un total menor que lo puesto

Decisión del dueño: *"dejarlo, pero avisar al guardar"*. No se bloquea, no se
pide confirmación y no se corrige nada solo. La etiqueta de la tarjeta no
cambia (§3.4); el aviso vive solo en el toast del momento de guardar.

**Toast:** **"Guardado. Ya hay S/ 527 puestos, más que el total de S/ 200."**
Con `soles()` en los dos números. No dice que algo esté mal.

| Total escrito contra lo puesto | `puestos` devuelto | Toast |
|---|---|---|
| Mayor | no | el de guardado de siempre |
| **Exactamente igual** (en céntimos) | no | el de siempre; cuenta cerrada, nada que avisar |
| Menor, pero lo puesto es 0 | no | el de siempre |
| **Menor y hay pagos** | suma de pagos | el de arriba |
| Vacío o 0 (quita el total) | no | el de siempre; sin total no hay con qué comparar |

**Qué devuelve `ponerTotal`:** `{ error?, puestos? }`, mismo patrón que
`guardarFechaBoda` (`{ error?, yaPasaron? }`). `puestos` es la suma de `pagos`
de esa acción como cadena `numeric` (`"527.00"`), presente solo en la fila
"menor y hay pagos". El cliente arma el toast con ella y con el total que acaba
de escribir. La suma se hace en el servidor, filtrada por `boda_id`, con la
misma `cuentaDe` que el resto; el cliente no la recalcula. Con `error` no hay
`puestos`.

Prueba (función pura en `lib/pagos.ts`, p. ej. `puestosSiExcede(total, pagos)`,
nombre a decidir por el arquitecto): total `"200"` con pagos que suman `"527"`
→ `"527.00"`; total `"527"` → `null`; total `"600"` → `null`; total `"200"`
sin pagos → `null`; total `""` y `"0"` con pagos → `null`; `"526.99"` contra
`"527.00"` → `"527.00"` (comparación en céntimos).

**Por qué no una marca "pagado del todo" en `acciones`** (columna nueva y
despliegue en Neon antes de mergear): el total escrito sirve en cuatro sitios
—saldo, tarjeta, meta y Reparto— y la marca solo pintaría una etiqueta, dejando
los totales sin saber cuánto costó la cosa. Qué lo reabriría: ver que las
parejas nunca escriben el total y todo se queda en *"hasta ahora"*.

## 4. El Reparto (en el Mapa)

`app/mi-boda/_acciones/reparto.tsx`. Sigue donde está, al final de la portada
del Mapa (`docs/metas.md` §7).

### 4.1 Lo que no cambia

El número grande —§4.3 decide **qué** suma, no cambia su forma—, el "Entre los
dos, S/ N ya pagados", la barra de un trozo por persona del mismo color y el desglose con avatar, nombre, monto y porcentaje. Y
sobre todo **el principio**, que está escrito en el propio archivo: *es la cuenta
de un bote común, no una deuda entre ustedes*; por eso el orden sigue al de los
miembros y no al monto, para no hacer un podio. El desglose sigue hablando de
**de qué responde cada uno**, no de quién pagó.

### 4.2 La línea del desbalance

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
3. **Hay diferencia.** Alguien va por debajo de su parte. **No hay umbral de
   producto**: lo decidió el dueño —*"que no haya umbral"*— y con dos personas
   eso significa que la línea estará visible casi siempre, que es lo buscado:
   si la diferencia existe, se dice. `UMBRAL_DESBALANCE` **se retira** de
   `lib/pagos.ts` y `desbalance` pierde su parámetro `umbral`.

Los dos casos que el umbral tapaba, y que ahora manda esta regla:

| Caso | Qué pasa |
|---|---|
| **Empate exacto**: nadie por debajo, ni un céntimo | No se dibuja la línea. Nada que contar; el silencio es la buena noticia. |
| **Falta de menos de 50 céntimos** | No se dibuja, y con tres o más no se nombra a esa persona aunque la línea salga por otro. Es el **único corte** que queda, y no es un juicio de producto: desde 50 céntimos `soles()` deja de escribir "S/ 0", y *"Bryan puso S/ 0 más que Ana"* sería falso. Vive dentro de `desbalance`, sin constante. |
| **Falta de 50 céntimos a S/ 1** | Se dibuja: *"Bryan puso S/ 1 más que Ana"*. Redondeado y verdadero. Con dos personas el corte se mide sobre la **falta**, que es la mitad de la diferencia: S/ 1 de diferencia es una falta de 50 céntimos y sí se dibuja. |

El cálculo va **en céntimos enteros**, no en soles con decimales, y solo se
convierte a soles al escribir el texto: comparar y restar sumas de `numeric` en
coma flotante arrastra medio céntimo, que es justo la cifra del corte.

Los pagos de "Por repartir" (`pagado_por_id = null`) **no entran** en la
comparación ni se reparten entre nadie: no se sabe quién los puso, y adivinarlo
es inventar el número que la línea vende como exacto. Por eso la parte se
calcula sobre lo pagado **con pagador conocido**: si entrara lo anónimo, la parte
de todos subiría y todo el mundo parecería ir por detrás.

### 4.3 Lo que va costando: el estimado o lo puesto, el mayor

Una regla: **por acción cuenta `max(estimado, lo puesto)`**. Manda el estimado
hasta que lo puesto lo pasa —o no hay estimado—, porque esa plata ya salió. Se llama `costando`, sale de `cuentaDe` y no se guarda.

Suman con esa regla, y solo con esa: el **número grande** del Reparto y cada
fila de su desglose —y con ellos los trozos de la barra y los porcentajes—, el
**monto de una meta** (`resumenMeta`) en el Mapa y en el Camino, y el número por
acción de la fila del Camino, que hoy muestra `a.monto` y pasa a `costando`, sin
palabras: ahí no cabe una frase.

Dos consecuencias buscadas: una acción pagada sin monto deja de valer **S/ 0**
en los totales, y *"S/ N ya pagados"* **nunca** sale mayor que el número grande,
que es lo que pasaba hasta ahora (§7). No cambia nada más: ni el orden de las
filas, ni los colores, ni el principio del bote común (§4.1). Y **no hay aviso
de exceso en la meta ni en el Reparto**: una acción que se pasa se compensa con
otra que sobró, y un "se pasaron" de boda necesita un total que la pareja fije,
que sigue fuera (§6).

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
número de orden de un pago**, **lo que va costando una acción, una meta y la
boda** (§4.3), **que una acción cuesta plata** (tiene monto o tiene pagos) y
**`deBernie`** (sale de `gastosBernie.pagoId`).

Lo que **no** se añade y por qué: ni `es_mitad` (dos filas ya lo dicen), ni
`orden` (la fecha lo dice), ni `pagado_por_nombre` (§6), ni un campo "ya pagado"
en `acciones` (es la suma de las filas, y el esquema ya explica por qué no), ni
`pagado_del_todo` (se deriva de lo puesto contra el estimado en cuanto la
pareja escribe el total, §3.5), ni `monto_real` (es la suma de los pagos).

## 6. Qué queda fuera

- **Numerar los pagos como campo guardado**. La numeración es derivada (§3.3):
  guardarla se desincroniza al borrar un pago o anotar uno con fecha anterior, y
  pisaría lo que la pareja quiso escribir.
- **Montos desiguales dentro del atajo** (60/40, "yo pongo S/ 500 y tú el
  resto"). El atajo reparte en **partes iguales** entre los elegidos (§3.2); un
  reparto desigual se anota como un pago por persona con su "Quién puso". Lo
  caro no son los campos: es validar que N montos sumen exactamente el total,
  con su error, su redondeo y su estado a medio llenar — una clase de error
  nueva para algo que pasa una o dos veces en una boda.
- **Porcentajes guardados** ("este gasto siempre va 70/30"). Un pago es un
  hecho con fecha, no una regla.
- **Que pague alguien que no es miembro de la boda** — los papás, un padrino, un
  tío. Realísimo en una boda peruana y **queda fuera a propósito**:
  `pagado_por_id` es un userId de Clerk, así que admitirlo pide o invitar a esa
  persona a la boda (y entonces ve todo) o una columna `pagado_por_nombre` de
  texto libre, que es cambio de esquema y despliegue. Salida honesta mientras
  tanto: "Por repartir" más la nota ("lo puso mi mamá"). Es la ampliación más
  probable después de esta spec, y va en su propia spec.
- **Editar un pago.** Borrar más crear es la misma operación en dos toques.
- **Una pantalla o sección "Pagos"**: los mismos datos que ya están en cada
  acción (§1.1).
- **Recordatorios** y **fecha de vencimiento** de un pago. Un pago tiene el día
  en que se hizo, no el día en que toca.
- **Monedas distintas de soles.** `moneda` existe en el esquema y la interfaz
  sigue mostrando `S/` con `soles()`; otra moneda es materia de
  `docs/integracion-bernie.md`.
- **Una marca "pagado del todo"** en `acciones`. Se deriva (§3.5).
- **Un presupuesto por meta o por boda**: un número que la pareja fije como
  techo, con su aviso al pasarse. La comparación del estimado con lo puesto
  **sí entra**, pero solo por acción (§3.4), que es donde hay dos números del
  mismo gasto. Un techo de boda es un dato nuevo que nadie ha escrito —columna y
  pantalla— y es otra spec.
- **Tocar el contrato de Bernie.** Intacto. Un gasto asignado sigue creando su
  pago, que entra en todo lo de aquí como cualquier otro.

## 7. Casos borde

| Caso | Qué pasa |
|---|---|
| **La acción no tiene monto y no tiene pagos** | Ni 💰 ni cuenta. "Pagos" sí está en el menú ⋯ y el diálogo abre con la frase y el formulario, **sin el bloque del número** (§3.4). |
| **La acción no tiene monto y tiene pagos** | Es un gasto: 💰 y *"S/ 450 puestos hasta ahora"*. El diálogo deja anotar más, sin barra (§3.4). |
| **La acción tenía monto, se pagó y después le quitaron el monto** | Cae en el caso de arriba: los pagos siguen contando, la acción **sigue siendo gasto** y el diálogo deja anotar más. |
| **Acción hecha, sin monto, con pagos** | *"S/ 450 puestos hasta ahora"*, igual que si no estuviera hecha: pagar y terminar son ejes independientes (§3.5). La invitación a escribir el total sigue ahí. |
| **Acción hecha, con monto y saldo pendiente** | *"S/ 450 puestos de S/ 1,200"*. Hecho es el estado de la gestión, no el de la plata. |
| **Acción por hacer, con monto y todo pagado** | *"S/ 1,200 puestos de S/ 1,200"* y sigue por hacer: se paga por adelantado (§3.5). |
| **La pareja escribe el total y es menor que lo puesto** | Se guarda tal cual: *"S/ 1,380 puestos de S/ 1,200"*. Nada se bloquea, nada se avisa, nada se corrige (§3.5). |
| **La pareja nunca escribe el total** | La acción se queda en *"hasta ahora"* para siempre. Cuenta en todos los totales por lo puesto (§4.3); lo único que no se puede decir es "no falta nada". |
| **Monto puesto y cero pagos** | *"S/ 1,200 estimado"*. Nada es real todavía. |
| **"Cuesta dinero" encendido y "Cuánto" vacío, sin pagos** | No se dibuja 💰: no hay dónde guardar "cuesta plata y no sé cuánto" sin un pago que lo pruebe, y no se añade columna para eso. El formulario lo dice: *"Si todavía no lo sabes, déjalo en blanco y anota los pagos."* |
| **Lo pagado supera el monto**, por un céntimo o por mil soles | El saldo no baja de cero (`cuentaDe` ya hace `Math.max(total - pagado, 0)`) y la barra se corta al 100 %. La tarjeta y el diálogo dicen lo mismo: *"S/ 1,380 puestos de S/ 1,200"*. **Sin aviso de exceso**: los dos números lo dicen (§3.4). En el Reparto entra lo puesto (§4.3), así que "ya pagados" ya **no** sale mayor que el número grande. |
| **Ninguna acción tiene monto y hay pagos** | El Reparto muestra como número grande lo puesto, donde antes salía **S/ 0** con la barra vacía. |
| **Un pago de alguien que no responde por nada** | Aparece en el Reparto con `total = 0` y su `hecho` (§2). |
| **Todos los pagos son "Por repartir"** | No hay línea de desbalance: no hay ningún pago con pagador conocido que repartir. |
| **Una sola persona ha pagado, y la boda tiene dos** | Sí se dibuja: la otra va por debajo de su parte en la mitad de lo pagado. Es el caso que la línea existe para contar. |
| **Todos pusieron exactamente su parte** | Empate exacto: no se dibuja la línea (§4.2). |
| **Dos personas y una puso S/ 0.30 más** | No se dibuja: la línea diría "S/ 0" (§4.2). |
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

`node:test` en `lib/pagos.test.ts`, contra las funciones puras de
**`lib/pagos.ts`**. `cuentaDe` vive ahí, y no en
`app/mi-boda/_acciones/tipos.ts`, porque es la función que decide el saldo de
todo y tiene que probarse.

- **`cuentaDe`**: sin monto; con monto y sin pagos; pagado parcial; pagado
  exacto; pagado de más (el `falta` no baja de 0); `sinTotal` (monto nulo) y
  `costando` = `max(total, pagado)` en los cuatro cruces de monto nulo/puesto y
  pagos cero/parcial/de más. **`deMas` ya no se prueba porque ya no existe**
  (§3.4).
- **Aviso de total menor** (§3.5.1): los casos de su tabla, en céntimos.
- **`etiquetaDeDinero(accion, pagos)`**: una prueba por fila de la tabla de
  §3.4 —`null`, *"S/ 450 puestos hasta ahora"*, *"S/ 1,200 estimado"*,
  *"S/ 450 puestos de S/ 1,200"*— más los dos extremos de la última plantilla:
  *"S/ 1,200 puestos de S/ 1,200"* y *"S/ 1,380 puestos de S/ 1,200"*, sin
  ninguna palabra de exceso. Y una
  que fija §3.5: **el mismo caso con la acción `hecho` y con la acción
  `por_hacer` devuelve el mismo texto**; el estado no entra.
- **`resumenMeta`** (en `lib/metas.test.ts`): el monto de una meta suma
  `costando` y no `monto`, comprobado con una acción sin monto y pagada, y con
  una pagada de más.
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
- **`desbalance(pagadoPorPersona, miembros)`** —sin parámetro `umbral`—: null
  con un solo miembro; null sin ningún pago con pagador conocido; null en
  **empate exacto**; null cuando la mayor falta no llega a **50 céntimos**; se
  dibuja con una falta de S/ 1; con **dos** miembros devuelve quién va por delante,
  quién por detrás y la diferencia entre los dos (no la mitad); con **tres**
  devuelve la lista de los que van por debajo con su falta, de mayor a menor;
  **incluye a un miembro que no pagó nada**, con su parte entera como falta;
  **excluye del cálculo los pagos "Por repartir"**, comprobado con un caso donde
  incluirlos cambiaría el resultado; omite de la lista a quien va por debajo en
  menos de 50 céntimos aunque la línea se dibuje por otro; el cálculo en céntimos no
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

Todo implementado salvo la validación en pantalla (paso 7). Los pasos en el
orden en que entraron: `lib/pagos.ts` con `cuentaDe`, `reparte`, `partes`,
`repartoDePagos`, `desbalance`, `etiquetaDePago`, `etiquetaDeDinero` y sus
pruebas; la corrección del Reparto (§2) y su línea de desbalance (§4.2); "Quién
puso" y "Repartir" (§3.1, §3.2); los nombres derivados (§3.3); `costando` en el
Reparto, en `resumenMeta` y en la fila del Camino (§4.3); el diálogo que deja
anotar sin total, el diálogo vacío y la invitación a escribir el total con
`ponerTotal` (§3.4, §3.5); y por último las cuatro cadenas de `etiquetaDeDinero`
con la palabra "estimado", el diálogo que repite esa cadena palabra por palabra
y `desbalance` sin umbral, que se llevó `UMBRAL_DE_MAS`, `UMBRAL_DESBALANCE` y
`cuentaDe().deMas`.

### 9.1 Los pasos

1. **`etiquetaDeDinero` con las cuatro cadenas** de §3.4, y fuera
   `UMBRAL_DE_MAS` y `cuentaDe().deMas`. Se ajustan las pruebas y el único
   consumidor de `deMas`, el diálogo.
2. **El diálogo**: la línea de la derecha pasa a *"S/ 450 puestos de
   S/ 1,200"* en los tres casos con estimado, idéntica a la de la tarjeta
   (§3.4). Y el bloque sin estimado dice *"puestos hasta ahora"*, como hoy.
3. **`desbalance` sin umbral** (§4.2): fuera `UMBRAL_DESBALANCE` y el
   parámetro; dentro el corte de 50 céntimos. Se ajustan las pruebas.
4. **La palabra "estimado"** donde se leía "calculado" (§3.4): formulario
   (*"Cuánto estimas (S/)"*), frase de apertura del diálogo, y los comentarios
   que la nombran.
5. **La invitación a escribir el total** en el diálogo (§3.5): línea con campo
   y botón "Guardar" mientras no haya total y haya al menos un pago. Escribe
   solo `acciones.monto`.
6. **El diálogo vacío** (§3.4): sin total y sin pagos, no se dibuja el bloque
   del número.
7. **Validación** en móvil (375×812) y escritorio: la tarjeta con
   *"S/ 1,380 puestos de S/ 1,200"*, el texto más largo, sin desbordar ni
   truncar —si salta de línea, se mide el alto y se acepta—; el diálogo en sus tres formas (sin total y vacío, sin total con
   pagos, con total); la línea del Reparto con diferencia de S/ 1; la
   invitación a 375 px.

## 10. Preguntas abiertas para el arquitecto

Las tres que quedaban, contestadas por el arquitecto:

1. **Validar `pagadoPorId` en el servidor.** Se acepta tal cual, sin
   comprobarlo contra los miembros de la organización. No es una fuga entre
   bodas —el `boda_id` lo pone el servidor— y el daño de un userId inventado
   queda dentro de la propia boda: el Reparto lo dibuja como "Por repartir",
   que es exactamente lo que ya hace con quien salió de la boda (§7). Lo
   reabriría tener una pantalla que muestre ids ajenos, o un pago que se pueda
   escribir desde fuera del diálogo.
2. **Con qué se guarda el total de la invitación** (§3.5). Con `ponerTotal`,
   una acción de servidor mínima que escribe solo `acciones.monto` y
   `actualizadaEl`. `editarAccion` exige el formulario entero y el diálogo de
   pagos no tiene esos campos: pasarlos vacíos borraría meta, semana y
   responsable.
3. **El Reparto es cliente y recorre los pagos de la boda entera.** Se deja
   como está. Con cien pagos son dos recorridos y un `Map` por render, por
   debajo de lo que cuesta pintar la sección. Lo reabriría una boda con miles
   de pagos, que no es el caso de uso.
