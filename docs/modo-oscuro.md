# Modo oscuro

> **Spec (SDD).** Este documento manda sobre el código del modo oscuro. Si algo
> cambia, primero se actualiza aquí.
>
> **Estado:** aprobada e implementada.
>
> Cierra la deuda declarada en `CLAUDE.md`: *"`app/globals.css` define `.dark`,
> nada lo activa y `next-themes` está instalado sin usar, así que ninguna
> pareja puede llegar ahí y validarlo sería inventar. Vuelve a la puerta el día
> que se pueda alcanzar."* Este es ese día.

## 1. Qué falta, exactamente

Casi todo está hecho desde hace tiempo, y nadie lo ha visto nunca:

| Pieza | Estado antes de esta spec |
| --- | --- |
| Los tokens `.dark` en `app/globals.css` | **Hechos** |
| `themeColor` con los dos esquemas en el layout | **Hecho** |
| Clerk siguiendo la paleta | **Hecho**: el tema `shadcn` lee los tokens |
| El toast leyendo el tema (`useTheme` en `sonner.tsx`) | **Hecho**, pero sin proveedor devuelve siempre el de por defecto |
| Algo que ponga la clase `.dark` | **No existe.** Esto es todo el trabajo |

El cambio es pequeño. Lo que no es pequeño es **validarlo**, que es justo lo
que hasta ahora no se podía hacer.

## 2. Se sigue el sistema. No hay interruptor

El modo lo decide el **sistema operativo** (`prefers-color-scheme`), y la app
no añade ningún control.

**Por qué no hay interruptor:**

- La cabecera ya va justa a 375 px. Costó una corrección medida dejar de
  desbordar (el selector de Clerk tuvo que poder encogerse); meterle un tercer
  control la devuelve al mismo sitio.
- Un teléfono cambia solo de tema al anochecer. La pareja que quiere oscuro ya
  lo tiene puesto en su teléfono, y no hay que enseñarle nada.
- Un control que no contesta ninguna pregunta que la pareja se haga es
  justo lo que este proyecto retira, no lo que añade.

**Qué lo reabriría:** que alguien pida oscuro en esta app teniendo el sistema
en claro. Entonces el interruptor se añade, y el sitio natural es una pantalla
de ajustes, que hoy no existe, no la cabecera.

## 3. Cómo se activa

**Con CSS, sin JavaScript.** Los tokens oscuros se declaran dos veces en
`app/globals.css`: bajo `.dark` y bajo `@media (prefers-color-scheme: dark)`.
No hay proveedor, ni clase que escribir, ni hidratación que vigilar.

Se probó primero con el `ThemeProvider` de `next-themes` y se retiró:

- Mete un `<script>` dentro de un componente, y React 19 lo denuncia en
  consola en cada carga. La puerta de calidad no admite errores de consola.
- Obliga a `suppressHydrationWarning` en `<html>`, porque escribe la clase
  antes de hidratar.
- Y no aportaba nada: lo único que da de más es recordar una elección, y aquí
  no hay interruptor que recordar (§2).

`next-themes` **se queda instalado**: `components/ui/sonner.tsx` llama a
`useTheme()`, que sin proveedor devuelve su valor por defecto, `"system"`, que
es justo lo que se quiere. Sonner lee `prefers-color-scheme` por su cuenta.

**El duplicado se vigila con una prueba.** Dos bloques con los mismos tokens
es la clase de duplicado que este proyecto evita —es el error que costó
retirar la columna `momento`—, y CSS no deja compartir un bloque entre una
clase y una media query. Así que `lib/tema.test.ts` falla si los dos bloques
dejan de declarar los mismos tokens con los mismos valores, o si un color
nuevo de `:root` se queda sin versión oscura.

## 4. Qué NO sigue el tema

- **La imagen para compartir** (`app/mi-boda/compartir/historia/route.tsx`).
  Fija sus colores en hexadecimal a propósito: es una imagen que sale de la app
  y viaja a WhatsApp, y debe verse igual para quien la recibe, tenga el tema
  que tenga. **No se toca.**
- **La tarjeta de Open Graph.** Mismo motivo.
- **`themeColor` del viewport.** Ya declara los dos esquemas por `media`, que
  es como el sistema espera leerlo; no depende de la clase.

## 5. Dónde hay riesgo de verdad

Los tokens oscuros existían sin que nadie los mirara, así que lo que hay que
comprobar es si **dicen lo mismo** en oscuro:

| Sitio | Qué comprobar |
| --- | --- |
| Camino: barra "Por hacer" (`bg-secondary`) | Que se distinga del fondo y de "Hecho" (`bg-primary/15`) |
| Camino: flechas (`stroke-muted-foreground/50`) | Que se vean sobre el fondo oscuro |
| Camino: choque y "no llega" (`text-destructive`) | Contraste sobre `--background` oscuro |
| Reparto: la barra de trozos (`bg-primary` y `bg-primary/50`) | Que los dos trozos se distingan entre sí |
| Mapa: tarjeta sobre fondo (`bg-card` sobre `bg-background`) | Que la tarjeta se separe del fondo |
| Texto apagado (`text-muted-foreground`) | El uso más extendido y el más fácil de romper |

El mínimo es **4.5:1 para texto** y **3:1 para los elementos no textuales** que
transmiten información (las barras del Gantt, los trozos del Reparto). Se mide
con JavaScript sobre los colores calculados, no a ojo.

### 5.1 Lo que midió, y qué se corrigió

| Sobre su fondo | Claro | Oscuro | Veredicto |
| --- | --- | --- | --- |
| Texto normal | 13.77 | 13.77 | Pasa |
| Texto apagado | — | 6.65 | Pasa |
| **Texto destructivo** | **7.10** | **3.90** | **Falla solo en oscuro** |
| Barra "Haciendo" | 12.15 | 6.65 | Pasa |
| Barra "Por hacer" | 1.40 | 1.98 | Baja en los **dos**, y **peor en claro** |
| Tarjeta sobre fondo | 1.13 | 1.12 | Igual en los dos |

**Se corrige uno solo: `--destructive` en oscuro**, de `#c4553c` a `#d97056`,
que lo lleva a 5.30:1. Es el aviso de choque y el de "no llega"
(`docs/retrasos.md`), o sea el texto más importante de la pantalla, y era el
único token que **empeoraba al cambiar de tema**. Nunca es fondo sólido
—siempre `text-destructive` con un tinte al 10–20 %—, así que aclararlo no
empeora ningún otro sitio.

**No se tocan la barra "Por hacer" ni la tarjeta.** Los números dicen que no
es un defecto del modo oscuro: en claro son iguales o peores, y llevan años
así. Arreglar solo la versión oscura dejaría los dos temas distintos y
escondería el problema de fondo. Si alguna vez se arregla, se arregla en los
dos a la vez y con su propia decisión de diseño, no de rebote.

## 6. Qué queda fuera

- **Un interruptor** (§2).
- **Subir el contraste de la barra "Por hacer" y de la tarjeta** (§5.1). Es un
  asunto de los dos temas, no del oscuro.
- **Guardar la preferencia por boda o por persona** en la base. El sistema ya
  la guarda.
- **Un tercer tema** o temas por boda.
- **Cambiar ningún token.** Si alguno falla el contraste se corrige **ese**, y
  se dice cuál y por qué; no se rehace la paleta.
- **Modo oscuro en la imagen para compartir** (§4).

## 7. Puerta de calidad

Vuelve a la puerta de `CLAUDE.md`, de donde salió. Además:

- Mapa y Camino validados en oscuro, en móvil y escritorio, con los contrastes
  de §5 **medidos** con JavaScript.
- Sin aviso de hidratación en consola.
- El toast sale oscuro (lo decide `useTheme`, que ahora sí tiene proveedor).
- La interfaz de Clerk sale oscura sin una sola línea de CSS contra sus clases.
- La imagen para compartir sigue saliendo clara con el sistema en oscuro.
