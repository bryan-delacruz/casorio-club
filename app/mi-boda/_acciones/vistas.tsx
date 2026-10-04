"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RUTAS } from "./rutas";

const VISTAS = [
  { href: RUTAS.mapa, nombre: "Mapa" },
  { href: RUTAS.camino, nombre: "Camino" },
];

/** Las dos maneras de mirar lo mismo: por momento, o por calendario. En el celular las lleva la barra de abajo. */
export function Vistas() {
  const donde = usePathname();
  return (
    <nav className="border-border inline-flex rounded-md border p-0.5">
      {VISTAS.map((v) => {
        const activa = donde === v.href;
        return (
          <Link
            key={v.href}
            href={v.href}
            aria-current={activa ? "page" : undefined}
            className={`rounded-sm px-3 py-1 text-sm ${
              activa
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {v.nombre}
          </Link>
        );
      })}
    </nav>
  );
}
