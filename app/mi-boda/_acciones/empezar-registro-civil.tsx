"use client";

import { useTransition } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { empezarRegistroCivil } from "./acciones-servidor";

/**
 * La plantilla "Registro civil" (docs/metas.md §4).
 *
 * Vive en su propio archivo porque la ofrecen el Camino y el Mapa, y el Mapa
 * no debería arrastrar el Gantt entero a su bundle para pedir un botón.
 */
export function EmpezarRegistroCivil({ variante = "outline" }: { variante?: "outline" | "ghost" }) {
  const [enviando, iniciar] = useTransition();
  return (
    <Button
      variant={variante}
      disabled={enviando}
      onClick={() =>
        iniciar(async () => {
          try {
            const r = await empezarRegistroCivil();
            if (r.error) toast.error(r.error);
            else toast.success("Meta Registro civil creada con sus pasos.");
          } catch {
            toast.error("No se pudo crear. Intenta otra vez.");
          }
        })
      }
    >
      <Flag className="size-4" />
      {enviando ? "Creando…" : "Empezar con Registro civil"}
    </Button>
  );
}
