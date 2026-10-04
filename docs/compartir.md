# Compartir el avance

Estado: implementada.

## Qué es

Un botón **Compartir avance** en el Camino genera una imagen vertical
(1080×1920, el formato de historias de WhatsApp e Instagram) con:

- el nombre de la pareja, sacado del nombre de la boda en Clerk
  ("Boda de Ana y Luis" → "Ana y Luis");
- la cuenta regresiva: "70 días para el sí". Sin fecha, cuántas cosas van
  listas; el día de la boda, "Hoy es el sí"; después, "Sí, ya nos casamos";
- un **collar de perlas por meta** (hasta 4), en orden de dependencia. Perla
  llena: hecha; a medias: haciendo; aro: falta; rombo: hito. Sin metas, un solo
  collar "Nuestro camino" con todo lo que tiene fecha;
- el total "17 de 27 cosas listas" y el link de la app.

**Nunca lleva montos**: lo que gasta la pareja es privado.

## Cómo funciona

- `app/mi-boda/compartir/historia/route.tsx` dibuja la imagen con `next/og`
  a partir de la boda activa en la sesión. `private, no-store`: cambia cada vez
  que marcan algo.
- Las fuentes (Fraunces e Instrument Sans) se piden a Google Fonts solo con los
  glifos que usa la imagen (`lib/fuente-og.ts`); si fallan, sale con la de
  sistema.
- El arriba (250 px) y el abajo (330 px) quedan libres porque Instagram los
  tapa con su interfaz.
- En el celular, el botón abre el menú del sistema con el archivo
  (`navigator.share({ files })`); en computadora, lo descarga.
- La lógica (días en hora de Lima, collares, nombre de la pareja) es pura y
  está probada en `lib/historia.test.ts`.

## Avatares

Las personas se muestran con sus iniciales (nombre + primer apellido) sobre uno
de cinco pares de color de la paleta (`--persona-N-*` en `globals.css`). El
color sale de un hash del id, así que es el mismo en toda la app. No se usan
fotos. Lógica en `lib/persona.ts`.
