"use client";

import { Check, Diamond } from "lucide-react";
import type { Accion, Dependencia } from "@/db/schema";
import { estadoDeHitos, faltanAntesDe, faltanSemanas, nombreDeHitos } from "@/lib/metas";
import { HITO_SIN_SEMANA, INVITA_HITO, type MetaLite } from "./tipos";

/**
 * Cuánto falta para el hito, en palabras.
 *
 * Con fecha de boda es una cuenta regresiva desde hoy; sin fecha, lo único
 * cierto es dónde cae respecto de la boda (docs/metas.md §5.3).
 */
function cuando(semanaDelHito: number, semanasHastaLaBoda: number | null) {
  const faltan = faltanSemanas(semanasHastaLaBoda, semanaDelHito);
  if (faltan === null) {
    if (semanaDelHito === 0) return "el día de la boda";
    const n = Math.abs(semanaDelHito);
    return `${n} ${n === 1 ? "semana" : "semanas"} ${semanaDelHito > 0 ? "antes de la boda" : "después"}`;
  }
  if (faltan <= 0) return "es esta semana";
  return `faltan ${faltan} ${faltan === 1 ? "semana" : "semanas"}`;
}

/** "te faltan 3 cosas antes", o que ya no falta nada. */
function antes(cuantas: number) {
  if (cuantas === 0) return "ya está todo listo";
  return `te ${cuantas === 1 ? "falta 1 cosa" : `faltan ${cuantas} cosas`} antes`;
}

/**
 * La tira de hitos (docs/metas.md §5.3, §5.3.1): una línea sobria que cuenta
 * una de cuatro cosas, según por qué no hay un próximo hito.
 *
 * - hay uno por hacer → su nombre, su cuenta regresiva y cuántas cosas faltan;
 * - están todos hechos → la tira de cierre, con un check y el último que pasó;
 * - no hay ningún hito → la invitación a marcar uno;
 * - hay hitos pero son ideas sueltas → que les falta la semana.
 *
 * Los dos últimos solo los pone el Mapa (`invita`), y una sola vez: en el
 * Camino el rombo ya lo explica y un hito sin semana no está dibujado.
 */
export function TiraProximoHito({
  acciones,
  dependencias,
  metas,
  semanasHastaLaBoda,
  invita = false,
}: {
  acciones: Accion[];
  dependencias: Dependencia[];
  metas: MetaLite[];
  semanasHastaLaBoda: number | null;
  invita?: boolean;
}) {
  const estado = estadoDeHitos(acciones, metas);

  if (estado.tipo === "ninguno" || estado.tipo === "sin-semana") {
    if (!invita) return null;
    return (
      <p className="text-muted-foreground text-sm">
        {estado.tipo === "ninguno" ? INVITA_HITO : HITO_SIN_SEMANA}
      </p>
    );
  }

  const nombre = nombreDeHitos(acciones, estado.hito.inicioSemanas, metas);

  // Misma forma que la tira normal para que se lea como la misma cosa, con un
  // check en lugar del rombo. No cuenta nada más: contar lo que quedó sin
  // hacer sería un aviso de retraso, que está fuera de alcance (§13).
  if (estado.tipo === "cierre") {
    return (
      <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
        <Check className="size-3.5 shrink-0" aria-hidden />
        <span className="text-foreground font-medium">{nombre}</span>
        <span aria-hidden>·</span>
        <span>hecho</span>
        <span aria-hidden>·</span>
        <span>no queda ningún día clave por delante</span>
      </p>
    );
  }

  const faltan = faltanAntesDe(estado.hito, acciones, dependencias, metas);

  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
      <Diamond className="size-3.5 shrink-0" aria-hidden />
      <span className="text-foreground font-medium">{nombre}</span>
      <span aria-hidden>·</span>
      <span>{cuando(estado.hito.inicioSemanas, semanasHastaLaBoda)}</span>
      <span aria-hidden>·</span>
      <span>{antes(faltan)}</span>
    </p>
  );
}
