"use client";

import { useTransition } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { empezarPlan } from "./acciones-servidor";

/** "1 cosa" y no "1 cosas": el recuento se lee en voz alta. */
const cuenta = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * El recuento real de lo que se escribió, no un texto fijo
 * (docs/plantillas.md §7).
 */
function aviso(resumen: { metasNuevas: number; accionesNuevas: number; accionesReutilizadas: number }) {
  if (resumen.metasNuevas === 0 && resumen.accionesNuevas === 0) {
    return "Ya tenías todo el plan: no se creó nada.";
  }
  const creado = `Listo: ${cuenta(resumen.metasNuevas, "meta", "metas")} y ${cuenta(
    resumen.accionesNuevas,
    "cosa",
    "cosas",
  )}`;
  if (resumen.accionesReutilizadas === 0) return `${creado}. Todo se puede editar.`;
  return `${creado} nuevas. Las ${resumen.accionesReutilizadas} que ya tenías se quedaron como estaban.`;
}

/**
 * La plantilla del plan (docs/plantillas.md §8).
 *
 * Vive en su propio archivo porque la ofrecen el Camino y el Mapa, y el Mapa
 * no debería arrastrar el Gantt entero a su bundle para pedir un botón.
 */
export function EmpezarPlan({ variante = "outline" }: { variante?: "outline" | "ghost" }) {
  const [enviando, iniciar] = useTransition();
  return (
    <div className="space-y-1">
      <Button
        variant={variante}
        disabled={enviando}
        onClick={() =>
          iniciar(async () => {
            try {
              const r = await empezarPlan();
              if (r.error) toast.error(r.error);
              else if (r.resumen) {
                toast.success(aviso(r.resumen), {
                  description: r.yaPasaron
                    ? `${cuenta(r.yaPasaron, "cosa", "cosas")} ${
                        r.yaPasaron === 1 ? "quedó" : "quedaron"
                      } en semanas que ya pasaron.`
                    : undefined,
                });
              }
            } catch {
              toast.error("No se pudo crear. Intenta otra vez.");
            }
          })
        }
      >
        <Flag className="size-4" />
        {enviando ? "Creando…" : "Empezar con un plan de boda"}
      </Button>
      {/* Decir el tamaño antes de escribir 24 filas es lo mínimo honesto; un
          diálogo de confirmación sería un paso de más (§8). */}
      <p className="text-muted-foreground text-xs">4 metas y 24 cosas, todo editable.</p>
    </div>
  );
}
