# Metas

> **Spec (SDD).** Este documento manda sobre el código de las metas: si algo
> cambia, primero se actualiza aquí. **Estado: aprobada e implementada.**

## 1. Qué es una meta

Algo que la pareja quiere **lograr** y que necesita varias acciones encadenadas:
"Registro civil" no se consigue sin las partidas, el certificado médico, el
expediente, el edicto… y cada paso espera al anterior.

En la interfaz se llama **Meta**. Equivale a un **entregable** del PMBOK (un
paquete de trabajo de la EDT/WBS) o a una **épica** en Scrum. En un Gantt es la
**tarea resumen** que agrupa a sus subtareas.

Una acción pertenece a **una meta o a ninguna**: así el total de una meta nunca
cuenta dos veces el mismo gasto.

## 2. Modelo de datos (Drizzle)

`metas` — tabla nueva.
- `id` uuid PK, `boda_id` text (orgId de Clerk), `titulo` text, `orden` int,
  `creada_el` timestamptz. Índice `(boda_id, orden)` e **índice único
  `(boda_id, titulo)`**: no hay dos metas con el mismo nombre en una boda, y dos
  personas que aplican la plantilla a la vez no la duplican.

`acciones` — dos columnas nuevas, ambas opcionales para no tocar los datos actuales:
- `meta_id` uuid null → `metas.id` **on delete set null** (borrar la meta no borra
  sus acciones: quedan sueltas).
- `es_hito` boolean default false — un **hito** es un momento, no un periodo (la
  ceremonia civil). En el Gantt se dibuja como **rombo**, no como barra.

Todo derivado, nada guardado dos veces:
- **Avance** de la meta = acciones hechas / total.
- **Rango** = desde el inicio más temprano hasta el fin más tardío de sus acciones.
- **Monto** = suma de los montos de sus acciones (incluye lo que vino de Bernie).

> ⚠️ Despliegue: Drizzle selecciona todas las columnas de `acciones`, así que las
> columnas nuevas deben existir en Neon **antes** de mergear (`drizzle-kit push`).
> Solo agrega; no modifica ni borra nada.

## 3. Plantilla "Registro civil" (Perú)

Botón **"Empezar con Registro civil"** cuando la boda aún no tiene esa meta. Crea la
meta y estas acciones, con dependencias y semanas típicas (todo editable después).
Si ya existe una acción con el mismo título (sin mayúsculas ni tildes), la
reutiliza y le asigna la meta en vez de duplicarla; si esa acción no tenía fecha
(era idea o sin semanas), toma el carril y las semanas de la plantilla. Lo que la
pareja ya había decidido se respeta. Todo va en un solo batch.

| Acción | Semanas antes | Dura | Requiere | Hito |
|---|---|---|---|---|
| Partida de nacimiento de los dos | 12 | 2 | — | |
| Copia del DNI de los dos | 12 | 1 | — | |
| Certificado domiciliario | 11 | 1 | — | |
| Certificado médico prenupcial | 9 | 2 | — | |
| Elegir a los dos testigos | 10 | 1 | — | |
| Presentar el expediente en la municipalidad | 7 | 1 | las 5 anteriores | |
| Publicar el edicto matrimonial | 6 | 2 | expediente | |
| Ceremonia civil | 0 | 1 | edicto | ✅ |
| Recoger el acta de matrimonio | −2 | 1 | ceremonia | |

## 4. Camino (Gantt)

- Selector **"Por meta | Por momento"**. Por defecto **Meta** si la boda tiene
  metas; sin metas, **Momento** (si no, todo caería en un solo grupo "Sin meta").
  Lo elegido va en la URL (`?por=meta` / `?por=momento`).
- Por meta: una **barra resumen** con su nombre y avance ("3 de 8 hechas") y,
  debajo, sus acciones en **orden de dependencia**: primero lo que no espera a
  nada y luego lo que depende de ello. A igualdad, la que empieza antes. Al final,
  el grupo **"Sin meta"**.
- **Flechas** de dependencia: del fin del requisito al inicio de la acción, dentro
  de la misma meta. Si el requisito está en otra meta, se mantiene el texto
  "↳ requiere …" de hoy.
- **Cadena principal** resaltada: la secuencia más larga de dependencias que
  termina en la última acción de la meta.
- **Choques** como hoy: un requisito que termina después de que la acción empieza
  se marca en rojo.
- **"Lista para empezar"**: acción por hacer que **tiene requisitos** y todos
  están hechos. Sin requisitos no se marca: todo lo suelto estaría "listo" y la
  señal se perdería.
- **Hito**: rombo en su semana, sin duración.
- En pantallas angostas, el Gantt mantiene su scroll horizontal y la columna de
  nombres fija.

## 5. Mapa y formulario

- Formulario de acción: campo **Meta** (elegir una existente o "+ Crear meta …") y
  casilla **"Es un hito"**.
- Tarjeta de acción en el Mapa: chip con el nombre de la meta.
- Si guardar la acción falla después de crear una meta nueva, esa meta se borra
  (no quedan metas vacías).
- Las acciones de servidor devuelven `{ error }` con mensajes para el usuario en
  vez de lanzar: en producción Next oculta el mensaje de lo que se lanza.
- El diálogo del formulario nunca supera la pantalla: el `DialogContent` base
  tiene altura máxima y scroll, el ✕ y el botón Guardar quedan siempre visibles.

## 6. Integración con Bernie

Sin cambios en el contrato. La subcategoría de Bernie sigue sugiriendo la
**acción**; al asignar un gasto, su pago suma a la acción y, por derivación, al
monto de su meta.

## 7. Demo

La boda demo usa la plantilla: sus trámites quedan en la meta "Registro civil"
(la ceremonia como hito), y "Almuerzo con la familia" y el restaurante en una
meta "Almuerzo".

## 8. Pruebas

`node:test` sobre funciones puras en `lib/metas.ts`:
- orden de dependencia (topológico, estable, tolera ciclos sin colgarse);
- cadena principal;
- "lista para empezar";
- avance y rango de la meta;
- plantilla: no duplica acciones por título y arma las dependencias.

## 9. Orden de implementación

1. Esquema + `lib/metas.ts` (puro) + tests.
2. Acciones de servidor: crear/renombrar/borrar meta, asignar meta, plantilla.
3. Formulario y chip en el Mapa.
4. Camino agrupado por meta: barra resumen, flechas, cadena, hito, "lista para empezar".
5. Demo.
6. `drizzle-kit push` en Neon (con tu OK) → PR → merge → verificación en producción.
