"use client";

import { Diamond } from "lucide-react";
import type { Accion, Dependencia } from "@/db/schema";
import { faltanAntesDe, faltanSemanas, nombreDeHitos, proximoHito } from "@/lib/metas";
import { INVITA_HITO, type MetaLite } from "./tipos";

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
 * La tira del próximo hito (docs/metas.md §5.3): una línea sobria con el
 * nombre del hito más temprano que queda por hacer, su cuenta regresiva y
 * cuántas cosas hay que terminar antes.
 *
 * Sin ningún hito no se dibuja. Solo el Mapa pone en su lugar la invitación a
 * marcar uno, y una sola vez: en el Camino el rombo ya lo explica.
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
  const hito = proximoHito(acciones, metas);
  if (!hito) {
    if (!invita) return null;
    return <p className="text-muted-foreground text-sm">{INVITA_HITO}</p>;
  }

  const nombre = nombreDeHitos(acciones, hito.inicioSemanas, metas);
  const faltan = faltanAntesDe(hito, acciones, dependencias, metas);

  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
      <Diamond className="size-3.5 shrink-0" aria-hidden />
      <span className="text-foreground font-medium">{nombre}</span>
      <span aria-hidden>·</span>
      <span>{cuando(hito.inicioSemanas, semanasHastaLaBoda)}</span>
      <span aria-hidden>·</span>
      <span>{antes(faltan)}</span>
    </p>
  );
}
