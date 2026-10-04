import { cn } from "@/lib/utils";
import { colorDe } from "@/lib/persona";

/**
 * La foto que la persona subió o, si no subió ninguna, sus iniciales sobre su
 * color de la paleta (lib/persona.ts). El tamaño de letra sigue al del
 * círculo: se pasa con `className` (size-4…size-8).
 */
export function AvatarPersona({
  persona,
  className,
}: {
  persona: { id: string; nombre: string; iniciales: string; imagen?: string };
  className?: string;
}) {
  if (persona.imagen) {
    return (
      // Foto de Clerk ya optimizada por su CDN; next/image no aporta aquí.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={persona.imagen}
        alt=""
        title={persona.nombre}
        loading="lazy"
        className={cn("size-8 shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  const n = colorDe(persona.id);
  return (
    <span
      title={persona.nombre}
      aria-hidden
      style={{ background: `var(--persona-${n}-fondo)`, color: `var(--persona-${n}-texto)` }}
      className={cn(
        "font-display inline-flex size-8 shrink-0 items-center justify-center rounded-full leading-none font-medium select-none [container-type:size]",
        className,
      )}
    >
      <span className="text-[42cqh]">{persona.iniciales}</span>
    </span>
  );
}
