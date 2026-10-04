"use client";

import { useClerk } from "@clerk/nextjs";
import { AvatarPersona } from "@/components/avatar-persona";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Reemplaza al UserButton de Clerk: la misma persona que se ve en las tarjetas
 * (iniciales sobre su color), no la foto de Google ni la silueta genérica.
 */
export function MenuPersona({
  persona,
  correo,
}: {
  persona: { id: string; nombre: string; iniciales: string; imagen?: string };
  correo?: string;
}) {
  const { openUserProfile, signOut } = useClerk();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Tu cuenta: ${persona.nombre}`}
        className="focus-visible:ring-ring rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        <AvatarPersona persona={persona} className="size-8" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block font-medium">{persona.nombre}</span>
          {correo && <span className="text-muted-foreground block truncate text-xs">{correo}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => openUserProfile()}>Mi cuenta</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => signOut({ redirectUrl: "/" })}>Salir</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
