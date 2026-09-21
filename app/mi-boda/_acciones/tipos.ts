import type { Momento } from "./acciones-servidor";

export type Miembro = { id: string; nombre: string; imagen: string | null };

export const DESTINOS: { id: Momento; nombre: string }[] = [
  { id: "antes", nombre: "Antes" },
  { id: "el_dia", nombre: "El día" },
  { id: "despues", nombre: "Después" },
  { id: "idea", nombre: "Ideas sueltas" },
];
