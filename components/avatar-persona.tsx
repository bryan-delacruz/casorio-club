import { cn } from "@/lib/utils";
import { colorDe } from "@/lib/persona";

/**
 * Iniciales de la persona sobre su color de la paleta (lib/persona.ts). El
 * tamaño de letra sigue al del círculo: se pasa con `className` (size-4…size-8).
 */
export function AvatarPersona({
  persona,
  className,
}: {
  persona: { id: string; nombre: string; iniciales: string };
  className?: string;
}) {
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
