"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, LayoutGrid, ReceiptText, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Destino = { href: string; nombre: string; Icono: LucideIcon; aviso?: number };

/**
 * En el celular, los destinos de la boda bajan al pulgar. En pantallas
 * grandes no existe: ahí la cabecera y el selector Mapa/Camino bastan.
 */
export function NavInferior({ conBernie, porAsignar }: { conBernie: boolean; porAsignar: number }) {
  const donde = usePathname();
  const destinos: Destino[] = [
    { href: "/mi-boda", nombre: "Mapa", Icono: LayoutGrid },
    { href: "/mi-boda/camino", nombre: "Camino", Icono: CalendarRange },
    ...(conBernie ? [{ href: "/mi-boda/bernie", nombre: "Gastos", Icono: ReceiptText, aviso: porAsignar }] : []),
    { href: "/mi-boda/equipo", nombre: "Quién está", Icono: Users },
  ];

  return (
    <nav
      aria-label="Secciones de la boda"
      className="bg-background/95 border-border fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <ul className="flex">
        {destinos.map(({ href, nombre, Icono, aviso }) => {
          const activo = donde === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-xs transition-colors",
                  "focus-visible:ring-ring outline-none focus-visible:ring-2 focus-visible:ring-inset",
                  activo ? "text-primary font-medium" : "text-muted-foreground active:text-foreground",
                )}
              >
                {/* El destino actual se marca con un hilo de vino arriba, como un separador de libreta. */}
                <span
                  aria-hidden
                  className={cn(
                    "bg-primary absolute top-0 h-0.5 w-8 rounded-b-full transition-opacity motion-reduce:transition-none",
                    activo ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="relative">
                  <Icono className="size-5" strokeWidth={activo ? 2.25 : 1.75} aria-hidden />
                  {!!aviso && (
                    <span className="bg-primary text-primary-foreground absolute -top-1.5 -right-2.5 min-w-4 rounded-full px-1 text-center text-[0.625rem] leading-4 tabular-nums">
                      {aviso}
                    </span>
                  )}
                </span>
                {nombre}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
